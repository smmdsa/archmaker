import { IStoreService } from '../core/services/StoreService';
import { Wall } from './ProjectStore';

export class StoreService implements IStoreService {
    private walls: Map<string, Wall> = new Map();
    private subscribers: Set<() => void> = new Set();

    async initialize(): Promise<void> {
        // En una implementación real, aquí cargaríamos los datos desde localStorage o el servidor
    }

    addWall(wall: Omit<Wall, 'id'>): string {
        const id = `wall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.walls.set(id, { ...wall, id });
        this.notifySubscribers();
        return id;
    }

    getWall(id: string): Wall | undefined {
        return this.walls.get(id);
    }

    getWalls(): Wall[] {
        return Array.from(this.walls.values());
    }

    removeWall(id: string): void {
        this.walls.delete(id);
        this.notifySubscribers();
    }

    updateWall(id: string, updates: Partial<Wall>): void {
        const wall = this.walls.get(id);
        if (wall) {
            this.walls.set(id, { ...wall, ...updates });
            this.notifySubscribers();
        }
    }

    subscribe(callback: () => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    private notifySubscribers(): void {
        this.subscribers.forEach(callback => callback());
    }
} 