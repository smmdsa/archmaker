import { Point } from '../../../core/types/geometry';

export interface WallProperties {
    height: number;
    thickness: number;
    material: string;
    startPoint: Point;
    endPoint: Point;
}

export interface Wall extends WallProperties {
    id: string;
    length: number;
    angle: number;
}

export type WallUpdateProperties = Partial<WallProperties>;

export interface WallDrawingState {
    isDrawing: boolean;
    startPoint: Point | null;
    currentEndPoint: Point | null;
}

export interface WallEvents {
    'wall:created': { wall: Wall };
    'wall:updated': { wallId: string; properties: WallUpdateProperties };
    'wall:deleted': { wallId: string };
    'wall:selected': { wallId: string };
    'wall:drawing:start': { point: Point };
    'wall:drawing:update': { startPoint: Point; endPoint: Point };
    'wall:drawing:finish': { startPoint: Point; endPoint: Point };
    'wall:drawing:cancel': void;
    'wall:tool:activated': { toolId: string };
    'wall:tool:deactivated': { toolId: string };
} 