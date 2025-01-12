import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { SelectionStore } from '../../store/SelectionStore';
import { CanvasStore } from '../../store/CanvasStore';
import { Point } from '../../core/types/geometry';
import { Rect } from 'konva/lib/shapes/Rect';
import { ISelectableObject, SelectableObjectType } from '../../core/interfaces/ISelectableObject';

interface SelectionState {
    isSelecting: boolean;
    isMultiSelect: boolean;
    startPoint: Point | null;
    selectionRect: Rect | null;
}

const toolManifest = {
    id: 'select-tool',
    name: 'Select Tool',
    version: '1.0.0',
    icon: '🔍',
    tooltip: 'Select objects (S)',
    section: 'edit',
    order: 1,
    shortcut: 's'
};

@ToolPlugin({
    id: 'select-tool',
    name: 'Select Tool',
    version: '1.0.0',
    description: 'Tool for selecting objects',
    icon: '🔍',
    tooltip: 'Select objects (S)',
    section: 'edit',
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
        super(eventManager, logger, 'select-tool', toolManifest);
        this.selectionStore = SelectionStore.getInstance(eventManager, logger);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        const mouseEvent = event.originalEvent as MouseEvent;
        this.state.isMultiSelect = mouseEvent.ctrlKey || mouseEvent.metaKey;

        switch (event.type) {
            case 'mousedown':
                await this.handleMouseDown(event);
                break;
            case 'mousemove':
                if (this.state.isSelecting) {
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

        this.state.isSelecting = true;
        this.state.startPoint = event.position;

        // Check for object under cursor
        const hitObject = this.findObjectAtPosition(event.position);

        if (hitObject) {
            if (!this.state.isMultiSelect) {
                this.selectionStore.clearSelection();
            }
            this.updateSelection([hitObject]);
        } else if (!this.state.isMultiSelect) {
            this.selectionStore.clearSelection();
            this.initSelectionRect(event.position);
        }
    }

    private async handleMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.startPoint || !this.state.selectionRect) return;

        // Update selection rectangle
        const x = Math.min(this.state.startPoint.x, event.position.x);
        const y = Math.min(this.state.startPoint.y, event.position.y);
        const width = Math.abs(event.position.x - this.state.startPoint.x);
        const height = Math.abs(event.position.y - this.state.startPoint.y);

        this.state.selectionRect.setAttrs({
            x, y, width, height
        });

        // Find objects in selection rectangle
        const objectsInRect = this.findObjectsInRect({ x, y, width, height });
        this.updateSelection(objectsInRect);

        const layers = this.canvasStore.getLayers();
        layers?.tempLayer.batchDraw();
    }

    private async handleMouseUp(event: CanvasEvent): Promise<void> {
        this.state.isSelecting = false;

        if (this.state.selectionRect) {
            this.state.selectionRect.destroy();
            this.state.selectionRect = null;

            const layers = this.canvasStore.getLayers();
            layers?.tempLayer.batchDraw();
        }

        this.state.startPoint = null;
    }

    private initSelectionRect(position: Point): void {
        const layers = this.canvasStore.getLayers();
        if (!layers) return;

        this.state.selectionRect = new Rect({
            x: position.x,
            y: position.y,
            width: 0,
            height: 0,
            stroke: '#00ff00',
            fill: 'rgba(0, 255, 0, 0.2)',
        });

        layers.tempLayer.add(this.state.selectionRect);
        layers.tempLayer.batchDraw();
    }

    private findObjectAtPosition(position: Point): ISelectableObject | null {
        const graph = this.canvasStore.getWallGraph();
        
        // Check nodes first (they're on top)
        const nodes = graph.getAllNodes();
        for (const node of nodes) {
            if (node.containsPoint(position)) {
                return node;
            }
        }

        // Then check walls
        const walls = graph.getAllWalls();
        for (const wall of walls) {
            if (wall.containsPoint(position)) {
                return wall;
            }
        }

        return null;
    }

    private findObjectsInRect(rect: { x: number; y: number; width: number; height: number }): ISelectableObject[] {
        const graph = this.canvasStore.getWallGraph();
        const objects: ISelectableObject[] = [];

        // Check nodes
        graph.getAllNodes().forEach(node => {
            if (node.intersectsRect(rect)) {
                objects.push(node);
            }
        });

        // Check walls
        graph.getAllWalls().forEach(wall => {
            if (wall.intersectsRect(rect)) {
                objects.push(wall);
            }
        });

        return objects;
    }

    private updateSelection(objects: ISelectableObject[]): void {
        const nodes: string[] = [];
        const walls: string[] = [];

        objects.forEach(obj => {
            switch (obj.type) {
                case SelectableObjectType.NODE:
                    nodes.push(obj.id);
                    break;
                case SelectableObjectType.WALL:
                    walls.push(obj.id);
                    break;
            }
        });

        this.eventManager.emit('selection:changed', {
            selectedNodes: nodes,
            selectedWalls: walls,
            source: 'select-tool'
        });
    }
} 