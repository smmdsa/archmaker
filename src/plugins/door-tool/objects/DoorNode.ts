import { Point } from '../../../core/types/geometry';
import { NodeObject } from '../../wall-tool/objects/NodeObject';
import { DoorObject } from './DoorObject';
import { WallObject } from '../../wall-tool/objects/WallObject';

export interface DoorNodeData {
    id: string;
    position: Point;
    doorId: string;
    wallId: string;
    isEndpoint: boolean; // true for B node, false for A node
}

export class DoorNode extends NodeObject {
    private doorId: string;
    private parentDoor: DoorObject | null = null;
    private isEndpoint: boolean;
    private isUpdating: boolean = false;  // Add flag to prevent recursion

    constructor(data: DoorNodeData, parentDoor: DoorObject) {
        // Pass individual parameters to NodeObject constructor
        super(
            data.id,
            data.position,
            5, // default radius
            true // isMovable
        );

        this.doorId = data.doorId;
        this.parentDoor = parentDoor;
        this.isEndpoint = data.isEndpoint;
    }

    // Override move method to ensure both nodes move together
    public move(newPosition: Point): void {
        if (!this.parentDoor || this.isUpdating) return;

        // When moving either node, just update the door's position
        // The width should remain fixed as set during creation
        this.isUpdating = true;
        this.parentDoor.updatePosition(newPosition);
        this.isUpdating = false;
    }

    // Update the wall reference and maintain connection
    public update(wall: WallObject): void {
        if (this.isUpdating) return;

        // Update the wall reference directly
        this.addConnectedWall(wall.id);
        
        // Update the parent door's wall reference
        if (this.parentDoor) {
            this.isUpdating = true;
            this.parentDoor.updateWallReference(wall);
            this.isUpdating = false;
        }
    }

    public getDoorId(): string {
        return this.doorId;
    }

    public getParentDoor(): DoorObject | null {
        return this.parentDoor;
    }

    public isEndpointNode(): boolean {
        return this.isEndpoint;
    }

    public getData(): DoorNodeData {
        return {
            id: this.id,
            position: this.position,
            doorId: this.doorId,
            wallId: this.getConnectedWalls()[0],
            isEndpoint: this.isEndpoint
        };
    }
} 