import { Point } from '../../../core/types/geometry';
import { NodeObject } from '../objects/NodeObject';
import { WallObject } from '../objects/WallObject';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { v4 as uuidv4 } from 'uuid';
import { CanvasStore } from '../../../store/CanvasStore';

export class WallCommandService {
    private readonly canvasStore: CanvasStore;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    // Commands that match the existing behavior
    async createWall(startNode: NodeObject, endNode: NodeObject, properties?: any): Promise<WallObject> {
        try {
            const wall = new WallObject(
                uuidv4(),
                startNode.id,
                endNode.id,
                startNode.position,
                endNode.position,
                this.eventManager,
                properties?.thickness || 10,
                properties?.height || 280
            );

            // Add wall to graph
            this.canvasStore.getWallGraph().addWall(wall);

            // Maintain existing connections
            startNode.addConnectedWall(wall.id);
            endNode.addConnectedWall(wall.id);

            this.logger.info('Wall created', { 
                wallId: wall.id,
                startNodeId: startNode.id,
                endNodeId: endNode.id
            });

            await this.eventManager.emit('wall:created', { wall });

            // Emit graph changed event
            await this.eventManager.emit('graph:changed', {
                nodeCount: this.canvasStore.getWallGraph().getAllNodes().length,
                wallCount: this.canvasStore.getWallGraph().getAllWalls().length,
                roomCount: 0,
                doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
                windowCount: this.canvasStore.getWindowStore().getAllWindows().length
            });

            return wall;
        } catch (error) {
            this.logger.error('Failed to create wall', error as Error);
            throw error;
        }
    }

    async updateWall(wall: WallObject, updates: Partial<any>): Promise<void> {
        try {
            wall.updateProperties(updates);
            
            this.logger.info('Wall updated', { 
                wallId: wall.id,
                updates 
            });

            await this.eventManager.emit('wall:updated', { wall });
        } catch (error) {
            this.logger.error('Failed to update wall', error as Error);
            throw error;
        }
    }

    async deleteWall(wall: WallObject): Promise<void> {
        try {
            // Store wall ID before disposal
            const wallId = wall.id;

            // Remove wall from connected nodes first
            wall.startNode?.removeConnectedWall(wall.id);
            wall.endNode?.removeConnectedWall(wall.id);

            // Remove wall from graph
            this.canvasStore.getWallGraph().removeWall(wallId);

            // Dispose the wall
            wall.dispose();

            this.logger.info('Wall deleted', { wallId });
            await this.eventManager.emit('wall:deleted', { wallId });

            // Emit graph changed event
            await this.eventManager.emit('graph:changed', {
                nodeCount: this.canvasStore.getWallGraph().getAllNodes().length,
                wallCount: this.canvasStore.getWallGraph().getAllWalls().length,
                roomCount: 0,
                doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
                windowCount: this.canvasStore.getWindowStore().getAllWindows().length
            });
        } catch (error) {
            this.logger.error('Failed to delete wall', error as Error);
            throw error;
        }
    }

    async createNode(position: Point): Promise<NodeObject> {
        try {
            const node = new NodeObject(
                uuidv4(), // Generate a unique ID for the node
                position
            );

            // Add node to graph
            this.canvasStore.getWallGraph().addNode(node);
            
            this.logger.info('Node created', { 
                nodeId: node.id,
                position 
            });

            await this.eventManager.emit('node:created', { node });

            // Emit graph changed event
            await this.eventManager.emit('graph:changed', {
                nodeCount: this.canvasStore.getWallGraph().getAllNodes().length,
                wallCount: this.canvasStore.getWallGraph().getAllWalls().length,
                roomCount: 0,
                doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
                windowCount: this.canvasStore.getWindowStore().getAllWindows().length
            });

            return node;
        } catch (error) {
            this.logger.error('Failed to create node', error as Error);
            throw error;
        }
    }

