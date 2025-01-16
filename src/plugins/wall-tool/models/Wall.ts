import { v4 as uuidv4 } from 'uuid';
import { Point } from '../../../core/types/geometry';
import { IWall, WallProperties } from '../types/WallInterfaces';

export class Wall implements IWall {
    public readonly id: string;
    public startNodeId: string;
    public endNodeId: string;
    public startPoint: Point;
    public endPoint: Point;
    public thickness: number;
    public height: number;
    public properties: WallProperties;

    constructor(
        startNodeId: string,
        endNodeId: string,
        startPoint: Point,
        endPoint: Point,
        thickness: number = 10,
        height: number = 280,
        properties: Partial<WallProperties> = {}
    ) {
        this.id = uuidv4();
        this.startNodeId = startNodeId;
        this.endNodeId = endNodeId;
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.thickness = thickness;
        this.height = height;
        this.properties = {
            thickness,
            height,
            ...properties
        };
    }
} 