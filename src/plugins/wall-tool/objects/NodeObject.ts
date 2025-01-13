import { BaseObject } from '../../../core/objects/BaseObject';
import { SelectableObjectType } from '../../../core/interfaces/ISelectableObject';
import { Point } from '../../../core/types/geometry';
import { Layer } from 'konva/lib/Layer';
import { Circle } from 'konva/lib/shapes/Circle';

interface NodeData {
    connectedWallIds: string[];
    radius: number;
    isMovable: boolean;
}

export class NodeObject extends BaseObject {
    private readonly connectedWallIds: Set<string> = new Set();
    private readonly radius: number;
    private nodeCircle: Circle | null = null;
    private readonly isMovable: boolean;

    // Visual styles
    private readonly styles = {
        normal: {
            fill: '#ffffff',
            stroke: '#333333',
            strokeWidth: 2
        },
        selected: {
            fill: '#e3f2fd',
            stroke: '#2196f3',
            strokeWidth: 2
        },
        immovable: {
            fill: '#f5f5f5',
            stroke: '#9e9e9e',
            strokeWidth: 2
        }
    };

    constructor(
        id: string,
        position: Point,
        radius: number = 5,
        isMovable: boolean = true
    ) {
        // Calculate bounds based on radius
        const bounds = {
            x: position.x - radius,
            y: position.y - radius,
            width: radius * 2,
            height: radius * 2
        };

        super(
            id,
            SelectableObjectType.NODE,
            position,
            bounds
        );

        this.radius = radius;
        this.isMovable = isMovable;
    }

    render(layer: Layer): void {
        // Cleanup old circle if it exists and is not in the current layer
        if (this.nodeCircle && this.nodeCircle.getLayer() !== layer) {
            this.nodeCircle.destroy();
            this.nodeCircle = null;
        }

        let style;
        if (!this.isMovable) {
            style = this.styles.immovable;
        } else {
            style = this._isSelected ? this.styles.selected : this.styles.normal;
        }

        // Create or update node circle
        if (!this.nodeCircle) {
            this.nodeCircle = new Circle({
                x: this.position.x,
                y: this.position.y,
                radius: this.radius,
                fill: style.fill,
                stroke: style.stroke,
                strokeWidth: style.strokeWidth,
                name: `node-${this.id}`
            });
            layer.add(this.nodeCircle);
        } else {
            // Update existing circle
            this.nodeCircle.position({
                x: this.position.x,
                y: this.position.y
            });
            this.nodeCircle.fill(style.fill);
            this.nodeCircle.stroke(style.stroke);
            this.nodeCircle.strokeWidth(style.strokeWidth);
        }
    }

    getData(): NodeData {
        return {
            connectedWallIds: Array.from(this.connectedWallIds),
            radius: this.radius,
            isMovable: this.isMovable
        };
    }

    // Node-specific methods
    addConnectedWall(wallId: string): void {
        this.connectedWallIds.add(wallId);
    }

    removeConnectedWall(wallId: string): void {
        this.connectedWallIds.delete(wallId);
    }

    getConnectedWalls(): string[] {
        return Array.from(this.connectedWallIds);
    }

    setPosition(x: number, y: number): void {
        if (!this.isMovable) {
            return; // Early return if node is not movable
        }

        this._position = { x, y };
        // Update bounds
        this._bounds = {
            x: x - this.radius,
            y: y - this.radius,
            width: this.radius * 2,
            height: this.radius * 2
        };
        // Update visual if exists
        if (this.nodeCircle) {
            this.nodeCircle.position({ x, y });
        }
    }

    // Override containsPoint for precise circle hit detection
    containsPoint(point: Point): boolean {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        return (dx * dx + dy * dy) <= (this.radius * this.radius);
    }

    // Override setSelected to force re-render
    setSelected(selected: boolean): void {
        if (this._isSelected !== selected) {
            super.setSelected(selected);
            if (this.nodeCircle) {
                const style = selected ? this.styles.selected : this.styles.normal;
                this.nodeCircle.fill(style.fill);
                this.nodeCircle.stroke(style.stroke);
                this.nodeCircle.strokeWidth(style.strokeWidth);
                this.nodeCircle.getLayer()?.draw();
            }
        }
    }

    // Override setHighlighted to force re-render
    setHighlighted(highlighted: boolean): void {
        if (this._isHighlighted !== highlighted) {
            super.setHighlighted(highlighted);
            if (this.nodeCircle) {
                const style = this._isSelected ? this.styles.selected : this.styles.normal;
                this.nodeCircle.fill(style.fill);
                this.nodeCircle.stroke(style.stroke);
                this.nodeCircle.strokeWidth(style.strokeWidth);
                this.nodeCircle.getLayer()?.draw();
            }
        }
    }
} 