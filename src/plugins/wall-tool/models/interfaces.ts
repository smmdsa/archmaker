import { Vector2 } from 'three';

export interface IWallProperties {
    thickness: number;
    height: number;
    material?: string;
}

export interface IWallNode {
    getId(): string;
    getPosition(): Vector2;
    setPosition(x: number, y: number): void;
    addWall(wall: IWall): void;
    removeWall(wallId: string): void;
    getConnectedWalls(): IWall[];
}

export interface IWall {
    getId(): string;
    getProperties(): IWallProperties;
    updateNodePosition(node: IWallNode): void;
} 