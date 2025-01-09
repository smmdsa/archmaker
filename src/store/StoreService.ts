import { IStoreService } from '../core/interfaces/IStoreService';
import { Wall } from './ProjectStore';

export class StoreService implements IStoreService {
    public readonly id: string = 'store-service';
    private walls: Map<string, Wall> = new Map();
    private subscribers: Array<() => void> = [];
    private nextId: number = 1;

    public async initialize(): Promise<void> {
        // Inicialización asíncrona del servicio si es necesario
        await Promise.resolve();
    }

    public async dispose(): Promise<void> {
        // Limpieza asíncrona de recursos si es necesario
        this.subscribers = [];
        this.walls.clear();
        await Promise.resolve();
    }

    public addWall(wall: Omit<Wall, 'id'>): string {
        const id = `wall_${this.nextId++}`;
        this.walls.set(id, { ...wall, id });
        this.notifySubscribers();
        return id;
    }

    public getWall(id: string): Wall | undefined {
        return this.walls.get(id);
    }

    public getWalls(): Wall[] {
        return Array.from(this.walls.values());
    }

    public removeWall(id: string): void {
        this.walls.delete(id);
        this.notifySubscribers();
    }

    public updateWall(id: string, updates: Partial<Wall>): void {
        const wall = this.walls.get(id);
        if (wall) {
            this.walls.set(id, { ...wall, ...updates });
            this.notifySubscribers();
        }
    }

    public subscribe(callback: () => void): () => void {
        this.subscribers.push(callback);
        return () => {
            const index = this.subscribers.indexOf(callback);
            if (index > -1) {
                this.subscribers.splice(index, 1);
            }
        };
    }

    private notifySubscribers(): void {
        this.subscribers.forEach(callback => callback());
    }
} 