import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { SelectionStore } from '../../store/SelectionStore';
import { CanvasStore } from '../../store/CanvasStore';
import { NodeObject } from '../wall-tool/objects/NodeObject';
import { WallObject } from '../wall-tool/objects/WallObject';

const toolManifest = {
    id: 'remove-tool',
    name: 'Remove Tool',
    version: '1.0.0',
    icon: '🗑️',
    tooltip: 'Remove selected objects (Del)',
    section: 'edit',
    order: 4,
    shortcut: 'Delete'
};

@ToolPlugin({
    id: 'remove-tool',
    name: 'Remove Tool',
    version: '1.0.0',
    description: 'Tool for removing selected objects',
    icon: '🗑️',
    tooltip: 'Remove selected objects (Del)',
    section: 'edit',
    order: 4,
    shortcut: 'Delete'
})
export class RemoveTool extends BaseTool {
    private readonly selectionStore: SelectionStore;
    private readonly canvasStore: CanvasStore;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, 'remove-tool', toolManifest);
        this.selectionStore = SelectionStore.getInstance(eventManager, logger);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        // Only handle keyboard events for Delete key
        if (event.type === 'keydown' && (event.originalEvent as KeyboardEvent).key === 'Delete') {
            await this.removeSelectedObjects();
        }
    }

    async activate(): Promise<void> {
        await super.activate();
        await this.removeSelectedObjects();
    }

    private async removeSelectedObjects(): Promise<void> {
        const graph = this.canvasStore.getWallGraph();
        const selectedNodeIds = this.selectionStore.getSelectedNodes();
        const selectedWallIds = this.selectionStore.getSelectedWalls();

        if (selectedNodeIds.size === 0 && selectedWallIds.size === 0) {
            return;
        }

        this.logger.info('Removing selected objects', {
            nodes: Array.from(selectedNodeIds),
            walls: Array.from(selectedWallIds)
        });

        // First remove selected walls
        for (const wallId of selectedWallIds) {
            const wall = graph.getWall(wallId);
            if (wall) {
                // Get connected nodes before removing the wall
                const wallData = wall.getData();
                const startNode = graph.getNode(wallData.startNodeId);
                const endNode = graph.getNode(wallData.endNodeId);

                // Remove wall from graph
                graph.removeWall(wallId);

                // Update connected walls for affected nodes
                if (startNode) this.updateConnectedWalls(startNode);
                if (endNode) this.updateConnectedWalls(endNode);
            }
        }

        // Then remove selected nodes
        for (const nodeId of selectedNodeIds) {
            const node = graph.getNode(nodeId);
            if (node) {
                // Get connected walls before removing the node
                const connectedWalls = node.getConnectedWalls();
                
                // Remove node and its connected walls
                graph.removeNode(nodeId);

                // Update any remaining connected walls
                connectedWalls.forEach(wallId => {
                    const wall = graph.getWall(wallId);
                    if (wall) {
                        const wallData = wall.getData();
                        const otherNode = wallData.startNodeId === nodeId 
                            ? graph.getNode(wallData.endNodeId)
                            : graph.getNode(wallData.startNodeId);
                        
                        if (otherNode) {
                            this.updateConnectedWalls(otherNode);
                        }
                    }
                });
            }
        }

        // Clear selection
        this.selectionStore.clearSelection();

        // Trigger canvas update
        this.updateCanvas();
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

    private updateCanvas(): void {
        const graph = this.canvasStore.getWallGraph();
        this.eventManager.emit('graph:changed', {
            nodeCount: graph.getAllNodes().length,
            wallCount: graph.getAllWalls().length,
            roomCount: graph.getAllRooms().length
        });
    }
} 