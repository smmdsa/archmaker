import { IService } from '../interfaces/IService';
import { Point, Wall } from '../../store/ProjectStore';
import { IEventManager } from '../interfaces/IEventManager';
import { ILogger } from '../interfaces/ILogger';

export interface IStoreService extends IService {
    // Wall operations
    addWall(wall: Omit<Wall, 'id'>): string;
    getWall(id: string): Wall | undefined;
    getWalls(): Wall[];
    removeWall(id: string): void;
    updateWall(id: string, updates: Partial<Wall>): void;

    // Subscription
    subscribe(callback: () => void): () => void;
}

export class StoreService implements IStoreService {
    public readonly id = 'store-service';
    
    private walls: Map<string, Wall> = new Map();
    private subscribers: Set<() => void> = new Set();
    private nextWallId = 1;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {}

    public async initialize(): Promise<void> {
        this.logger.info('Store service initialized');
    }

    public async dispose(): Promise<void> {
        this.subscribers.clear();
        this.walls.clear();
        this.logger.info('Store service disposed');
    }

    public addWall(wall: Omit<Wall, 'id'>): string {
        const id = `wall-${this.nextWallId++}`;
        const newWall = { ...wall, id };
        this.walls.set(id, newWall);
        
        this.notifySubscribers();
        this.eventManager.emit('store:wall:added', { wall: newWall });
        
        return id;
    }

    public getWall(id: string): Wall | undefined {
        return this.walls.get(id);
    }

    public getWalls(): Wall[] {
        return Array.from(this.walls.values());
    }

    public removeWall(id: string): void {
        const wall = this.walls.get(id);
        if (wall) {
            this.walls.delete(id);
            this.notifySubscribers();
            this.eventManager.emit('store:wall:removed', { wallId: id });
        }
    }

    public updateWall(id: string, updates: Partial<Wall>): void {
        const wall = this.walls.get(id);
        if (wall) {
            const updatedWall = { ...wall, ...updates };
            this.walls.set(id, updatedWall);
            this.notifySubscribers();
            this.eventManager.emit('store:wall:updated', { wall: updatedWall });
        }
    }

    public subscribe(callback: () => void): () => void {
        this.subscribers.add(callback);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    private notifySubscribers(): void {
        this.subscribers.forEach(callback => callback());
    }
} 