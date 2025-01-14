import { ISelectableObject, SelectableObjectType } from '../interfaces/ISelectableObject';
import { Point } from '../types/geometry';

export abstract class BaseObject implements ISelectableObject {
    protected _isSelected: boolean = false;
    protected _isHighlighted: boolean = false;

    constructor(
        public readonly id: string,
        public readonly type: SelectableObjectType,
        protected _position: Point,
        protected _bounds: { x: number; y: number; width: number; height: number }
    ) {}

    get position(): Point {
        return { ...this._position };
    }

    get bounds() {
        return { ...this._bounds };
    }

    get isSelected(): boolean {
        return this._isSelected;
    }

    get isHighlighted(): boolean {
        return this._isHighlighted;
    }

    setSelected(selected: boolean): void {
        this._isSelected = selected;
    }

    setHighlighted(highlighted: boolean): void {
        this._isHighlighted = highlighted;
    }

    containsPoint(point: Point): boolean {
        return point.x >= this._bounds.x &&
               point.x <= this._bounds.x + this._bounds.width &&
               point.y >= this._bounds.y &&
               point.y <= this._bounds.y + this._bounds.height;
    }

    intersectsRect(rect: { x: number; y: number; width: number; height: number }): boolean {
        return !(rect.x > this._bounds.x + this._bounds.width ||
                rect.x + rect.width < this._bounds.x ||
                rect.y > this._bounds.y + this._bounds.height ||
                rect.y + rect.height < this._bounds.y);
    }

    abstract render(layer: any): void;
    abstract getData(): Record<string, any>;
} 