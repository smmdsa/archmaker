import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { SelectionStore } from '../../store/SelectionStore';
import { CanvasStore } from '../../store/CanvasStore';
import { Point } from '../../core/types/geometry';
import { NodeObject } from '../wall-tool/objects/NodeObject';
import { WallObject } from '../wall-tool/objects/WallObject';

interface MoveState {
    isMoving: boolean;
    startPoint: Point | null;
    lastPoint: Point | null;
    selectedNodes: NodeObject[];
    selectedWalls: WallObject[];
}

const toolManifest = {
    id: 'move-tool',
    name: 'Move Tool',
    version: '1.0.0',
    icon: '✋',
    tooltip: 'Move selected objects (M)',
    section: 'edit',
    order: 2,
    shortcut: 'm'
};

@ToolPlugin({
    id: 'move-tool',
    name: 'Move Tool',
    version: '1.0.0',
    description: 'Tool for moving selected objects',
    icon: '✋',
    tooltip: 'Move selected objects (M)',
    section: 'edit',
    order: 2,
    shortcut: 'm'
})
export class MoveTool extends BaseTool {
    private readonly selectionStore: SelectionStore;
    private readonly canvasStore: CanvasStore;
    private state: MoveState = {
        isMoving: false,
        startPoint: null,
        lastPoint: null,
        selectedNodes: [],
        selectedWalls: []
    };

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, 'move-tool', toolManifest);
        this.selectionStore = SelectionStore.getInstance(eventManager, logger);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        switch (event.type) {
            case 'mousedown':
                await this.handleMouseDown(event);
                break;
            case 'mousemove':
                if (this.state.isMoving) {
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

        // Get selected objects
        const graph = this.canvasStore.getWallGraph();
        const selectedNodeIds = this.selectionStore.getSelectedNodes();
        const selectedWallIds = this.selectionStore.getSelectedWalls();

        // Get actual objects
        this.state.selectedNodes = Array.from(selectedNodeIds)
            .map(id => graph.getNode(id))
            .filter((node): node is NodeObject => node !== undefined);

        this.state.selectedWalls = Array.from(selectedWallIds)
            .map(id => graph.getWall(id))
            .filter((wall): wall is WallObject => wall !== undefined);

        if (this.state.selectedNodes.length > 0 || this.state.selectedWalls.length > 0) {
            this.state.isMoving = true;
            this.state.startPoint = event.position;
            this.state.lastPoint = event.position;

            this.logger.info('Starting move operation', {
                selectedNodes: this.state.selectedNodes.map(n => n.id),
                selectedWalls: this.state.selectedWalls.map(w => w.id)
            });
        }
    }

    private async handleMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.lastPoint) return;

        const dx = event.position.x - this.state.lastPoint.x;
        const dy = event.position.y - this.state.lastPoint.y;

        // Move selected nodes
        this.state.selectedNodes.forEach(node => {
            const currentPos = node.position;
            node.setPosition(
                currentPos.x + dx,
                currentPos.y + dy
            );
        });

        // Update walls (they will update automatically through node connections)
        if (this.state.selectedNodes.length > 0 || this.state.selectedWalls.length > 0) {
            this.eventManager.emit('graph:changed', {
                nodeCount: this.canvasStore.getWallGraph().getAllNodes().length,
                wallCount: this.canvasStore.getWallGraph().getAllWalls().length
            });
        }

        // Update last point for next move
        this.state.lastPoint = event.position;
    }

    private async handleMouseUp(event: CanvasEvent): Promise<void> {
        if (this.state.isMoving) {
            this.logger.info('Ending move operation', {
                selectedNodes: this.state.selectedNodes.map(n => n.id),
                selectedWalls: this.state.selectedWalls.map(w => w.id)
            });

            // Reset move state
            this.state = {
                isMoving: false,
                startPoint: null,
                lastPoint: null,
                selectedNodes: [],
                selectedWalls: []
            };
        }
    }
} 