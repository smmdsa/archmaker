import { Wall } from '../../store/ProjectStore';

export interface IStoreService {
    id: string;
    addWall(wall: Omit<Wall, 'id'>): string;
    getWall(id: string): Wall | undefined;
    getWalls(): Wall[];
    removeWall(id: string): void;
    updateWall(id: string, updates: Partial<Wall>): void;
    subscribe(callback: () => void): () => void;
    initialize(): Promise<void>;
    dispose(): Promise<void>;
} 