import { Point } from '../../../core/types/geometry';
import { IWall } from '../types/WallInterfaces';

export interface WallCreationParams {
    startPoint: Point;
    endPoint: Point;
    thickness?: number;
    height?: number;
    properties?: Partial<IWall['properties']>;
}

export interface IWallService {
    // Wall management
    createWall(params: WallCreationParams): Promise<IWall>;
    updateWall(wallId: string, updates: Partial<IWall>): Promise<IWall>;
    deleteWall(wallId: string): Promise<void>;
    getWall(wallId: string): IWall | undefined;
    getAllWalls(): IWall[];

    // Snapping
    getSnapPoints(): Point[];
    getNearestSnapPoint(point: Point, threshold: number): Point | null;
    
    // Events
    onWallCreated(callback: (wall: IWall) => void): () => void;
    onWallUpdated(callback: (wall: IWall) => void): () => void;
    onWallDeleted(callback: (wallId: string) => void): () => void;
} 