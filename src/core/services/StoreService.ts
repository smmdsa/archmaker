import { Wall } from '../../store/ProjectStore';

export interface IStoreService {
    initialize(): Promise<void>;
    addWall(wall: Omit<Wall, 'id'>): string;
    getWall(id: string): Wall | undefined;
    getWalls(): Wall[];
    removeWall(id: string): void;
    updateWall(id: string, updates: Partial<Wall>): void;
    subscribe(callback: () => void): () => void;
} 