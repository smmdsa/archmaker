import { Point } from '../../../core/types/geometry';
import { WallObject } from '../../wall-tool/objects/WallObject';
import { WindowNode, WindowNodeData } from './WindowNode';
import { v4 as uuidv4 } from 'uuid';

export interface WindowData {
    id: string;
    wallId: string;
    position: Point;
    angle: number;
    isFlipped: boolean;
    properties: {
        width: number;
        height: number;
        color: string;
        isOpen: boolean;
        openDirection: 'left' | 'right';
    };
    nodeA?: WindowNodeData;
    nodeB?: WindowNodeData;
    windowNumber: number | null;
}

export class WindowObject  {
    public readonly id: string;
    private wallId: string;
    private position: Point;
    private angle: number;
    private isFlipped: boolean;
    private properties: {
        width: number;
        height: number;
        color: string;
        isOpen: boolean;
        openDirection: 'left' | 'right';
    };
    private windowNumber: number | null = null;
    private nodeA: WindowNode;
    private nodeB: WindowNode;
    private _isSelected: boolean = false;
    private _isHighlighted: boolean = false;

    constructor(data: WindowData) {
        this.id = data.id;
        this.wallId = data.wallId;
        this.position = data.position;
        this.angle = data.angle;
        this.isFlipped = data.isFlipped;
        
        // Initialize properties with defaults
        this.properties = {
            width: data.properties?.width || 100,
            height: data.properties?.height || 150,
            color: data.properties?.color || '#000000',
            isOpen: data.properties?.isOpen || false,
            openDirection: data.properties?.openDirection || 'left'
        };

        // Create window nodes
        const nodeAPosition = data.nodeA?.position || this.calculateNodePosition(false);
        const nodeBPosition = data.nodeB?.position || this.calculateNodePosition(true);

        // Create window nodes with pre-calculated positions
        this.nodeA = new WindowNode({
            id: data.nodeA?.id || uuidv4(),
            position: nodeAPosition,
            windowId: this.id,
            wallId: this.wallId,
            isEndpoint: false
        }, this);

        this.nodeB = new WindowNode({
            id: data.nodeB?.id || uuidv4(),
            position: nodeBPosition,
            windowId: this.id,
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

    public flipWindow(): void {
        this.isFlipped = !this.isFlipped;
    }

    public getNodeA(): WindowNode {
        return this.nodeA;
    }

    public getNodeB(): WindowNode {
        return this.nodeB;
    }

    public getData(): WindowData {
        return {
            id: this.id,
            wallId: this.wallId,
            position: this.position,
            angle: this.angle,
            isFlipped: this.isFlipped,
            properties: { ...this.properties },
            nodeA: this.nodeA.getData(),
            nodeB: this.nodeB.getData(),
            windowNumber: this.windowNumber
        };
    }

    public setSelected(selected: boolean): void {
        this._isSelected = selected;
        this.nodeA.setSelected(selected);
        this.nodeB.setSelected(selected);
    }

    public setHighlighted(highlighted: boolean): void {
        this._isHighlighted = highlighted;
        this.nodeA.setHighlighted(highlighted);
        this.nodeB.setHighlighted(highlighted);
    }

    public setWindowNumber(number: number): void {
        this.windowNumber = number;
    }

    public getWindowNumber(): number | null {
        return this.windowNumber;
    }

    public isHighlighted(): boolean {
        return this._isHighlighted;
    }

    public isSelected(): boolean {
        return this._isSelected;
    }
} 