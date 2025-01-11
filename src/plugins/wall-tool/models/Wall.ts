import { Vector2 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import { IWall, IWallNode, IWallProperties } from './interfaces';
import { WallNode } from './WallNode';

export class Wall implements IWall {
    private readonly id: string;
    private startNode: IWallNode;
    private endNode: IWallNode;
    private properties: IWallProperties;
    private direction: Vector2;

    constructor(startNode: IWallNode, endNode: IWallNode, properties: IWallProperties) {
        this.id = uuidv4();
        this.startNode = startNode;
        this.endNode = endNode;
        this.properties = { ...properties };
        this.direction = this.calculateDirection();
    }

    getId(): string {
        return this.id;
    }

    getStartNode(): IWallNode {
        return this.startNode;
    }

    getEndNode(): IWallNode {
        return this.endNode;
    }

    getProperties(): IWallProperties {
        return this.properties;
    }

    updateProperties(props: IWallProperties): void {
        this.properties = { ...this.properties, ...props };
    }

    getDirection(): Vector2 {
        return this.direction.clone();
    }

    getLength(): number {
        return this.startNode.getPosition().distanceTo(this.endNode.getPosition());
    }

    updateNodePosition(node: IWallNode): void {
        if (node !== this.startNode && node !== this.endNode) {
            throw new Error('Node is not part of this wall');
        }
        
        // Update direction after node position change
        this.direction = this.calculateDirection();
    }

    split(point: Vector2): { node: IWallNode; walls: [Wall, Wall] } {
        const newNode = new WallNode(point.x, point.y);
        
        const wall1 = new Wall(this.startNode, newNode, this.properties);
        const wall2 = new Wall(newNode, this.endNode, this.properties);

        return {
            node: newNode,
            walls: [wall1, wall2]
        };
    }

    containsPoint(point: Vector2, threshold: number = 5): boolean {
        const start = this.startNode.getPosition();
        const end = this.endNode.getPosition();
        
        const length = this.getLength();
        if (length === 0) return false;

        const d = new Vector2()
            .subVectors(end, start)
            .normalize();
        const v = new Vector2()
            .subVectors(point, start);
        
        const t = v.dot(d);
        
        if (t < 0 || t > length) return false;
        
        const projection = start.clone().add(d.multiplyScalar(t));
        return point.distanceTo(projection) <= threshold;
    }

    private calculateDirection(): Vector2 {
        const start = this.startNode.getPosition();
        const end = this.endNode.getPosition();
        return new Vector2()
            .subVectors(end, start)
            .normalize();
    }
} 