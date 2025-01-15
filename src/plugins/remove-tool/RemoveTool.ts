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
    order: 10,
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
    order: 10,
    shortcut: 'Delete'
})
export class RemoveTool extends BaseTool {
    private readonly selectionStore: SelectionStore;
    private readonly canvasStore: CanvasStore;
    private previousToolId: string | null = null;
    private keydownHandler: (e: KeyboardEvent) => void;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, 'remove-tool', toolManifest);
        this.selectionStore = SelectionStore.getInstance(eventManager, logger);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);

        // Create bound handler for keyboard events
        this.keydownHandler = this.handleKeyDown.bind(this);
    }

    async initialize(): Promise<void> {
        await super.initialize();
        // Add global keyboard event listener
        window.addEventListener('keydown', this.keydownHandler);
    }

    async dispose(): Promise<void> {
        // Remove keyboard event listener
        window.removeEventListener('keydown', this.keydownHandler);
        await super.dispose();
    }

    private async handleKeyDown(e: KeyboardEvent): Promise<void> {
        if (e.key === 'Delete') {
            // Get active tool through event manager
            const activeToolEvent = await new Promise<any>(resolve => {
                this.eventManager.emit('tool:get_active', resolve);
            });

            if (activeToolEvent?.toolId && activeToolEvent.toolId !== 'remove-tool') {
                this.previousToolId = activeToolEvent.toolId;
            }

            await this.removeSelectedObjects();

            // Restore previous tool if it exists
            if (this.previousToolId) {
                await this.eventManager.emit('tool:activate', { toolId: this.previousToolId });
                this.previousToolId = null;
            }
        }
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        // Handle other canvas events if needed in the future
    }

    async activate(): Promise<void> {
        await super.activate();
        await this.removeSelectedObjects();
    }

    private async removeSelectedObjects(): Promise<void> {
        const graph = this.canvasStore.getWallGraph();
        const selectedNodeIds = this.selectionStore.getSelectedNodes();
        const selectedWallIds = this.selectionStore.getSelectedWalls();
        const selectedDoors = this.selectionStore.getSelectedDoors();
        const selectedWindows = this.selectionStore.getSelectedWindows();

        if (selectedNodeIds.size === 0 && selectedWallIds.size === 0 && 
            selectedDoors.size === 0 && selectedWindows.size === 0) {
            this.logger.info('Remove tool: No objects selected');
            return;
        }

        try {
            // First, remove doors and windows as they depend on walls
            selectedDoors.forEach(doorId => {
                const doorStore = this.canvasStore.getDoorStore();
                if (doorStore) {
                    doorStore.removeDoor(doorId);
                    this.eventManager.emit('object:deleted', { objectId: doorId, type: 'door' });
                    this.logger.info('Remove tool: Removed door', { doorId });
                }
            });

            selectedWindows.forEach(windowId => {
                const windowStore = this.canvasStore.getWindowStore();
                if (windowStore) {
                    windowStore.removeWindow(windowId);
                    this.eventManager.emit('object:deleted', { objectId: windowId, type: 'window' });
                    this.logger.info('Remove tool: Removed window', { windowId });
                }
            });

            // Then remove walls, but first collect all affected nodes
            const affectedNodes = new Set<string>();
            selectedWallIds.forEach(wallId => {
                const wall = graph.getWall(wallId);
                if (wall) {
                    const data = wall.getData();
                    affectedNodes.add(data.startNodeId);
                    affectedNodes.add(data.endNodeId);
                }
            });

            // Remove the selected walls
            selectedWallIds.forEach(wallId => {
                const wall = graph.getWall(wallId);
                if (wall) {
                    graph.removeWall(wallId);
                    this.eventManager.emit('object:deleted', { objectId: wallId, type: 'wall' });
                    this.logger.info('Remove tool: Removed wall', { wallId });
                }
            });

            // Handle node removal and wall reconnection
            selectedNodeIds.forEach(nodeId => {
                const node = graph.getNode(nodeId);
                if (node) {
                    const connectedWalls = node.getConnectedWalls();
                    
                    if (connectedWalls.length === 2) {
                        // Node is in the middle of two walls - merge them
                        const [wall1Id, wall2Id] = connectedWalls;
                        const wall1 = graph.getWall(wall1Id);
                        const wall2 = graph.getWall(wall2Id);
                        
                        if (wall1 && wall2) {
                            const wall1Data = wall1.getData();
                            const wall2Data = wall2.getData();
                            
                            // Determine which nodes to connect
                            const otherNode1Id = wall1Data.startNodeId === nodeId ? wall1Data.endNodeId : wall1Data.startNodeId;
                            const otherNode2Id = wall2Data.startNodeId === nodeId ? wall2Data.endNodeId : wall2Data.startNodeId;
                            
                            const otherNode1 = graph.getNode(otherNode1Id);
                            const otherNode2 = graph.getNode(otherNode2Id);
                            
                            if (otherNode1 && otherNode2) {
                                // Create new wall connecting the remaining nodes
                                const newWall = graph.createWall(otherNode1.id, otherNode2.id);
                                
                                // Remove old walls
                                graph.removeWall(wall1Id);
                                graph.removeWall(wall2Id);
                                
                                this.eventManager.emit('object:deleted', { objectId: wall1Id, type: 'wall' });
                                this.eventManager.emit('object:deleted', { objectId: wall2Id, type: 'wall' });
                                this.logger.info('Remove tool: Merged walls', { 
                                    removedWalls: [wall1Id, wall2Id],
                                    newWallId: newWall?.id || null 
                                });
                            }
                        }
                    } else if (connectedWalls.length === 1) {
                        // Node is at the end of a single wall - remove the wall
                        const wallId = connectedWalls[0];
                        graph.removeWall(wallId);
                        this.eventManager.emit('object:deleted', { objectId: wallId, type: 'wall' });
                        this.logger.info('Remove tool: Removed orphaned wall', { wallId });
                    }
                    
                    // Finally remove the node
                    graph.removeNode(nodeId);
                    this.eventManager.emit('object:deleted', { objectId: nodeId, type: 'node' });
                    this.logger.info('Remove tool: Removed node', { nodeId });
                }
            });

            // Clear selection
            this.selectionStore.clearSelection();

            // Update canvas and emit graph changed event
            this.eventManager.emit('graph:changed', {
                nodeCount: graph.getAllNodes().length,
                wallCount: graph.getAllWalls().length,
                doorCount: this.canvasStore.getDoorStore()?.getAllDoors().length || 0,
                windowCount: this.canvasStore.getWindowStore()?.getAllWindows().length || 0
            });


        } catch (error) {
            this.logger.error('Remove tool: Failed to remove objects', error instanceof Error ? error : new Error('Unknown error'));
        }
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