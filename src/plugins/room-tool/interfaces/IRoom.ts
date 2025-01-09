import { Point } from '../../../store/ProjectStore';
import { IWall } from '../../wall-tool/interfaces/IWall';

export interface RoomDrawingState {
    isDrawing: boolean;
    startPoint: Point;
    currentPoint: Point;
    snapPoint: Point | null;
    previewWalls: IWall[];
}

export interface IRoom {
    id: string;
    walls: IWall[];
    startPoint: Point;
    width: number;
    height: number;
    properties: {
        wallThickness: number;
        wallHeight: number;
        name?: string;
        color?: string;
        [key: string]: any;
    };
} 