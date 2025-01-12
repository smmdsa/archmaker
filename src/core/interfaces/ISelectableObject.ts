import { Point } from '../types/geometry';

export enum SelectableObjectType {
    NODE = 'node',
    WALL = 'wall',
    DOOR = 'door',
    // Future types can be added here
}

export interface ISelectableObject {
    id: string;
    type: SelectableObjectType;
    position: Point;  // Center position of the object
    bounds: {         // For hit testing and selection rectangle
        x: number;
        y: number;
        width: number;
        height: number;
    };
    
    // Visual state
    isSelected: boolean;
    isHighlighted: boolean;
    
    // Common methods
    setSelected(selected: boolean): void;
    setHighlighted(highlighted: boolean): void;
    containsPoint(point: Point): boolean;
    intersectsRect(rect: { x: number; y: number; width: number; height: number }): boolean;
    
    // For rendering
    render(layer: any): void;  // 'any' for now, we'll type this properly later
    
    // For object-specific data
    getData(): Record<string, any>;
} 