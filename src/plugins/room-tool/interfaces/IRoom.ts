import { Point } from '../../../core/types/geometry';

export interface IRoomProperties {
    material: string;
    color: string;
    [key: string]: any;
}

export interface IRoom {
    id: string;
    points: Point[];
    height: number;
    properties: IRoomProperties;
} 