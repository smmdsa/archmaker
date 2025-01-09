import { Wall as StoreWall, Point } from '../../../store/ProjectStore';
import { Wall, WallUpdateProperties } from '../types/wall';

export interface IWallStoreAdapter {
    convertToWall(storeWall: StoreWall): Wall;
    convertToStoreWall(wall: Wall): Omit<StoreWall, 'id'>;
    convertProperties(properties: WallUpdateProperties): Partial<StoreWall>;
    convertPoint(point: Point): Point;
}

export class WallStoreAdapter implements IWallStoreAdapter {
    constructor(private readonly defaultMaterial: string = 'default') {}

    public convertToWall(storeWall: StoreWall): Wall {
        return {
            id: storeWall.id,
            startPoint: storeWall.start,
            endPoint: storeWall.end,
            height: storeWall.height,
            thickness: storeWall.thickness,
            material: this.defaultMaterial,
            length: this.calculateLength(storeWall.start, storeWall.end),
            angle: this.calculateAngle(storeWall.start, storeWall.end)
        };
    }

    public convertToStoreWall(wall: Wall): Omit<StoreWall, 'id'> {
        return {
            start: wall.startPoint,
            end: wall.endPoint,
            height: wall.height,
            thickness: wall.thickness
        };
    }

    public convertProperties(properties: WallUpdateProperties): Partial<StoreWall> {
        const result: Partial<StoreWall> = {};

        if (properties.startPoint) result.start = properties.startPoint;
        if (properties.endPoint) result.end = properties.endPoint;
        if (properties.height) result.height = properties.height;
        if (properties.thickness) result.thickness = properties.thickness;

        return result;
    }

    public convertPoint(point: Point): Point {
        return { x: point.x, y: point.y };
    }

    private calculateLength(start: Point, end: Point): number {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private calculateAngle(start: Point, end: Point): number {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return Math.atan2(dy, dx);
    }
} 