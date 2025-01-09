import { IStoreService } from '../core/services/StoreService';

export interface Point {
    x: number;
    y: number;
}

export interface Wall {
    id: string;
    startPoint: Point;
    endPoint: Point;
    height: number;
    thickness: number;
    material: string;
}

export class ProjectStore {
    constructor(private readonly storeService: IStoreService) {
        if (!storeService) {
            throw new Error('StoreService is required for ProjectStore initialization');
        }
    }

    public addWall(wall: Omit<Wall, 'id'>): string {
        return this.storeService.addWall(wall);
    }

    public getWall(id: string): Wall | undefined {
        return this.storeService.getWall(id);
    }

    public getWalls(): Wall[] {
        return this.storeService.getWalls();
    }

    public removeWall(id: string): void {
        this.storeService.removeWall(id);
    }

    public updateWall(id: string, updates: Partial<Wall>): void {
        this.storeService.updateWall(id, updates);
    }

    public subscribe(callback: () => void): () => void {
        if (!this.storeService || !this.storeService.subscribe) {
            throw new Error('StoreService or subscribe method is not available');
        }
        return this.storeService.subscribe(callback);
    }
} 