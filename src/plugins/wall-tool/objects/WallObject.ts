import { BaseObject } from '../../../core/objects/BaseObject';
import { SelectableObjectType } from '../../../core/interfaces/ISelectableObject';
import { Point } from '../../../core/types/geometry';
import { WallData as WallDataStorage } from '../../../core/storage/interfaces';
import { IEventManager } from '../../../core/interfaces/IEventManager';

interface WallData {
    startNodeId: string;
    endNodeId: string;
    startPoint: Point;
    endPoint: Point;
    thickness?: number;
    height?: number;
}

export class WallObject extends BaseObject {

    private readonly startNodeId: string;
    private readonly endNodeId: string;
    private startPoint: Point;
    private endPoint: Point;
    private lengthLabel: Text | null = null;
    private thickness: number = 10;
    private height: number = 280;
    private readonly eventManager: IEventManager;

    // Visual styles
    private readonly styles = {
        normal: {
            stroke: '#666666',
            strokeWidth: 4
        },
        selected: {
            stroke: '#2196f3',
            strokeWidth: 5
        },
        highlighted: {
            stroke: '#4caf50',
            strokeWidth: 5
        }
    };

    constructor(
        id: string,
        startNodeId: string,
        endNodeId: string,
        startPoint: Point,
        endPoint: Point,
        eventManager: IEventManager,
        thickness: number = 10,
        height: number = 280
    ) {
        // Calculate center and bounds
        const center = {
            x: (startPoint.x + endPoint.x) / 2,
            y: (startPoint.y + endPoint.y) / 2
        };

        const bounds = {
            x: Math.min(startPoint.x, endPoint.x) - thickness / 2,
            y: Math.min(startPoint.y, endPoint.y) - thickness / 2,
            width: Math.abs(endPoint.x - startPoint.x) + thickness,
            height: Math.abs(endPoint.y - startPoint.y) + thickness
        };

        super(
            id,
            SelectableObjectType.WALL,
            center,
            bounds
        );

        this.startNodeId = startNodeId;
        this.endNodeId = endNodeId;
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.eventManager = eventManager;
        this.thickness = thickness;
        this.height = height;
    }

    render(_: any): void {
    }

    getData(): WallData {
        return {
            startNodeId: this.startNodeId,
            endNodeId: this.endNodeId,
            startPoint: this.startPoint,
            endPoint: this.endPoint,
            thickness: this.thickness,
            height: this.height
        };
    }

    // Override containsPoint for precise line hit detection
    containsPoint(point: Point): boolean {
        const threshold = this.thickness / 2;

        // Calculate distance from point to line segment
        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) return false;

        // Calculate distance from point to line
        const t = (
            (point.x - this.startPoint.x) * dx +
            (point.y - this.startPoint.y) * dy
        ) / (length * length);

        // If t < 0, closest point is start point
        // If t > 1, closest point is end point
        // Otherwise, closest point is on the line segment
        if (t < 0) {
            return this.distanceBetweenPoints(point, this.startPoint) <= threshold;
        }
        if (t > 1) {
            return this.distanceBetweenPoints(point, this.endPoint) <= threshold;
        }

        const closestPoint = {
            x: this.startPoint.x + t * dx,
            y: this.startPoint.y + t * dy
        };

        return this.distanceBetweenPoints(point, closestPoint) <= threshold;
    }

    private distanceBetweenPoints(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    updateStartPoint(point: Point): void {
        this.startPoint = point;
        this._position = {
            x: (this.startPoint.x + this.endPoint.x) / 2,
            y: (this.startPoint.y + this.endPoint.y) / 2
        };
        this._bounds = {
            x: Math.min(this.startPoint.x, this.endPoint.x) - this.thickness / 2,
            y: Math.min(this.startPoint.y, this.endPoint.y) - this.thickness / 2,
            width: Math.abs(this.endPoint.x - this.startPoint.x) + this.thickness,
            height: Math.abs(this.endPoint.y - this.startPoint.y) + this.thickness
        };
    }

    updateEndPoint(point: Point): void {
        this.endPoint = point;
        this._position = {
            x: (this.startPoint.x + this.endPoint.x) / 2,
            y: (this.startPoint.y + this.endPoint.y) / 2
        };
        this._bounds = {
            x: Math.min(this.startPoint.x, this.endPoint.x) - this.thickness / 2,
            y: Math.min(this.startPoint.y, this.endPoint.y) - this.thickness / 2,
            width: Math.abs(this.endPoint.x - this.startPoint.x) + this.thickness,
            height: Math.abs(this.endPoint.y - this.endPoint.y) + this.thickness
        };
    }

    getStartNodeId(): string {
        return this.startNodeId;
    }

    getEndNodeId(): string {
        return this.endNodeId;
    }

    // Override setSelected to force re-render
    setSelected(selected: boolean): void {
        if (this._isSelected !== selected) {
            super.setSelected(selected);
            
        }
    }

    // Override setHighlighted to force re-render
    setHighlighted(highlighted: boolean): void {
        if (this._isHighlighted !== highlighted) {
            super.setHighlighted(highlighted);
            
        }
    }

    dispose(): void {
        
    }

    toStorageData(): WallDataStorage {
        return {
            id: this.id,
            startNodeId: this.startNodeId,
            endNodeId: this.endNodeId,
            startPoint: { x: this.startPoint.x, y: this.startPoint.y },
            endPoint: { x: this.endPoint.x, y: this.endPoint.y },
            thickness: this.thickness,
            height: this.height
        };
    }

    static fromStorageData(
        data: WallDataStorage,
        eventManager: IEventManager
    ): WallObject {
        return new WallObject(
            data.id,
            data.startNodeId,
            data.endNodeId,
            data.startPoint,
            data.endPoint,
            eventManager,
            data.thickness,
            data.height
        );
    }

    updateThickness(thickness: number): void {
        this.thickness = thickness;
        this._bounds = {
            x: Math.min(this.startPoint.x, this.endPoint.x) - this.thickness / 2,
            y: Math.min(this.startPoint.y, this.endPoint.y) - this.thickness / 2,
            width: Math.abs(this.endPoint.x - this.startPoint.x) + this.thickness,
            height: Math.abs(this.endPoint.y - this.startPoint.y) + this.thickness
        };
    }

    updateHeight(height: number): void {
        this.height = height;
    }
} 