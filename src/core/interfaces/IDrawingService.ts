import { Point } from '../types/geometry';

export interface DrawingCreationParams {
    startPoint: Point;
    endPoint?: Point;
    height: number;
    thickness?: number;
    properties?: {
        material?: string;
        color?: string;
        [key: string]: any;
    };
}

export interface IDrawingService<T> {
    initialize(): Promise<void>;
    dispose(): Promise<void>;
    create(params: DrawingCreationParams): Promise<T>;
    update(id: string, updates: Partial<T>): Promise<T>;
    delete(id: string): Promise<void>;
    get(id: string): T | undefined;
    getAll(): T[];
    getSnapPoints(): Point[];
    getNearestSnapPoint(point: Point, threshold: number): Point | null;
} 