import { Point } from '../../../core/types/geometry';
import { WallObject } from '../../wall-tool/objects/WallObject';
import { DoorNode, DoorNodeData } from './DoorNode';
import { v4 as uuidv4 } from 'uuid';

export interface DoorData {
    id: string;
    wallId: string;
    position: Point;
    angle: number;
    isFlipped: boolean;
    properties: {
        width: number;
        color: string;
        isOpen: boolean;
        openDirection: 'left' | 'right';
    };
    nodeA?: DoorNodeData;
    nodeB?: DoorNodeData;
    doorNumber: number | null;
}

export class DoorObject {
    public readonly id: string;
    private wallId: string;
    private position: Point;
    private angle: number;
    private isFlipped: boolean;
    private properties: {
        width: number;
        color: string;
        isOpen: boolean;
        openDirection: 'left' | 'right';
    };
    private doorNumber: number | null = null;
    private nodeA: DoorNode;
    private nodeB: DoorNode;
    private _isSelected: boolean = false;
    private _isHighlighted: boolean = false;

    constructor(data: DoorData) {
        this.id = data.id;
        this.wallId = data.wallId;
        this.position = data.position;
        this.angle = data.angle;
        this.isFlipped = data.isFlipped;
        
        // Initialize properties with defaults
        this.properties = {
            width: data.properties?.width || 100,
            color: data.properties?.color || '#000000',
            isOpen: data.properties?.isOpen || false,
            openDirection: data.properties?.openDirection || 'left'
        };

        // Create door nodes
        const nodeAPosition = data.nodeA?.position || this.calculateNodePosition(false);
        const nodeBPosition = data.nodeB?.position || this.calculateNodePosition(true);

        // Create door nodes with pre-calculated positions
        this.nodeA = new DoorNode({
            id: data.nodeA?.id || uuidv4(),
            position: nodeAPosition,
            doorId: this.id,
            wallId: this.wallId,
            isEndpoint: false
        }, this);

        this.nodeB = new DoorNode({
            id: data.nodeB?.id || uuidv4(),
            position: nodeBPosition,
            doorId: this.id,
            wallId: this.wallId,
            isEndpoint: true
        }, this);
    }

    private calculateNodePosition(isEndpoint: boolean): Point {
        const dx = Math.cos(this.angle) * (this.properties.width / 2);
        const dy = Math.sin(this.angle) * (this.properties.width / 2);
        
        return isEndpoint ? {
            x: this.position.x + dx,
            y: this.position.y + dy
        } : {
            x: this.position.x - dx,
            y: this.position.y - dy
        };
    }

    public updatePosition(newPosition: Point): void {
        this.position = newPosition;
        
        // Update node positions
        this.nodeA.move(this.calculateNodePosition(false));
        this.nodeB.move(this.calculateNodePosition(true));
    }

    public updateWidth(newWidth: number): void {
        this.properties.width = newWidth;
        
        // Update node positions based on new width
        this.nodeA.move(this.calculateNodePosition(false));
        this.nodeB.move(this.calculateNodePosition(true));
    }

    public updateWallReference(wall: WallObject): void {
        this.wallId = wall.id;
        this.angle = this.calculateAngle(wall);
        
        // Update nodes
        this.nodeA.update(wall);
        this.nodeB.update(wall);
    }

    private calculateAngle(wall: WallObject): number {
        const data = wall.getData();
        const dx = data.endPoint.x - data.startPoint.x;
        const dy = data.endPoint.y - data.startPoint.y;
        return Math.atan2(dy, dx);
    }

    public flipDoor(): void {
        this.isFlipped = !this.isFlipped;
    }

    public getNodeA(): DoorNode {
        return this.nodeA;
    }

    public getNodeB(): DoorNode {
        return this.nodeB;
    }

    public getData(): DoorData {
        return {
            id: this.id,
            wallId: this.wallId,
            position: this.position,
            angle: this.angle,
            isFlipped: this.isFlipped,
            properties: { ...this.properties },
            nodeA: this.nodeA.getData(),
            nodeB: this.nodeB.getData(),
            doorNumber: this.doorNumber
        };
    }

    public setSelected (selected: boolean): void {
        this._isSelected = selected;
        this.nodeA.setSelected(selected);
        this.nodeB.setSelected(selected);
    }

    public setHighlighted(highlighted: boolean): void {
        this._isHighlighted = highlighted;
        this.nodeA.setHighlighted(highlighted);
        this.nodeB.setHighlighted(highlighted);
    }

    public setDoorNumber(number: number): void {
        this.doorNumber = number;
    }

    public getDoorNumber(): number | null {
        return this.doorNumber;
    }
} 