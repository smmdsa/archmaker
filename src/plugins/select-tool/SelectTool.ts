import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import { ProjectStore } from '../../store/ProjectStore';
import { CanvasStore } from '../../store/CanvasStore';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import type { Point } from '../../core/types/geometry';
import Konva from 'konva';
import { Vector2 } from 'three';

/**
 * Represents the state of the selection tool
 * @interface SelectionState
 */
interface SelectionState {
    /** Set of IDs of currently selected nodes */
    selectedNodes: Set<string>;
    
    /** Whether user is currently dragging a selection box */
    isDragging: boolean;
    
    /** Starting point of selection drag, null if not dragging */
    dragStart: Point | null;
    
    /** Current end point of selection drag, null if not dragging */
    dragEnd: Point | null;
    
    /** Whether multi-select mode is enabled (e.g. via Shift key) */
    isMultiSelect: boolean;
}

interface NodeVisualConfig {
    normal: {
        fill: string;
        stroke: string;
        strokeWidth: number;
    };
    selected: {
        fill: string;
        stroke: string;
        strokeWidth: number;
    };
}

const toolManifest = {
    id: 'select-tool',
    name: 'Select Tool',
    version: '1.0.0',
    icon: '🔍',
    tooltip: 'Select nodes (S)',
    section: 'edit',
    order: 1,
    shortcut: 's'
};

@ToolPlugin({
    id: 'select-tool',
    name: 'Select Tool',
    version: '1.0.0',
    description: 'Tool for selecting nodes',
    icon: '🔍',
    tooltip: 'Select nodes (S)',
    section: 'edit',
    order: 1,
    shortcut: 's'
})
export class SelectTool extends BaseTool {
    private state: SelectionState = {
        selectedNodes: new Set(),
        isDragging: false,
        dragStart: null,
        dragEnd: null,
        isMultiSelect: false
    };

    private readonly nodeVisualConfig: NodeVisualConfig = {
        normal: {
            fill: '#fff',
            stroke: '#333',
            strokeWidth: 1
        },
        selected: {
            fill: '#0066ff',
            stroke: '#003399',
            strokeWidth: 2
        }
    };

