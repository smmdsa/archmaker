import { Point } from '../types/geometry';

export enum SelectableObjectType {
    NODE = 'node',
    WALL = 'wall',
    ROOM = 'room',
    DOOR = 'door',
    WINDOW = 'window'
}

export interface ISelectableObject {
    id: string;
    type: SelectableObjectType;
    position: Point;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    isSelected: boolean;
    isHighlighted: boolean;
    containsPoint(point: Point): boolean;
    setSelected(selected: boolean): void;
    setHighlighted(highlighted: boolean): void;
} 