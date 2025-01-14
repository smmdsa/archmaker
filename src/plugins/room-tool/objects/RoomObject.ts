import { BaseObject, BaseObjectData } from '../../../core/objects/BaseObject';
import { SelectableObjectType } from '../../../core/interfaces/ISelectableObject';
import { Point } from '../../../core/types/geometry';
import { Group } from 'konva/lib/Group';
import { Line } from 'konva/lib/shapes/Line';
import { Text } from 'konva/lib/shapes/Text';
import { Layer } from 'konva/lib/Layer';
import { WallObject } from '../../wall-tool/objects/WallObject';
import { WallGraph } from '../../wall-tool/models/WallGraph';
import { RoomData as StorageRoomData } from '../../../core/storage/interfaces';
import { RoomData } from '../../../core/storage/interfaces';

interface RoomData {
    wallIds: string[];
    area: number;
    name: string;
    width: number;
    height: number;
}

export interface SerializedRoomData extends BaseObjectData {
    wallIds: string[];
    area: number;
    name: string;
    width: number;
    height: number;
    color?: string;
    texture?: string;
}

export class RoomObject extends BaseObject {
    private wallIds: Set<string>;
    private area: number;
    private name: string;
    private roomWidth: number;
    private roomHeight: number;
    private graph: WallGraph;
    private roomGroup: Group | null = null;
    private roomShape: Line | null = null;
    private roomLabel: Text | null = null;

    private styles = {
        normal: {
            fill: 'transparent',
            stroke: '#666666',
            strokeWidth: 1
        },
        selected: {
            fill: 'transparent',
            stroke: '#2196f3',
            strokeWidth: 2
        },
        highlighted: {
            fill: 'transparent',
            stroke: '#4caf50',
            strokeWidth: 2
        }
    };

    constructor(
        id: string, 
        startPoint: Point,
        width: number,
        height: number,
        wallIds: string[], 
        graph: WallGraph
    ) {
        const bounds = {
            x: startPoint.x,
            y: startPoint.y,
            width: width,
            height: height
        };

        super(id, SelectableObjectType.ROOM, startPoint, bounds);
        
        this.wallIds = new Set(wallIds);
        this.graph = graph;
        this.roomWidth = width;
        this.roomHeight = height;
        this.area = (width * height) / 10000; // Convert to m² (1px = 1cm, so 100px = 1m)
        this.name = `Room ${id.slice(0, 4)}`;
    }

    render(layer: Layer): void {
        // Cleanup old elements if they exist and are not in the current layer
        if (this.roomGroup && this.roomGroup.getLayer() !== layer) {
            this.roomGroup.destroy();
            this.roomGroup = null;
            this.roomShape = null;
            this.roomLabel = null;
        }

        let style = this.styles.normal;
        if (this._isSelected) {
            style = this.styles.selected;
        } else if (this._isHighlighted) {
            style = this.styles.highlighted;
        }

        // Create or update room visualization
        if (!this.roomGroup) {
            this.roomGroup = new Group({
                name: `room-${this.id}`
            });

            // Create room shape
            const points = [
                this._position.x, this._position.y,
                this._position.x + this.roomWidth, this._position.y,
                this._position.x + this.roomWidth, this._position.y + this.roomHeight,
                this._position.x, this._position.y + this.roomHeight
            ];

            this.roomShape = new Line({
                points: points,
                closed: true,
                fill: style.fill,
                stroke: style.stroke,
                strokeWidth: style.strokeWidth
            });

            // Create room label
            this.roomLabel = new Text({
                text: `${this.name}\n${this.area.toFixed(2)}m²`,
                fontSize: 14,
                fill: '#666666',
                align: 'center'
            });

            this.roomGroup.add(this.roomShape);
            this.roomGroup.add(this.roomLabel);
            layer.add(this.roomGroup);
        }

        // Update visual properties
        if (this.roomShape) {
            this.roomShape.fill(style.fill);
            this.roomShape.stroke(style.stroke);
            this.roomShape.strokeWidth(style.strokeWidth);
        }

        // Update position and label
        this.updatePosition();
    }

