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
import { NodeObject } from '../../wall-tool/objects/NodeObject';
import { WallGraph } from '../../wall-tool/models/WallGraph';
import { WallObject } from '../../wall-tool/objects/WallObject';
import { DoorData as StorageDoorData } from '../../../core/storage/interfaces';

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
    isFlipped: boolean;
    connectedNodes: {
        startWallNodeId?: string;
        endWallNodeId?: string;
    };
}

export interface SerializedDoorData {
    wallId: string;
    position: Point;
    angle: number;
    startNodeId: string;
    endNodeId: string;
    properties: DoorProperties;
    isFlipped: boolean;
    connectedNodes: {
        startWallNodeId?: string;
        endWallNodeId?: string;
    };
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
        },
        label: {
            fontSize: 14,
            fontFamily: 'Arial',
            fill: '#000000',
            padding: 2,
            background: '#FFFFFF',
            opacity: 0.8
        }
    };

    private startNodeObject: NodeObject;
    private endNodeObject: NodeObject;
    private wallGraph: WallGraph;

    constructor(data: Omit<DoorData, 'id'>, wallGraph: WallGraph) {
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
            isFlipped: data.isFlipped ?? false,
            properties: {
                color: data.properties.color || '#8B4513',
                width: data.properties.width || 100,
                isOpen: data.properties.isOpen ?? false,
                openDirection: data.properties.openDirection || 'left',
                label: data.properties.label || ''
            },
            connectedNodes: {}
        };

        // Update styles based on properties
        this.styles.normal.stroke = this.data.properties.color;
        this.styles.normal.fill = this.data.properties.color;

        this.wallGraph = wallGraph;
        
        // Create actual node objects for the door endpoints
        this.startNodeObject = new NodeObject(uuidv4(), {
            x: this.data.position.x - this.data.properties.width/2,
            y: this.data.position.y
        });
        
        this.endNodeObject = new NodeObject(uuidv4(), {
            x: this.data.position.x + this.data.properties.width/2,
            y: this.data.position.y
        });
        
        // Store node IDs
        this.data.startNodeId = this.startNodeObject.id;
        this.data.endNodeId = this.endNodeObject.id;
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
        if (!this.group) return;

        // Remove existing label if it exists
        if (this.doorLabel) {
            this.doorLabel.destroy();
            this.doorLabel = undefined;
        }
        if (this.labelBackground) {
            this.labelBackground.destroy();
            this.labelBackground = undefined;
        }

        // Create new label if we have a door number
        if (this._doorNumber !== null) {
            const labelText = `Door_${this._doorNumber}`;
            
            // Create text label
            this.doorLabel = new Text({
                text: labelText,
                fontSize: this.styles.label.fontSize,
                fontFamily: this.styles.label.fontFamily,
                fill: this.styles.label.fill,
                padding: this.styles.label.padding,
                align: 'center'
            });

            // Position the label above the door
            const labelX = -this.doorLabel.width() / 2;
            const labelY = -30; // Position above the door

            this.doorLabel.position({ x: labelX, y: labelY });

            // Create background for label
            this.labelBackground = new Rect({
                x: labelX - this.styles.label.padding,
                y: labelY - this.styles.label.padding,
                width: this.doorLabel.width() + (this.styles.label.padding * 2),
                height: this.doorLabel.height() + (this.styles.label.padding * 2),
                fill: this.styles.label.background,
                opacity: this.styles.label.opacity,
                cornerRadius: 3
            });

            // Add background first, then text
            this.group.add(this.labelBackground);
            this.group.add(this.doorLabel);
            this.group.getLayer()?.batchDraw();
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

    // Method to connect door nodes to wall nodes
    connectToWallNodes(startWallNodeId?: string, endWallNodeId?: string): void {
        this.data.connectedNodes = {
            startWallNodeId,
            endWallNodeId
        };
        
        // Update positions based on connected wall nodes
        if (startWallNodeId) {
            const startWallNode = this.wallGraph.getNode(startWallNodeId);
            if (startWallNode) {
                this.startNodeObject.setPosition(startWallNode.position.x, startWallNode.position.y);
            }
        }
        
        if (endWallNodeId) {
            const endWallNode = this.wallGraph.getNode(endWallNodeId);
            if (endWallNode) {
                this.endNodeObject.setPosition(endWallNode.position.x, endWallNode.position.y);
            }
        }
        
        this.updateDoorPosition();
    }

    // Method to move the entire door as a unit
    moveTo(newPosition: Point): void {
        const dx = newPosition.x - this.data.position.x;
        const dy = newPosition.y - this.data.position.y;
        
        // Move both nodes
        const startPos = this.startNodeObject.position;
        const endPos = this.endNodeObject.position;
        
        this.startNodeObject.setPosition(startPos.x + dx, startPos.y + dy);
        this.endNodeObject.setPosition(endPos.x + dx, endPos.y + dy);
        
        // Update door position
        this.data.position = newPosition;
        
        // Update connected wall nodes if they exist
        if (this.data.connectedNodes.startWallNodeId) {
            const startWallNode = this.wallGraph.getNode(this.data.connectedNodes.startWallNodeId);
            if (startWallNode) {
                startWallNode.setPosition(startPos.x + dx, startPos.y + dy);
            }
        }
        
        if (this.data.connectedNodes.endWallNodeId) {
            const endWallNode = this.wallGraph.getNode(this.data.connectedNodes.endWallNodeId);
            if (endWallNode) {
                endWallNode.setPosition(endPos.x + dx, endPos.y + dy);
            }
        }
        
        // Update visual representation
        if (this.group) {
            this.group.position({
                x: newPosition.x,
                y: newPosition.y
            });
            this.group.getLayer()?.batchDraw();
        }
        
        this.updateGeometry();
    }

    // Method to update door position based on its nodes
    private updateDoorPosition(): void {
        const startPos = this.startNodeObject.position;
        const endPos = this.endNodeObject.position;
        
        // Calculate center position
        this.data.position = {
            x: (startPos.x + endPos.x) / 2,
            y: (startPos.y + endPos.y) / 2
        };
        
        // Calculate angle
        this.data.angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
        
        // Update width based on actual distance between nodes
        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        this.data.properties.width = Math.sqrt(dx * dx + dy * dy);
        
        this.updateGeometry();
    }

    // Method to find the nearest wall node within snap distance
    private findNearestWallNode(point: Point, maxDistance: number = 10): { nodeId: string, distance: number } | null {
        const nodes = this.wallGraph.getAllNodes();
        let nearestNode = null;
        let minDistance = maxDistance;

        for (const node of nodes) {
            const dx = node.position.x - point.x;
            const dy = node.position.y - point.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = { nodeId: node.id, distance };
            }
        }

        return nearestNode;
    }

    // Method to snap door nodes to nearby wall nodes
    snapToWallNodes(): void {
        const startPos = this.startNodeObject.position;
        const endPos = this.endNodeObject.position;

        // Try to snap start node
        const nearestStartNode = this.findNearestWallNode(startPos);
        if (nearestStartNode) {
            this.connectToWallNodes(nearestStartNode.nodeId, this.data.connectedNodes.endWallNodeId);
        }

        // Try to snap end node
        const nearestEndNode = this.findNearestWallNode(endPos);
        if (nearestEndNode) {
            this.connectToWallNodes(this.data.connectedNodes.startWallNodeId, nearestEndNode.nodeId);
        }

        // Update door position and geometry
        this.updateDoorPosition();
    }

    // New method to flip the door
    flipDoor(): void {
        this.data.isFlipped = !this.data.isFlipped;
        
        // Swap start and end nodes
        const tempStartNode = this.startNodeObject;
        this.startNodeObject = this.endNodeObject;
        this.endNodeObject = tempStartNode;

        // Update node IDs in data
        const tempStartId = this.data.startNodeId;
        this.data.startNodeId = this.data.endNodeId;
        this.data.endNodeId = tempStartId;

        // Update connected wall nodes
        const tempStartWallId = this.data.connectedNodes.startWallNodeId;
        this.data.connectedNodes.startWallNodeId = this.data.connectedNodes.endWallNodeId;
        this.data.connectedNodes.endWallNodeId = tempStartWallId;

        // Adjust angle by 180 degrees
        this.data.angle = (this.data.angle + Math.PI) % (2 * Math.PI);

        // Toggle open direction
        this.data.properties.openDirection = 
            this.data.properties.openDirection === 'left' ? 'right' : 'left';

        // Update visual representation
        this.updateGeometry();
        if (this.group) {
            this.group.rotation(this.data.angle * 180 / Math.PI);
            this.group.getLayer()?.batchDraw();
        }
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

        // Create door line with current style and flip state
        this.doorLine = new Line({
            points: this.data.isFlipped ? 
                [this.data.properties.width/2, 0, -this.data.properties.width/2, 0] :
                [-this.data.properties.width/2, 0, this.data.properties.width/2, 0],
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
        // Clean up the visual elements
        this.group?.destroy();
        
        // Clear references to nodes
        this.startNodeObject = null as any;
        this.endNodeObject = null as any;
    }

    containsPoint(point: Point): boolean {
        if (!this.group) return false;
        const localPoint = this.group.getAbsoluteTransform().invert().point(point);
        return Math.abs(localPoint.y) <= 5 && 
               Math.abs(localPoint.x) <= this.data.properties.width / 2;
    }

    updatePosition(newPosition: Point): void {
        this.moveTo(newPosition);
    }

    updateWallReference(wall: WallObject): void {
        this.data.wallId = wall.id;
        // Update angle based on new wall
        const wallData = wall.getData();
        const dx = wallData.endPoint.x - wallData.startPoint.x;
        const dy = wallData.endPoint.y - wallData.startPoint.y;
        this.data.angle = Math.atan2(dy, dx);
        
        // Update geometry and redraw
        this.updateGeometry();
        if (this.group) {
            this.group.rotation(this.data.angle * 180 / Math.PI);
            this.group.getLayer()?.batchDraw();
        }
    }

    toJSON(): SerializedDoorData {
        return {
            wallId: this.data.wallId,
            position: this.data.position,
            angle: this.data.angle,
            startNodeId: this.data.startNodeId,
            endNodeId: this.data.endNodeId,
            properties: {
                ...this.data.properties
            },
            isFlipped: this.data.isFlipped,
            connectedNodes: {
                ...this.data.connectedNodes
            }
        };
    }

    fromJSON(data: SerializedDoorData): void {
        this.data = {
            ...this.data,
            wallId: data.wallId,
            position: data.position,
            angle: data.angle,
            startNodeId: data.startNodeId,
            endNodeId: data.endNodeId,
            properties: {
                ...data.properties
            },
            isFlipped: data.isFlipped,
            connectedNodes: {
                ...data.connectedNodes
            }
        };

        // Update visual styles
        this.styles.normal.stroke = this.data.properties.color;
        this.styles.normal.fill = this.data.properties.color;

        // Update geometry and visuals
        this.updateGeometry();
        this.updateVisualStyle();
        this.updateLabel();
    }

    // Convert to storage format
    toStorageData(): StorageDoorData {
        return {
            id: this.id,
            wallId: this.data.wallId,
            position: this.getRelativePosition(),
            width: this.data.properties.width,
            height: this.data.properties.width,
            style: 'default',
            openDirection: this.data.properties.openDirection,
            metadata: {
                isOpen: this.data.properties.isOpen,
                color: this.data.properties.color,
                label: this.data.properties.label,
                doorNumber: this._doorNumber
            }
        };
    }

    private getRelativePosition(): number {
        const wall = this.wallGraph.getWall(this.data.wallId);
        if (!wall) {
            throw new Error(`Wall not found: ${this.data.wallId}`);
        }

        const startPoint = wall.getData().startPoint;
        const endPoint = wall.getData().endPoint;
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const wallLength = Math.sqrt(dx * dx + dy * dy);

        // Calculate relative position (0-1) along the wall
        const doorDx = this.data.position.x - startPoint.x;
        const doorDy = this.data.position.y - startPoint.y;
        const doorProjection = (doorDx * dx + doorDy * dy) / wallLength;

        return doorProjection / wallLength;
    }

    // Create from storage format
    static fromStorageData(data: StorageDoorData, wallGraph: WallGraph): DoorObject {
        const wall = wallGraph.getWall(data.wallId);
        if (!wall) {
            throw new Error(`Wall not found: ${data.wallId}`);
        }

        // Calculate actual position from relative position
        const startPoint = wall.getData().startPoint;
        const endPoint = wall.getData().endPoint;
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const position = {
            x: startPoint.x + dx * data.position,
            y: startPoint.y + dy * data.position
        };

        const door = new DoorObject({
            wallId: data.wallId,
            position,
            angle: 0,
            startNodeId: '',
            endNodeId: '',
            properties: {
                width: data.width,
                color: data.metadata?.color || '#8B4513',
                isOpen: data.metadata?.isOpen || false,
                openDirection: data.openDirection || 'left',
                label: data.metadata?.label || ''
            },
            isFlipped: false,
            connectedNodes: {}
        }, wallGraph);

        if (data.metadata?.doorNumber) {
            door.setDoorNumber(data.metadata.doorNumber);
        }

        return door;
    }

    getDoorNumber(): number | null {
        return this._doorNumber;
    }
} 