    private selectionRect: Konva.Rect | null = null;
    private readonly canvasStore: CanvasStore;
    private mainLayer: Konva.Layer | null = null;
    private tempLayer: Konva.Layer | null = null;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        private readonly configManager: IConfigManager,
        private readonly store: ProjectStore
    ) {
        super(eventManager, logger, 'select-tool', toolManifest);

        this.canvasStore = CanvasStore.getInstance(eventManager, logger);

        // Subscribe to canvas layers
        this.eventManager.on<{ mainLayer: Konva.Layer, tempLayer: Konva.Layer }>('canvas:layers', (layers) => {
            this.logger.info('Received canvas layers in SelectTool');
            this.setLayers(layers.mainLayer, layers.tempLayer);
        });

        // Request layers if canvas is already initialized
        this.eventManager.emit('canvas:request-layers', null);
    }

    private setLayers(mainLayer: Konva.Layer, tempLayer: Konva.Layer): void {
        this.mainLayer = mainLayer;
        this.tempLayer = tempLayer;
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!this.mainLayer || !this.tempLayer) return;

        // Only update multi-select state on mousedown and mouseup
        if (event.type === 'mousedown' || event.type === 'mouseup') {
            // Type assertion to MouseEvent since we know it's a mouse event
            const mouseEvent = event.originalEvent as MouseEvent;
            //evt is part of the mouse event
            this.state.isMultiSelect =(mouseEvent.evt.ctrlKey || mouseEvent.metaKey) ;
        }

        switch (event.type) {
            case 'mousedown':
                await this.handleMouseDown(event);
                break;
            case 'mousemove':
                // Only process mousemove if we're dragging
                if (this.state.isDragging) {
                    await this.handleMouseMove(event);
                }
                break;
            case 'mouseup':
                await this.handleMouseUp(event);
                break;
        }
    }

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        // Store initial position for drag detection
        this.state.dragStart = event.position;
        this.state.dragEnd = event.position;

        // Check for node selection
        const clickedNode = this.findNodeAtPosition(event.position);
        
        if (clickedNode) {
            const nodeId = clickedNode.getId();
            
            if (this.state.isMultiSelect) {
                // In multi-select mode (Ctrl/Cmd pressed)
                if (this.state.selectedNodes.has(nodeId)) {
                    // If node was already selected, remove it
                    this.state.selectedNodes.delete(nodeId);
                } else {
                    // If node wasn't selected, add it to existing selection
                    this.state.selectedNodes.add(nodeId);
                }
            } else {
                // In single-select mode (no Ctrl/Cmd)
                this.state.selectedNodes.clear();
                this.state.selectedNodes.add(nodeId);
            }

            this.logger.info('Selection updated:', {
                nodeId,
                isMultiSelect: this.state.isMultiSelect,
                selectedNodes: Array.from(this.state.selectedNodes)
            });

            this.updateNodeVisuals();
            this.emitSelectionChanged();
            
            // Wait for potential drag operation
            this.state.isDragging = false;
        } else {
            // If we clicked empty space
            if (!this.state.isMultiSelect) {
                // Only clear selection if not in multi-select mode
                if (this.state.selectedNodes.size > 0) {
                    this.state.selectedNodes.clear();
                    this.updateNodeVisuals();
                    this.emitSelectionChanged();
                }
            }
            // Start drag selection
            this.state.isDragging = true;
            this.initSelectionRect(event.position);
        }
    }

    private async handleMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.dragStart) return;

        // Calculate drag distance to distinguish between click and drag
        const dragDistance = Math.sqrt(
            Math.pow(event.position.x - this.state.dragStart.x, 2) +
            Math.pow(event.position.y - this.state.dragStart.y, 2)
        );

        // If we've moved more than 5 pixels, ensure drag mode is active
        if (dragDistance > 5) {
            this.state.isDragging = true;
            if (!this.selectionRect) {
                this.initSelectionRect(this.state.dragStart);
            }
        }

        this.state.dragEnd = event.position;
        this.updateSelectionRect();
    }

    private async handleMouseUp(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        if (this.state.isDragging && this.state.dragStart && this.state.dragEnd) {
            // Handle drag selection
            const previousSelection = new Set(this.state.selectedNodes);
            
            // Update selection based on rectangle
            const nodesInSelection = this.findNodesInSelection(
                this.state.dragStart,
                this.state.dragEnd
            );

            if (!this.state.isMultiSelect) {
                this.state.selectedNodes.clear();
            }

            nodesInSelection.forEach(node => {
                this.state.selectedNodes.add(node.getId());
            });

            // Only update and emit if selection changed
            if (!this.areSelectionsEqual(previousSelection, this.state.selectedNodes)) {
                this.updateNodeVisuals();
                this.emitSelectionChanged();
            }
        }

        // Reset drag state
        this.state.isDragging = false;
        this.state.dragStart = null;
        this.state.dragEnd = null;

        if (this.selectionRect) {
            this.selectionRect.visible(false);
            this.tempLayer?.batchDraw();
        }
    }

    private initSelectionRect(position: Point): void {
        if (!this.selectionRect) {
            this.selectionRect = new Konva.Rect({
                x: position.x,
                y: position.y,
                width: 0,
                height: 0,
                fill: 'rgba(0, 100, 255, 0.25)',
                stroke: '#0066ff',
                strokeWidth: 1,
                visible: false
            });
            this.tempLayer?.add(this.selectionRect);
        } else {
            this.selectionRect.setAttrs({
                x: position.x,
                y: position.y,
                width: 0,
                height: 0,
                visible: false
            });
        }
    }

    private areSelectionsEqual(a: Set<string>, b: Set<string>): boolean {
        if (a.size !== b.size) return false;
        for (const item of a) {
            if (!b.has(item)) return false;
        }
        return true;
    }

    private updateSelectionRect(): void {
        if (!this.selectionRect || !this.state.dragStart || !this.state.dragEnd) return;
        const x = Math.min(this.state.dragStart.x, this.state.dragEnd.x);
        const y = Math.min(this.state.dragStart.y, this.state.dragEnd.y);
        const width = Math.abs(this.state.dragEnd.x - this.state.dragStart.x);
        const height = Math.abs(this.state.dragEnd.y - this.state.dragStart.y);

        this.selectionRect.setAttrs({
            x,
            y,
            width,
            height,
            visible: true
        });

        this.tempLayer?.batchDraw();
    }

    private findNodeAtPosition(position: Point): any | null {
        const graph = this.canvasStore.getWallGraph();
        const point = new Vector2(position.x, position.y);
        return graph.findClosestNode(point, 10);
    }

    private findNodesInSelection(start: Point, end: Point): any[] {
        const graph = this.canvasStore.getWallGraph();
        const nodes = graph.getAllNodes();

        const left = Math.min(start.x, end.x);
        const right = Math.max(start.x, end.x);
        const top = Math.min(start.y, end.y);
        const bottom = Math.max(start.y, end.y);

        return nodes.filter(node => {
            const pos = node.getPosition();
            return pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom;
        });
    }

    private updateNodeVisuals(): void {
        if (!this.mainLayer) return;

        // Reset all node visuals
        const graph = this.canvasStore.getWallGraph();
        const nodes = graph.getAllNodes();

        this.logger.info('Updating node visuals in SelectTool', {
            selectedNodes: Array.from(this.state.selectedNodes),
            totalNodes: nodes.length
        });

        // Find all node shapes
        const nodeShapes = this.mainLayer.find('.node');

        nodes.forEach(node => {
            const nodeId = node.getId();
            // Find node shape by name and data attribute
            const nodeShape = nodeShapes.find(shape => 
                shape.name() === 'node' && 
                shape.getAttr('data').nodeId === nodeId
            );

            this.logger.info('Node visual update:', {
                nodeId,
                found: !!nodeShape,
                isSelected: this.state.selectedNodes.has(nodeId)
            });

            if (nodeShape) {
                const config = this.state.selectedNodes.has(nodeId) 
                    ? this.nodeVisualConfig.selected 
                    : this.nodeVisualConfig.normal;
                
                nodeShape.setAttrs({
                    fill: config.fill,
                    stroke: config.stroke,
                    strokeWidth: config.strokeWidth,
                });
            }
        });

        this.mainLayer.batchDraw();
    }

    private emitSelectionChanged(): void {
        this.eventManager.emit('selection:changed', {
            selectedNodes: Array.from(this.state.selectedNodes),
            source: 'select-tool'
        });
    }

    async activate(): Promise<void> {
        await super.activate();
        this.logger.info('Select tool activated');
        // Restore visual state of previously selected nodes
        this.updateNodeVisuals();
    }

    async deactivate(): Promise<void> {
        if (this.selectionRect) {
            this.selectionRect.destroy();
            this.selectionRect = null;
        }
        await super.deactivate();
        this.logger.info('Select tool deactivated');
    }

    getSelectedNodes(): string[] {
        return Array.from(this.state.selectedNodes);
    }

    clearSelection(): void {
        if (this.state.selectedNodes.size > 0) {
            this.state.selectedNodes.clear();
            this.updateNodeVisuals();
            this.emitSelectionChanged();
        }
    }
} 