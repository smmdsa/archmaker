import { BaseObject } from '../../../core/objects/BaseObject';
import { ISelectableObject, SelectableObjectType } from '../../../core/interfaces/ISelectableObject';
import { Layer } from 'konva/lib/Layer';
import { Point } from '../../../core/types/geometry';
import { Line } from 'konva/lib/shapes/Line';
import { Group } from 'konva/lib/Group';
import { Text } from 'konva/lib/shapes/Text';
import { Circle } from 'konva/lib/shapes/Circle';
import { Rect } from 'konva/lib/shapes/Rect';
import { v4 as uuidv4 } from 'uuid';

// Business logic interfaces
export interface DoorProperties {
    color: string;
    width: number;
    isOpen: boolean;
    openDirection: 'left' | 'right';
    label?: string;
}

export interface DoorData {
    id: string;
    wallId: string;
    position: Point;
    angle: number;
    startNodeId: string;
    endNodeId: string;
    properties: DoorProperties;
}

// Visual styles
interface DoorStyle {
    stroke: string;
    strokeWidth: number;
    fill: string;
}

export class DoorObject extends BaseObject implements ISelectableObject {
    // Konva elements for rendering
    private group?: Group;
    private doorLine?: Line;
    private swingPathLine?: Line;
    private startNode?: Circle;
    private endNode?: Circle;
    private doorLabel?: Text;
    private labelBackground?: Rect;
    private measureBackground?: Rect;

    // Business data
    private data: DoorData;
    private _doorNumber: number | null = null;

    // Visual styles
    private readonly styles = {
        normal: {
            stroke: '#8B4513',
            strokeWidth: 3,
            fill: '#8B4513'
        },
        selected: {
            stroke: '#A0522D',
            strokeWidth: 4,
            fill: '#A0522D'
        },
        highlighted: {
            stroke: '#CD853F',
            strokeWidth: 4,
            fill: '#CD853F'
        }
    };

    constructor(data: Omit<DoorData, 'id'>) {
        const id = uuidv4();
        super(id, SelectableObjectType.DOOR, data.position, {
            x: data.position.x - data.properties.width / 2,
            y: data.position.y - data.properties.width / 2,
            width: data.properties.width,
            height: data.properties.width
        });

        this.data = {
            ...data,
            id,
            properties: {
                color: data.properties.color || '#8B4513',
                width: data.properties.width || 100,
                isOpen: data.properties.isOpen ?? false,
                openDirection: data.properties.openDirection || 'left',
                label: data.properties.label || ''
            }
        };

        // Update styles based on properties
        this.styles.normal.stroke = this.data.properties.color;
        this.styles.normal.fill = this.data.properties.color;
    }

    // Public API for business logic
    setColor(color: string): void {
        this.data.properties.color = color;
        this.styles.normal.stroke = color;
        this.styles.normal.fill = color;
        this.updateVisualStyle();
    }

    setWidth(width: number): void {
        this.data.properties.width = width;
        this.updateGeometry();
    }

    setOpenDirection(direction: 'left' | 'right'): void {
        this.data.properties.openDirection = direction;
        this.updateGeometry();
    }

    toggleOpen(): void {
        this.data.properties.isOpen = !this.data.properties.isOpen;
        this.updateGeometry();
    }

    setDoorNumber(number: number): void {
        this._doorNumber = number;
        this.data.properties.label = `Door_${number}`;
        this.updateLabel();
    }

    // Private methods for visual updates
    private updateVisualStyle(): void {
        const style = this._isSelected ? this.styles.selected :
                     this._isHighlighted ? this.styles.highlighted :
                     this.styles.normal;

        if (this.doorLine) {
            this.doorLine.stroke(style.stroke);
            this.doorLine.strokeWidth(style.strokeWidth);
        }

        if (this.startNode) {
            this.startNode.fill(style.fill);
            this.startNode.stroke(style.stroke);
        }

        if (this.endNode) {
            this.endNode.fill(style.fill);
            this.endNode.stroke(style.stroke);
        }

        this.group?.getLayer()?.batchDraw();
    }

    private updateGeometry(): void {
        if (!this.group) return;

        const width = this.data.properties.width;
        const isOpen = this.data.properties.isOpen;
        const direction = this.data.properties.openDirection;

        // Update door line points
        if (this.doorLine) {
            if (!isOpen) {
                this.doorLine.points([-width/2, 0, width/2, 0]);
            } else {
                // Draw an arc for open door
                const arcPoints = this.calculateArcPoints(width, direction);
                this.doorLine.points(arcPoints);
            }
        }

        // Update swing path
        if (this.swingPathLine) {
            this.swingPathLine.points(this.calculateSwingPathPoints(width, direction));
        }

        // Update node positions
        if (this.startNode) {
            this.startNode.position({ x: -width/2, y: 0 });
        }
        if (this.endNode) {
            this.endNode.position({ x: width/2, y: 0 });
        }

        this.group.getLayer()?.batchDraw();
    }

