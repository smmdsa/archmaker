import { v4 as uuidv4 } from 'uuid';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { Point } from '../../../core/types/geometry';
import { NodeObject } from '../objects/NodeObject';
import { WallObject } from '../objects/WallObject';
import { RoomObject } from '../../room-tool/objects/RoomObject';

export class WallGraph {
    private nodes: Map<string, NodeObject> = new Map();
    private walls: Map<string, WallObject> = new Map();
    private rooms: Map<string, RoomObject> = new Map();

    constructor(private readonly eventManager: IEventManager) {}

    // Node methods
    createNode(position: Point): NodeObject {
        const id = uuidv4();
        const node = new NodeObject(id, position);
        this.nodes.set(id, node);
        
        this.eventManager.emit('graph:changed', {
            nodeCount: this.nodes.size,
            wallCount: this.walls.size,
            roomCount: this.rooms.size
        });
        
        return node;
    }

    getNode(id: string): NodeObject | undefined {
        return this.nodes.get(id);
    }

    getAllNodes(): NodeObject[] {
        return Array.from(this.nodes.values());
    }

    removeNode(id: string): void {
        const node = this.nodes.get(id);
        if (!node) return;

        // Remove connected walls first
        const connectedWalls = node.getConnectedWalls();
        connectedWalls.forEach(wallId => this.removeWall(wallId));

        this.nodes.delete(id);
        
        this.eventManager.emit('graph:changed', {
            nodeCount: this.nodes.size,
            wallCount: this.walls.size,
            roomCount: this.rooms.size
        });
    }

    // Wall methods
    createWall(startNodeId: string, endNodeId: string): WallObject | null {
        const startNode = this.nodes.get(startNodeId);
        const endNode = this.nodes.get(endNodeId);
        
        if (!startNode || !endNode) return null;

        const id = uuidv4();
        const wall = new WallObject(
            id,
            startNodeId,
            endNodeId,
            startNode.position,
            endNode.position
        );

        this.walls.set(id, wall);
        
        // Update node connections
        startNode.addConnectedWall(id);
        endNode.addConnectedWall(id);

        this.eventManager.emit('wall:created', { wall });
        this.eventManager.emit('graph:changed', {
            nodeCount: this.nodes.size,
            wallCount: this.walls.size,
            roomCount: this.rooms.size
        });

        return wall;
    }

    getWall(id: string): WallObject | undefined {
        return this.walls.get(id);
    }

    getAllWalls(): WallObject[] {
        return Array.from(this.walls.values());
    }

    removeWall(id: string): void {
        const wall = this.walls.get(id);
        if (!wall) return;

        // Get wall data before removal
        const { startNodeId, endNodeId } = wall.getData();
        
        // Remove wall from nodes
        const startNode = this.nodes.get(startNodeId);
        const endNode = this.nodes.get(endNodeId);
        
        startNode?.removeConnectedWall(id);
        endNode?.removeConnectedWall(id);

        this.walls.delete(id);
        
        this.eventManager.emit('wall:deleted', { wallId: id });
        this.eventManager.emit('graph:changed', {
            nodeCount: this.nodes.size,
            wallCount: this.walls.size,
            roomCount: this.rooms.size
        });
    }

    // Room methods
    addRoom(room: RoomObject): void {
        this.rooms.set(room.id, room);
        
        this.eventManager.emit('room:created', { room });
        this.eventManager.emit('graph:changed', {
            nodeCount: this.nodes.size,
            wallCount: this.walls.size,
            roomCount: this.rooms.size
        });
    }

    getRoom(id: string): RoomObject | undefined {
        return this.rooms.get(id);
    }

    getAllRooms(): RoomObject[] {
        return Array.from(this.rooms.values());
    }

    removeRoom(id: string): void {
        const room = this.rooms.get(id);
        if (!room) return;

        this.rooms.delete(id);
        
        this.eventManager.emit('room:deleted', { roomId: id });
        this.eventManager.emit('graph:changed', {
            nodeCount: this.nodes.size,
            wallCount: this.walls.size,
            roomCount: this.rooms.size
        });
    }

    // Query methods
    getConnectedWalls(nodeId: string): WallObject[] {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        return node.getConnectedWalls()
            .map(wallId => this.walls.get(wallId))
            .filter((wall): wall is WallObject => wall !== undefined);
    }

    getConnectedNodes(nodeId: string): NodeObject[] {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        const connectedNodes = new Set<NodeObject>();
        
        node.getConnectedWalls().forEach(wallId => {
            const wall = this.walls.get(wallId);
            if (wall) {
                const { startNodeId, endNodeId } = wall.getData();
                if (startNodeId !== nodeId) {
                    const startNode = this.nodes.get(startNodeId);
                    if (startNode) connectedNodes.add(startNode);
                }
                if (endNodeId !== nodeId) {
                    const endNode = this.nodes.get(endNodeId);
                    if (endNode) connectedNodes.add(endNode);
                }
            }
        });

        return Array.from(connectedNodes);
    }

    clear(): void {
        this.nodes.clear();
        this.walls.clear();
        this.rooms.clear();
        
        this.eventManager.emit('graph:changed', {
            nodeCount: 0,
            wallCount: 0,
            roomCount: 0
        });
    }
} 