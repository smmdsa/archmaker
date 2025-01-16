import { Vector2 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import { Point } from '../../../core/types/geometry';
import { IWall, IWallNode, IWallConnection, IWallNodeMetadata } from '../types/WallInterfaces';

export class WallNode implements IWallNode {
    public readonly id: string;
    public position: Point;
    public connectedNodes: Map<string, IWallConnection>;
    public metadata: IWallNodeMetadata;
    private connectedWalls: Map<string, IWall>;

    constructor(x: number, y: number) {
        this.id = uuidv4();
        this.position = { x, y };
        this.connectedNodes = new Map();
        this.connectedWalls = new Map();
        this.metadata = {
            isCorner: false,
            isIntersection: false,
            isEndpoint: false
        };
    }

    getId(): string {
        return this.id;
    }

    getPosition(): Vector2 {
        return new Vector2(this.position.x, this.position.y);
    }

    setPosition(x: number, y: number): void {
        this.position = { x, y };
        // Update connected walls
        for (const wall of this.connectedWalls.values()) {
            if (wall.startNodeId === this.id) {
                wall.startPoint = this.position;
            } else if (wall.endNodeId === this.id) {
                wall.endPoint = this.position;
            }
        }
    }

    addWall(wall: IWall): void {
        this.connectedWalls.set(wall.id, wall);
    }

    removeWall(wallId: string): void {
        this.connectedWalls.delete(wallId);
    }

    getConnectedWalls(): IWall[] {
        return Array.from(this.connectedWalls.values());
    }
} 