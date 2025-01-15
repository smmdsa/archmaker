import { Point } from '../../../core/types/geometry';
import { NodeObject } from '../../wall-tool/objects/NodeObject';
import { WindowObject } from './WindowObject';
import { WallObject } from '../../wall-tool/objects/WallObject';

export interface WindowNodeData {
    id: string;
    position: Point;
    windowId: string;
    wallId: string;
    isEndpoint: boolean; // true for B node, false for A node
}

export class WindowNode extends NodeObject {
    private windowId: string;
    private parentWindow: WindowObject | null = null;
    private isEndpoint: boolean;
    private isUpdating: boolean = false;  // Add flag to prevent recursion

    constructor(data: WindowNodeData, parentWindow: WindowObject) {
        // Pass individual parameters to NodeObject constructor
        super(
            data.id,
            data.position,
            5, // default radius
            true // isMovable
        );

        this.windowId = data.windowId;
        this.parentWindow = parentWindow;
        this.isEndpoint = data.isEndpoint;
    }
    // Override move method to ensure both nodes move together
    public move(newPosition: Point): void {
        if (!this.parentWindow || this.isUpdating) return;

        // When moving either node, just update the door's position
        // The width should remain fixed as set during creation
        this.isUpdating = true;
        this.parentWindow.updatePosition(newPosition);
        this.isUpdating = false;
    }

    // Update the wall reference and maintain connection
    public update(wall: WallObject): void {
        if (this.isUpdating) return;

        // Update the wall reference directly
        this.addConnectedWall(wall.id);

        // Update the parent door's wall reference
        if (this.parentWindow) {
            this.isUpdating = true;
            this.parentWindow.updateWallReference(wall);
            this.isUpdating = false;
        }
    }

    public getWindowId(): string {
        return this.windowId;
    }

    public getParentWindow(): WindowObject | null {
        return this.parentWindow;
    }

    public isEndpointNode(): boolean {
        return this.isEndpoint;
    }

    public getData(): WindowNodeData {
        return {
            id: this.id,
            position: this.position,
            windowId: this.windowId,
            wallId: this.getConnectedWalls()[0],
            isEndpoint: this.isEndpoint
        };
    }
} 