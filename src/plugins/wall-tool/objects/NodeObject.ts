import { BaseObject } from '../../../core/objects/BaseObject';
import { SelectableObjectType } from '../../../core/interfaces/ISelectableObject';
import { Point } from '../../../core/types/geometry';

export interface NodeData {
    id: string;
    position: Point;
    connectedWallIds: string[];
    radius: number;
    isMovable: boolean;
}

export class NodeObject extends BaseObject {
    private readonly connectedWallIds: Set<string> = new Set();
    private readonly radius: number;
    private readonly isMovable: boolean;

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

    // Required methods from BaseObject
    render(layer: any): void {
        // Rendering is now handled by Canvas2D
    }

    getData(): NodeData {
        return this.toStorageData();
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
    }

    // Override containsPoint for precise circle hit detection
    containsPoint(point: Point): boolean {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        const offset = 10; // Increase size by 10 units
        return (dx * dx + dy * dy) <= ((this.radius + offset) * (this.radius + offset));
    }

    // Convert to storage format
    toStorageData(): NodeData {
        return {
            id: this.id,
            position: { x: this.position.x, y: this.position.y },
            connectedWallIds: Array.from(this.connectedWallIds),
            radius: this.radius,
            isMovable: this.isMovable
        };
    }

    // Create from storage data
    static fromStorageData(data: NodeData): NodeObject {
        const node = new NodeObject(
            data.id,
            data.position,
            data.radius || 5,
            data.isMovable ?? true
        );
        
        // Restore connected walls
        data.connectedWallIds.forEach(wallId => {
            node.addConnectedWall(wallId);
        });

        return node;
    }
} 