    getData(): RoomData {
        return {
            wallIds: Array.from(this.wallIds),
            area: this.area,
            name: this.name,
            width: this.roomWidth,
            height: this.roomHeight
        };
    }

    private updatePosition(): void {
        if (!this.roomShape || !this.roomLabel) return;

        // Center label in room
        const bounds = this.roomShape.getClientRect();
        this.roomLabel.position({
            x: bounds.x + bounds.width / 2 - this.roomLabel.width() / 2,
            y: bounds.y + bounds.height / 2 - this.roomLabel.height() / 2
        });
    }

    containsPoint(point: Point): boolean {
        return point.x >= this._position.x &&
               point.x <= this._position.x + this.roomWidth &&
               point.y >= this._position.y &&
               point.y <= this._position.y + this.roomHeight;
    }

    setName(name: string): void {
        this.name = name;
        if (this.roomLabel) {
            this.roomLabel.text(`${this.name}\n${this.area.toFixed(2)}m²`);
        }
    }

    toJSON(): SerializedRoomData {
        return {
            ...super.toJSON(),
            wallIds: Array.from(this.wallIds),
            area: this.area,
            name: this.name,
            width: this.roomWidth,
            height: this.roomHeight,
            color: this.styles.normal.fill,
            texture: undefined // For future use
        };
    }

    fromJSON(data: SerializedRoomData): void {
        super.fromJSON(data);
        this.wallIds = new Set(data.wallIds);
        this.area = data.area;
        this.name = data.name;
        this.roomWidth = data.width;
        this.roomHeight = data.height;
        
        if (data.color) {
            this.styles.normal.fill = data.color;
        }

        // Update visual representation
        if (this.roomShape) {
            const style = this._isSelected ? this.styles.selected :
                         this._isHighlighted ? this.styles.highlighted :
                         this.styles.normal;
            this.roomShape.fill(style.fill);
        }

        if (this.roomLabel) {
            this.roomLabel.text(`${this.name}\n${this.area.toFixed(2)}m²`);
        }

        this.updatePosition();
    }

    // Convert to storage format
    toStorageData(): RoomData {
        return {
            id: this.id,
            wallIds: Array.from(this.wallIds),
            name: this.name,
            area: this.area,
            color: this.styles.normal.fill,
            metadata: {
                width: this.roomWidth,
                height: this.roomHeight
            }
        };
    }

    // Create from storage format
    static fromStorageData(data: RoomData, graph: WallGraph): RoomObject {
        // Calculate room dimensions from walls if possible
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        data.wallIds.forEach(wallId => {
            const wall = graph.getWall(wallId);
            if (wall) {
                const wallData = wall.getData();
                minX = Math.min(minX, wallData.startPoint.x, wallData.endPoint.x);
                minY = Math.min(minY, wallData.startPoint.y, wallData.endPoint.y);
                maxX = Math.max(maxX, wallData.startPoint.x, wallData.endPoint.x);
                maxY = Math.max(maxY, wallData.startPoint.y, wallData.endPoint.y);
            }
        });

        // Use stored dimensions if available, otherwise calculate from walls
        const width = data.metadata?.width ?? (maxX - minX);
        const height = data.metadata?.height ?? (maxY - minY);
        const startPoint = { x: minX, y: minY };

        const room = new RoomObject(
            data.id,
            startPoint,
            width,
            height,
            data.wallIds,
            graph
        );

        // Apply additional properties
        if (data.name) room.setName(data.name);
        if (data.color) room.setColor(data.color);

        return room;
    }

    // Add new method for setting color
    setColor(color: string): void {
        this.styles.normal.fill = color;
        if (this.roomShape) {
            const style = this._isSelected ? this.styles.selected :
                         this._isHighlighted ? this.styles.highlighted :
                         this.styles.normal;
            this.roomShape.fill(style.fill);
            this.roomGroup?.getLayer()?.batchDraw();
        }
    }
} 