    async updateNode(node: NodeObject, newPosition: Point): Promise<void> {
        try {
            // Update node position
            node.setPosition(newPosition.x, newPosition.y);

            // Update all connected walls
            const connectedWalls = node.getConnectedWalls();
            for (const wallId of connectedWalls) {
                const wall = this.canvasStore.getWallGraph().getWall(wallId);
                if (wall) {
                    // Update the appropriate wall endpoint based on which node it is
                    if (wall.getStartNodeId() === node.id) {
                        wall.updateStartPoint(newPosition);
                    } else if (wall.getEndNodeId() === node.id) {
                        wall.updateEndPoint(newPosition);
                    }
                    await this.eventManager.emit('wall:updated', { wall });
                }
            }

            this.logger.info('Node updated', { 
                nodeId: node.id,
                position: newPosition 
            });

            await this.eventManager.emit('node:updated', { node });
        } catch (error) {
            this.logger.error('Failed to update node', error as Error);
            throw error;
        }
    }

    async deleteNode(node: NodeObject): Promise<void> {
        try {
            // Store node ID before disposal
            const nodeId = node.id;

            // Remove all connected walls first
            const connectedWalls = [...node.getConnectedWalls()];
            for (const wallId of connectedWalls) {
                const wall = this.canvasStore.getWallGraph().getWall(wallId);
                if (wall) {
                    await this.deleteWall(wall);
                }
            }

            // Remove node from graph
            this.canvasStore.getWallGraph().removeNode(nodeId);

            // Dispose the node
            node.dispose();

            this.logger.info('Node deleted', { nodeId });
            await this.eventManager.emit('node:deleted', { nodeId });

            // Emit graph changed event
            await this.eventManager.emit('graph:changed', {
                nodeCount: this.canvasStore.getWallGraph().getAllNodes().length,
                wallCount: this.canvasStore.getWallGraph().getAllWalls().length,
                roomCount: 0,
                doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
                windowCount: this.canvasStore.getWindowStore().getAllWindows().length
            });
        } catch (error) {
            this.logger.error('Failed to delete node', error as Error);
            throw error;
        }
    }

    async mergeNodes(sourceNode: NodeObject, targetNode: NodeObject): Promise<void> {
        try {
            // Get all walls connected to source node
            const connectedWalls = sourceNode.getConnectedWalls();
            const graph = this.canvasStore.getWallGraph();
            
            // Transfer connections to target node
            for (const wallId of connectedWalls) {
                const wall = graph.getWall(wallId);
                if (!wall) continue;

                const wallData = wall.getData();
                
                // Get the nodes from the graph
                const startNode = graph.getNode(wallData.startNodeId);
                const endNode = graph.getNode(wallData.endNodeId);
                
                if (!startNode || !endNode) {
                    this.logger.error('Failed to find wall nodes during merge', { wallId });
                    continue;
                }

                if (wallData.startNodeId === sourceNode.id) {
                    await this.createWall(targetNode, endNode, {
                        thickness: wallData.thickness,
                        height: wallData.height
                    });
                } else if (wallData.endNodeId === sourceNode.id) {
                    await this.createWall(startNode, targetNode, {
                        thickness: wallData.thickness,
                        height: wallData.height
                    });
                }
                await this.deleteWall(wall);
            }

            // Delete the source node
            await this.deleteNode(sourceNode);

            this.logger.info('Nodes merged', {
                sourceNodeId: sourceNode.id,
                targetNodeId: targetNode.id
            });

            await this.eventManager.emit('nodes:merged', {
                sourceNodeId: sourceNode.id,
                targetNodeId: targetNode.id
            });

            // Emit graph changed event
            await this.eventManager.emit('graph:changed', {
                nodeCount: graph.getAllNodes().length,
                wallCount: graph.getAllWalls().length,
                roomCount: 0,
                doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
                windowCount: this.canvasStore.getWindowStore().getAllWindows().length
            });
        } catch (error) {
            this.logger.error('Failed to merge nodes', error as Error);
            throw error;
        }
    }
} 