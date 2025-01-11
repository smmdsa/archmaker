import { Point } from '../../../store/ProjectStore';

export interface WallProperties {
    thickness: number;
    height: number;
    material?: string;
    color?: string;
    layer?: string;
    metadata?: Record<string, unknown>;
}

export interface IWall {
    id: string;
    startPoint: Point;
    endPoint: Point;
    thickness: number;
    height: number;
    properties: WallProperties;
}

export interface WallDrawingState {
    isDrawing: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
    snapPoint: Point | null;
    previewWall?: Partial<IWall>;
} 