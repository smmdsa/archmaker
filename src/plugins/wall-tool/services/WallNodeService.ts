import { Point } from '../../../core/types/geometry';
import { IWallNode, IWall, WallNodeMap, WallMap } from '../types/WallTypes';
import { v4 as uuidv4 } from 'uuid';

export class WallNodeService {
    private nodes: WallNodeMap = new Map();
    private walls: WallMap = new Map();

    createNode(position: Point): IWallNode {
        const node: IWallNode = {
            id: uuidv4(),
            position,
            connectedWalls: []
        };
        this.nodes.set(node.id, node);
        return node;
    }

    createWall(startNode: IWallNode, endNode: IWallNode, thickness: number = 10, height: number = 280): IWall {
        const wall: IWall = {
            id: uuidv4(),
            startNodeId: startNode.id,
            endNodeId: endNode.id,
            thickness,
            height
        };

        this.walls.set(wall.id, wall);
        
        // Conectar los nodos con el muro
        startNode.connectedWalls.push(wall.id);
        endNode.connectedWalls.push(wall.id);
        
        return wall;
    }

    updateNodePosition(nodeId: string, newPosition: Point): void {
        const node = this.nodes.get(nodeId);
        if (node) {
            node.position = newPosition;
        }
    }

    getNode(nodeId: string): IWallNode | undefined {
        return this.nodes.get(nodeId);
    }

    getWall(wallId: string): IWall | undefined {
        return this.walls.get(wallId);
    }

    getAllNodes(): IWallNode[] {
        return Array.from(this.nodes.values());
    }

    getAllWalls(): IWall[] {
        return Array.from(this.walls.values());
    }

    getConnectedWalls(nodeId: string): IWall[] {
        const node = this.nodes.get(nodeId);
        if (!node) return [];
        
        return node.connectedWalls
            .map(wallId => this.walls.get(wallId))
            .filter((wall): wall is IWall => wall !== undefined);
    }

    deleteNode(nodeId: string): void {
        const node = this.nodes.get(nodeId);
        if (!node) return;

        // Eliminar todos los muros conectados
        node.connectedWalls.forEach(wallId => {
            this.deleteWall(wallId);
        });

        this.nodes.delete(nodeId);
    }

    deleteWall(wallId: string): void {
        const wall = this.walls.get(wallId);
        if (!wall) return;

        // Eliminar referencias en los nodos
        const startNode = this.nodes.get(wall.startNodeId);
        const endNode = this.nodes.get(wall.endNodeId);

        if (startNode) {
            startNode.connectedWalls = startNode.connectedWalls.filter(id => id !== wallId);
        }
        if (endNode) {
            endNode.connectedWalls = endNode.connectedWalls.filter(id => id !== wallId);
        }

        this.walls.delete(wallId);
    }

    clear(): void {
        this.nodes.clear();
        this.walls.clear();
    }
} 