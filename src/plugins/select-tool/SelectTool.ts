import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { Point } from '../../core/types/geometry';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { SelectionStore } from '../../store/SelectionStore';
import { CanvasStore } from '../../store/CanvasStore';
import { Line } from 'konva/lib/shapes/Line';
import { Layer } from 'konva/lib/Layer';
import { ISelectableObject, SelectableObjectType } from '../../core/interfaces/ISelectableObject';

interface SelectionState {
    isSelecting: boolean;
    isMultiSelect: boolean;
    startPoint: Point | null;
    selectionRect: Line | null;
}

@ToolPlugin({
    id: '@select-tool',
    name: 'Select Tool',
    version: '1.0.0',
    description: 'Tool for selecting objects',
    icon: '👆',
    tooltip: 'Select objects (S)',
    section: 'tools',
    order: 1,
    shortcut: 's'
})
export class SelectTool extends BaseTool {
    private readonly selectionStore: SelectionStore;
    private readonly canvasStore: CanvasStore;
    private state: SelectionState = {
        isSelecting: false,
        isMultiSelect: false,
        startPoint: null,
        selectionRect: null
    };

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, '@select-tool', {
            id: '@select-tool',
            name: 'Select Tool',
            version: '1.0.0',
            icon: '👆',
            tooltip: 'Select objects (S)',
            section: 'tools',
            order: 1,
            shortcut: 's'
        });

        this.selectionStore = SelectionStore.getInstance(eventManager, logger);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        const mouseEvent = event.originalEvent as MouseEvent;
        this.state.isMultiSelect = mouseEvent.ctrlKey || mouseEvent.metaKey;

        switch (event.type) {
            case 'mousedown':
                await this.handleMouseDown(event.position);
                break;
            case 'mousemove':
                await this.handleMouseMove(event.position);
                break;
            case 'mouseup':
                await this.handleMouseUp(event.position);
                break;
        }
    }

    private async handleMouseDown(point: Point): Promise<void> {
        this.state.isSelecting = true;
        this.state.startPoint = point;

        // Check if we clicked on an object
        const clickedObject = this.findObjectAtPosition(point);

        if (clickedObject) {
            if (this.state.isMultiSelect) {
                // In multi-select mode, toggle the clicked object's selection
                clickedObject.setSelected(!clickedObject.isSelected);
            } else {
                // In single-select mode:
                // If clicking an already selected object, just toggle it
                // If clicking an unselected object, clear others and select it
                if (clickedObject.isSelected) {
                    clickedObject.setSelected(false);
                } else {
                    // Clear previous selection
                    this.clearAllSelections();
                    clickedObject.setSelected(true);
                }
            }
            
            // Emit selection changed and force immediate redraw
            this.emitSelectionChanged();
            const layers = this.canvasStore.getLayers();
            if (layers) {
                this.logger.info('Forcing immediate redraw after selection');
                layers.mainLayer.draw();
                layers.tempLayer.draw();
            }
        } else {
            // Clicked on empty space
            if (!this.state.isMultiSelect) {
                // Clear all selections if not in multi-select mode
                this.clearAllSelections();
                this.emitSelectionChanged();
                const layers = this.canvasStore.getLayers();
                if (layers) {
                    layers.mainLayer.draw();
                    layers.tempLayer.draw();
                }
            }
            // Start drawing selection rectangle
            this.initSelectionRect(point);
        }
    }

    private async handleMouseMove(point: Point): Promise<void> {
        if (this.state.isSelecting && this.state.startPoint) {
            if (this.state.selectionRect) {
                // Update selection rectangle
                const points = [
                    this.state.startPoint.x, this.state.startPoint.y,
                    point.x, this.state.startPoint.y,
                    point.x, point.y,
                    this.state.startPoint.x, point.y,
                    this.state.startPoint.x, this.state.startPoint.y // Close the rectangle
                ];
                this.state.selectionRect.points(points);
                
                // Update selection based on rectangle
                this.updateSelectionFromRect(this.state.startPoint, point);
                
                // Ensure selection rectangle is visible
                const layers = this.canvasStore.getLayers();
                if (layers) {
                    layers.tempLayer.draw(); // Immediate update for selection rectangle
                }
            }
        } else {
            // Highlight object under cursor
            const hoveredObject = this.findObjectAtPosition(point);
            this.clearAllHighlights();
            if (hoveredObject && !hoveredObject.isSelected) {
                hoveredObject.setHighlighted(true);
                // Force immediate highlight update
                const layers = this.canvasStore.getLayers();
                if (layers) {
                    layers.mainLayer.draw();
                }
            }
        }
    }

    private async handleMouseUp(point: Point): Promise<void> {
        // Cleanup selection rectangle
        if (this.state.selectionRect) {
            this.state.selectionRect.destroy();
            this.state.selectionRect = null;
            
            // Force immediate canvas update
            const layers = this.canvasStore.getLayers();
            layers?.tempLayer.batchDraw();
            layers?.mainLayer.batchDraw();
        }

        this.state.isSelecting = false;
        this.state.startPoint = null;
    }

    private async handleMouseOver(point: Point): Promise<void> {
        const hoveredObject = this.findObjectAtPosition(point);
        if (hoveredObject && !hoveredObject.isSelected) {
            hoveredObject.setHighlighted(true);
        }
    }

    private async handleMouseOut(): Promise<void> {
        this.clearAllHighlights();
    }

    private findObjectAtPosition(point: Point): ISelectableObject | null {
        const graph = this.canvasStore.getWallGraph();
        
        // Check walls first (they're behind nodes)
        const walls = graph.getAllWalls();
        for (const wall of walls) {
            if (wall.containsPoint(point)) {
                return wall;
            }
        }

        // Then check nodes
        const nodes = graph.getAllNodes();
        for (const node of nodes) {
            if (node.containsPoint(point)) {
                return node;
            }
        }

        return null;
    }

    private initSelectionRect(point: Point): void {
        const layers = this.canvasStore.getLayers();
        if (!layers) return;

        this.state.selectionRect = new Line({
            points: [point.x, point.y, point.x, point.y, point.x, point.y, point.x, point.y],
            closed: true,
            fill: 'rgba(33, 150, 243, 0.1)',
            stroke: '#2196f3',
            strokeWidth: 1,
            dash: [5, 5]
        });

        layers.tempLayer.add(this.state.selectionRect);
        layers.tempLayer.batchDraw();
    }

    private updateSelectionFromRect(start: Point, end: Point): void {
        const bounds = {
            left: Math.min(start.x, end.x),
            right: Math.max(start.x, end.x),
            top: Math.min(start.y, end.y),
            bottom: Math.max(start.y, end.y)
        };

        const graph = this.canvasStore.getWallGraph();
        const objects: ISelectableObject[] = [
            ...graph.getAllNodes(),
            ...graph.getAllWalls()
        ];

        let selectionChanged = false;
        objects.forEach(obj => {
            const isInRect = this.isObjectInRect(obj, bounds);
            if (isInRect && !obj.isSelected) {
                obj.setSelected(true);
                selectionChanged = true;
            } else if (!this.state.isMultiSelect && obj.isSelected && !isInRect) {
                obj.setSelected(false);
                selectionChanged = true;
            }
        });

        if (selectionChanged) {
            this.emitSelectionChanged();
            // Force immediate visual update
            const layers = this.canvasStore.getLayers();
            if (layers) {
                this.logger.info('Forcing immediate redraw after rectangle selection');
                layers.mainLayer.draw(); // Using draw() instead of batchDraw() for immediate update
                layers.tempLayer.draw();
            }
        }
    }

    private isObjectInRect(obj: ISelectableObject, rect: { left: number; right: number; top: number; bottom: number }): boolean {
        const bounds = obj.bounds;
        
        // Check if any part of the object intersects with the rectangle
        const objectRight = bounds.x + bounds.width;
        const objectBottom = bounds.y + bounds.height;
        
        // Check for no intersection (if any of these conditions is true, there is no intersection)
        const noIntersection = 
            objectRight < rect.left || // Object is completely to the left
            bounds.x > rect.right || // Object is completely to the right
            objectBottom < rect.top || // Object is completely above
            bounds.y > rect.bottom; // Object is completely below
        
        // Return true if there is any intersection
        return !noIntersection;
    }

    private clearAllHighlights(): void {
        const graph = this.canvasStore.getWallGraph();
        [...graph.getAllNodes(), ...graph.getAllWalls()].forEach(obj => {
            obj.setHighlighted(false);
        });
    }

    private emitSelectionChanged(): void {
        const graph = this.canvasStore.getWallGraph();
        const selectedNodes = graph.getAllNodes()
            .filter(node => node.isSelected)
            .map(node => node.id);
        const selectedWalls = graph.getAllWalls()
            .filter(wall => wall.isSelected)
            .map(wall => wall.id);

        this.eventManager.emit('selection:changed', {
            selectedNodes,
            selectedWalls,
            source: '@select-tool'
        });

        // Force canvas redraw to show selection changes immediately
        const layers = this.canvasStore.getLayers();
        if (layers) {
            layers.mainLayer.batchDraw();
            layers.tempLayer.batchDraw();
        }
    }

    private clearAllSelections(): void {
        const graph = this.canvasStore.getWallGraph();
        [...graph.getAllNodes(), ...graph.getAllWalls()].forEach(obj => {
            obj.setSelected(false);
        });
    }

    async activate(): Promise<void> {
        await super.activate();
        this.logger.info('Select Tool activated');
    }

    async deactivate(): Promise<void> {
        this.clearAllHighlights();
        if (this.state.selectionRect) {
            this.state.selectionRect.destroy();
        }
        this.state = {
            isSelecting: false,
            isMultiSelect: false,
            startPoint: null,
            selectionRect: null
        };
        await super.deactivate();
    }
} 