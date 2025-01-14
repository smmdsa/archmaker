import { Vector2 } from 'three';
import { v4 as uuidv4 } from 'uuid';
import { IWall, IWallNode } from './interfaces';

export class WallNode implements IWallNode {
    private readonly id: string;
    private position: Vector2;
    private connectedWalls: Map<string, IWall>;

    constructor(x: number, y: number) {
        this.id = uuidv4();
        const validX = Number.isFinite(x) ? Math.round(x) : 0;
        const validY = Number.isFinite(y) ? Math.round(y) : 0;
        this.position = new Vector2(validX, validY);
        this.connectedWalls = new Map();
    }

    getId(): string {
        return this.id;
    }

    getPosition(): Vector2 {
        return this.position.clone();
    }

    setPosition(x: number, y: number): void {
        const validX = Number.isFinite(x) ? Math.round(x) : this.position.x;
        const validY = Number.isFinite(y) ? Math.round(y) : this.position.y;
        this.position.set(validX, validY);

        this.connectedWalls.forEach(wall => {
            wall.updateNodePosition(this);
        });
    }

    addWall(wall: IWall): void {
        this.connectedWalls.set(wall.getId(), wall);
    }

    removeWall(wallId: string): void {
        this.connectedWalls.delete(wallId);
    }

    getConnectedWalls(): IWall[] {
        return Array.from(this.connectedWalls.values());
    }

    getConnectedWallIds(): string[] {
        return Array.from(this.connectedWalls.keys());
    }

    isConnectedToWall(wallId: string): boolean {
        return this.connectedWalls.has(wallId);
    }

    getConnectionCount(): number {
        return this.connectedWalls.size;
    }
} 