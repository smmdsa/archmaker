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
    movedNodes: Set<string>; // Track nodes that have been moved to avoid duplicates
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
        selectedWalls: [],
        movedNodes: new Set()
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
            this.state.movedNodes = new Set(); // Reset moved nodes tracking

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

        // Clear moved nodes tracking for this move iteration
        this.state.movedNodes.clear();

        // First, move all selected walls and their nodes
        this.state.selectedWalls.forEach(wall => {
            const wallData = wall.getData();
            const startNode = this.canvasStore.getWallGraph().getNode(wallData.startNodeId);
            const endNode = this.canvasStore.getWallGraph().getNode(wallData.endNodeId);
            
            if (startNode && endNode) {
                // Move both nodes of the wall if they haven't been moved yet
                if (!this.state.movedNodes.has(startNode.id)) {
                    const startPos = startNode.position;
                    startNode.setPosition(startPos.x + dx, startPos.y + dy);
                    this.state.movedNodes.add(startNode.id);
                    
                    // Update connected walls for this node
                    this.updateConnectedWalls(startNode);
                }

                if (!this.state.movedNodes.has(endNode.id)) {
                    const endPos = endNode.position;
                    endNode.setPosition(endPos.x + dx, endPos.y + dy);
                    this.state.movedNodes.add(endNode.id);
                    
                    // Update connected walls for this node
                    this.updateConnectedWalls(endNode);
                }
            }
        });

        // Then move selected nodes that haven't been moved by wall movement
        this.state.selectedNodes.forEach(node => {
            if (!this.state.movedNodes.has(node.id)) {
                const currentPos = node.position;
                node.setPosition(
                    currentPos.x + dx,
                    currentPos.y + dy
                );
                this.state.movedNodes.add(node.id);
                
                // Update connected walls for this node
                this.updateConnectedWalls(node);
            }
        });

        // Trigger immediate canvas update
        this.updateCanvas();

        // Update last point for next move
        this.state.lastPoint = event.position;
    }

    private updateConnectedWalls(node: NodeObject): void {
        const connectedWalls = node.getConnectedWalls();
        connectedWalls.forEach(wallId => {
            const wall = this.canvasStore.getWallGraph().getWall(wallId);
            if (wall) {
                const startNodeId = wall.getData().startNodeId;
                const endNodeId = wall.getData().endNodeId;
                const startNode = this.canvasStore.getWallGraph().getNode(startNodeId);
                const endNode = this.canvasStore.getWallGraph().getNode(endNodeId);

                if (startNode && endNode) {
                    wall.updateStartPoint(startNode.position);
                    wall.updateEndPoint(endNode.position);
                }
            }
        });
    }

    private async handleMouseUp(event: CanvasEvent): Promise<void> {
        if (this.state.isMoving) {
            this.logger.info('Ending move operation', {
                selectedNodes: this.state.selectedNodes.map(n => n.id),
                selectedWalls: this.state.selectedWalls.map(w => w.id)
            });

            // Final canvas update
            this.updateCanvas();

            // Reset move state
            this.state = {
                isMoving: false,
                startPoint: null,
                lastPoint: null,
                selectedNodes: [],
                selectedWalls: [],
                movedNodes: new Set()
            };
        }
    }

    private updateCanvas(): void {
        // Trigger immediate canvas redraw through CanvasStore
        this.eventManager.emit('graph:changed', {
            nodeCount: this.canvasStore.getWallGraph().getAllNodes().length,
            wallCount: this.canvasStore.getWallGraph().getAllWalls().length,
            roomCount: this.canvasStore.getWallGraph().getAllRooms().length
        });
    }
} 