    private updateLabel(): void {
        if (this.doorLabel && this.data.properties.label) {
            this.doorLabel.text(this.data.properties.label);
            this.group?.getLayer()?.batchDraw();
        }
    }

    private calculateArcPoints(width: number, direction: 'left' | 'right'): number[] {
        const points: number[] = [];
        const segments = 8;
        const radius = width / 2;
        const startAngle = direction === 'left' ? Math.PI : 0;
        const endAngle = direction === 'left' ? Math.PI/2 : -Math.PI/2;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = startAngle + (endAngle - startAngle) * t;
            points.push(
                -width/2 + radius * Math.cos(angle),
                radius * Math.sin(angle)
            );
        }

        return points;
    }

    private calculateSwingPathPoints(width: number, direction: 'left' | 'right'): number[] {
        const points: number[] = [];
        const segments = 16;
        const radius = width; // Full door width is the radius
        
        // For left-opening doors: start at 0° and end at 90° (counterclockwise from left pivot)
        // For right-opening doors: start at 0° and end at -90° (clockwise from left pivot)
        const startAngle = 0;
        const endAngle = direction === 'left' ? Math.PI/2 : -Math.PI/2;

        // Create radial lines for the swing path
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = startAngle + (endAngle - startAngle) * t;
            
            // Always pivot from the left node (-width/2, 0)
            const pivotX = -width/2;
            
            points.push(
                pivotX,  // Pivot X
                0,      // Pivot Y
                pivotX + radius * Math.cos(angle),  // End X
                radius * Math.sin(angle)            // End Y
            );
        }

        return points;
    }

    // Required interface implementations
    render(layer: Layer): void {
        // Destroy previous elements if they exist
        this.group?.destroy();

        // Create new group
        this.group = new Group({
            x: this.data.position.x,
            y: this.data.position.y,
            rotation: this.data.angle * 180 / Math.PI
        });

        // Get current style based on selection state
        const style = this._isSelected ? this.styles.selected :
                     this._isHighlighted ? this.styles.highlighted :
                     this.styles.normal;

        // Create swing path line with updated style
        this.swingPathLine = new Line({
            points: this.calculateSwingPathPoints(this.data.properties.width, this.data.properties.openDirection),
            stroke: '#999999',
            strokeWidth: 1,
            dash: [3, 3],
            opacity: 0.5,
            tension: 0.2
        });

        // Create door line with current style
        this.doorLine = new Line({
            points: [-this.data.properties.width/2, 0, this.data.properties.width/2, 0],
            stroke: style.stroke,
            strokeWidth: style.strokeWidth
        });

        // Create door nodes with current style
        this.startNode = new Circle({
            x: -this.data.properties.width/2,
            y: 0,
            radius: 5,
            fill: style.fill,
            stroke: style.stroke,
            strokeWidth: 1,
            draggable: false
        });

        this.endNode = new Circle({
            x: this.data.properties.width/2,
            y: 0,
            radius: 5,
            fill: style.fill,
            stroke: style.stroke,
            strokeWidth: 1,
            draggable: false
        });

        // Create label background
        this.labelBackground = new Rect({
            x: -30,
            y: -30,
            width: 60,
            height: 20,
            fill: '#ffffff',
            cornerRadius: 3
        });

        // Create door label with current number
        this.doorLabel = new Text({
            x: 0,
            y: -20,
            text: this._doorNumber ? `Door_${this._doorNumber}` : '',
            fontSize: 12,
            fill: '#000000',
            align: 'center',
            offsetX: 0,
            offsetY: 0
        });

        // Add all elements to group in correct order
        this.group.add(this.swingPathLine);
        this.group.add(this.labelBackground);
        this.group.add(this.doorLine);
        this.group.add(this.startNode);
        this.group.add(this.endNode);
        this.group.add(this.doorLabel);

        // Add group to layer
        layer.add(this.group);
    }

    setSelected(selected: boolean): void {
        if (this._isSelected !== selected) {
            super.setSelected(selected);
            this.updateVisualStyle();
        }
    }

    setHighlighted(highlighted: boolean): void {
        if (this._isHighlighted !== highlighted) {
            super.setHighlighted(highlighted);
            this.updateVisualStyle();
        }
    }

    getData(): DoorData {
        return { ...this.data };
    }

    destroy(): void {
        this.group?.destroy();
    }

    containsPoint(point: Point): boolean {
        if (!this.group) return false;
        const localPoint = this.group.getAbsoluteTransform().invert().point(point);
        return Math.abs(localPoint.y) <= 5 && 
               Math.abs(localPoint.x) <= this.data.properties.width / 2;
    }
} 