import { Point } from '../types/geometry';
import { IDrawingProperties } from '../tools/interfaces/IDrawingProperties';

export interface DrawingEventBase {
    toolId: string;
    timestamp: number;
}

export interface DrawingStartEvent extends DrawingEventBase {
    type: 'drawing:start';
    point: Point;
}

export interface DrawingUpdateEvent extends DrawingEventBase {
    type: 'drawing:update';
    startPoint: Point;
    currentPoint: Point;
}

export interface DrawingFinishEvent extends DrawingEventBase {
    type: 'drawing:finish';
    startPoint: Point;
    endPoint: Point;
    properties: IDrawingProperties;
}

export interface DrawingCancelEvent extends DrawingEventBase {
    type: 'drawing:cancel';
}

export type DrawingEvent = 
    | DrawingStartEvent 
    | DrawingUpdateEvent 
    | DrawingFinishEvent 
    | DrawingCancelEvent; 