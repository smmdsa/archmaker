import { Vector2 } from 'three';
import { Wall, WallProperties } from './Wall';
import { WallNode } from './WallNode';
import { IEventManager } from '../../../core/interfaces/IEventManager';

export interface WallIntersection {
    wall: Wall;
    point: Vector2;
    distance: number;
}

export class WallGraph {
    private nodes: Map<string, WallNode>;
    private walls: Map<string, Wall>;
    private eventManager: IEventManager;

    constructor(eventManager: IEventManager) {
        this.nodes = new Map();
        this.walls = new Map();
        this.eventManager = eventManager;
    }

    // Node operations
    addNode(x: number, y: number): WallNode {
        const node = new WallNode(x, y);
        this.nodes.set(node.getId(), node);
        this.emitGraphChanged();
        return node;
    }

    getNode(id: string): WallNode | undefined {
        return this.nodes.get(id);
    }

    removeNode(id: string): void {
        const node = this.nodes.get(id);
        if (!node) return;

        // Remove all connected walls first
        const connectedWalls = node.getConnectedWalls();
        connectedWalls.forEach(wall => {
            this.removeWall(wall.getId());
        });

        this.nodes.delete(id);
        this.emitGraphChanged();
    }

    // Wall operations
    getWall(id: string): Wall | undefined {
        return this.walls.get(id);
    }

    createWall(startNode: WallNode, endNode: WallNode, properties: WallProperties): Wall {
        const wall = new Wall(startNode, endNode, properties);
        this.walls.set(wall.getId(), wall);
        
        // Update node connections with wall references
        startNode.addWall(wall);
        endNode.addWall(wall);
        
        this.emitGraphChanged();
        return wall;
    }

    removeWall(id: string): void {
        const wall = this.walls.get(id);
        if (!wall) return;

        // Remove wall references from nodes
        const startNode = wall.getStartNode();
        const endNode = wall.getEndNode();
        if (startNode) startNode.removeWall(id);
        if (endNode) endNode.removeWall(id);

        this.walls.delete(id);
        this.emitGraphChanged();
    }

    // Graph operations
    private emitGraphChanged(): void {
        this.eventManager.emit('graph:changed', {
            nodeCount: this.nodes.size,
            wallCount: this.walls.size
        });
    }

    findClosestNode(point: Vector2, threshold: number = 10, excludeNode?: WallNode): WallNode | null {
        let closest: WallNode | null = null;
        let minDistance = threshold;

        this.nodes.forEach(node => {
            // Skip the node being moved
            if (excludeNode && node.getId() === excludeNode.getId()) {
                return;
            }
            
            const distance = node.getPosition().distanceTo(point);
            if (distance < minDistance) {
                minDistance = distance;
                closest = node;
            }
        });

        return closest;
    }

    findWallIntersection(point: Vector2, threshold: number = 5): WallIntersection | null {
        let closest: WallIntersection | null = null;
        let minDistance = threshold;

        this.walls.forEach(wall => {
            if (wall.containsPoint(point, threshold)) {
                const distance = point.distanceTo(wall.getStartNode().getPosition());
                if (!closest || distance < minDistance) {
                    closest = {
                        wall,
                        point: point.clone(),
                        distance
                    };
                    minDistance = distance;
                }
            }
        });

        return closest;
    }

    splitWall(wall: Wall, point: Vector2): { node: WallNode; walls: [Wall, Wall] } {
        const result = wall.split(point);
        
        // Remove the original wall
        this.removeWall(wall.getId());
        
        // Add the new node and walls to the graph
        this.nodes.set(result.node.getId(), result.node);
        this.walls.set(result.walls[0].getId(), result.walls[0]);
        this.walls.set(result.walls[1].getId(), result.walls[1]);
        
        return result;
    }

    getAllNodes(): WallNode[] {
        return Array.from(this.nodes.values());
    }

    getAllWalls(): Wall[] {
        return Array.from(this.walls.values());
    }

    clear(): void {
        this.nodes.clear();
        this.walls.clear();
    }
} 