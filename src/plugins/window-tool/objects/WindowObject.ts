import { BaseObject, BaseObjectData } from '../../../core/objects/BaseObject';
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
import { WindowData as StorageWindowData } from '../../../core/storage/interfaces';
import { WindowData, WindowProperties } from '../types/window';

export interface SerializedWindowData extends BaseObjectData {
    wallId: string;
    position: Point;
    angle: number;
    startNodeId: string;
    endNodeId: string;
    properties: WindowProperties;
    isFlipped: boolean;
    connectedNodes: {
        startWallNodeId?: string;
        endWallNodeId?: string;
    };
}

export class WindowObject extends BaseObject {
    // Konva elements for rendering
    private group?: Group;
    private windowLine?: Line;
    private windowFrame?: Line;
    private startNode?: Circle;
    private endNode?: Circle;
    private windowLabel?: Text;
    private labelBackground?: Rect;

    // Business data
    private data: WindowData;
    private _windowNumber: number | null = null;

    // Visual styles
    private readonly styles = {
        normal: {
            stroke: '#FF69B4', // Pink color for windows
            strokeWidth: 3,
            fill: '#FF69B4'
        },
        selected: {
            stroke: '#FF1493', // Deeper pink when selected
            strokeWidth: 4,
            fill: '#FF1493'
        },
        highlighted: {
            stroke: '#FFB6C1', // Light pink when highlighted
            strokeWidth: 4,
            fill: '#FFB6C1'
        }
    };

    private startNodeObject: NodeObject;
    private endNodeObject: NodeObject;
    private wallGraph: WallGraph;

    constructor(data: Omit<WindowData, 'id'>, wallGraph: WallGraph) {
        const id = uuidv4();
        super(id, SelectableObjectType.WINDOW, data.position, {
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
                color: data.properties.color || '#FF69B4',
                width: data.properties.width || 100,
                height: data.properties.height || 150,
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
        
        // Create actual node objects for the window endpoints
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

    setHeight(height: number): void {
        this.data.properties.height = height;
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

    setWindowNumber(number: number): void {
        this._windowNumber = number;
        this.data.properties.label = `Window_${number}`;
        this.updateLabel();
    }

    // Private methods for visual updates
    private updateVisualStyle(): void {
        const style = this._isSelected ? this.styles.selected :
                     this._isHighlighted ? this.styles.highlighted :
                     this.styles.normal;

        if (this.windowLine) {
            this.windowLine.stroke(style.stroke);
            this.windowLine.strokeWidth(style.strokeWidth);
        }

        if (this.windowFrame) {
            this.windowFrame.stroke(style.stroke);
            this.windowFrame.strokeWidth(style.strokeWidth);
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
        const height = this.data.properties.height;

        // Update window line points (main frame)
        if (this.windowLine) {
            this.windowLine.points([-width/2, 0, width/2, 0]);
        }

        // Update window frame (additional lines for window representation)
        if (this.windowFrame) {
            // Create a more window-like appearance with vertical lines
            const framePoints: number[] = [];
            const numDivisions = 2; // Number of vertical divisions
            const spacing = width / numDivisions;
            
            for (let i = 0; i <= numDivisions; i++) {
                const x = -width/2 + i * spacing;
                // Vertical lines
                framePoints.push(
                    x, -height/4, // Top point
                    x, height/4   // Bottom point
                );
            }
            
            this.windowFrame.points(framePoints);
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
        if (this.windowLabel && this.data.properties.label) {
            this.windowLabel.text(this.data.properties.label);
            this.group?.getLayer()?.batchDraw();
        }
    }

    // Method to connect window nodes to wall nodes
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
        
        this.updateWindowPosition();
    }

    // Method to move the entire window as a unit
    moveTo(newPosition: Point): void {
        const dx = newPosition.x - this.data.position.x;
        const dy = newPosition.y - this.data.position.y;
        
        // Move both nodes
        const startPos = this.startNodeObject.position;
        const endPos = this.endNodeObject.position;
        
        this.startNodeObject.setPosition(startPos.x + dx, startPos.y + dy);
        this.endNodeObject.setPosition(endPos.x + dx, endPos.y + dy);
        
        // Update window position
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

    // Method to update window position based on its nodes
    private updateWindowPosition(): void {
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

    // Method to flip the window
    flipWindow(): void {
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

        // Create main window line
        this.windowLine = new Line({
            points: [-this.data.properties.width/2, 0, this.data.properties.width/2, 0],
            stroke: style.stroke,
            strokeWidth: style.strokeWidth
        });

        // Create window frame with vertical lines
        this.windowFrame = new Line({
            points: this.calculateFramePoints(),
            stroke: style.stroke,
            strokeWidth: style.strokeWidth - 1
        });

        // Create window nodes
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

        // Create window label
        this.windowLabel = new Text({
            x: 0,
            y: -20,
            text: this._windowNumber ? `Window_${this._windowNumber}` : '',
            fontSize: 12,
            fill: '#000000',
            align: 'center',
            offsetX: 0,
            offsetY: 0
        });

        // Add all elements to group in correct order
        this.group.add(this.labelBackground);
        this.group.add(this.windowLine);
        this.group.add(this.windowFrame);
        this.group.add(this.startNode);
        this.group.add(this.endNode);
        this.group.add(this.windowLabel);

        // Add group to layer
        layer.add(this.group);
    }

    private calculateFramePoints(): number[] {
        const width = this.data.properties.width;
        const height = this.data.properties.height;
        const framePoints: number[] = [];
        const numDivisions = 2;
        const spacing = width / numDivisions;
        
        // Reduce the vertical height of the lines to 1/6 of the height (was 1/4)
        const verticalExtent = height / 6;

        for (let i = 0; i <= numDivisions; i++) {
            const x = -width/2 + i * spacing;
            framePoints.push(
                x, -verticalExtent,
                x, verticalExtent
            );
        }

        return framePoints;
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

    getData(): WindowData {
        return { ...this.data };
    }

    destroy(): void {
        this.group?.destroy();
        this.startNodeObject = null as any;
        this.endNodeObject = null as any;
    }

    containsPoint(point: Point): boolean {
        if (!this.group) return false;

        // Get the window's current transform
        const transform = this.group.getAbsoluteTransform();
        
        // Get window endpoints in world coordinates
        const width = this.data.properties.width;
        const halfWidth = width / 2;
        const startPoint = transform.point({ x: -halfWidth, y: 0 });
        const endPoint = transform.point({ x: halfWidth, y: 0 });
        
        // Calculate distance from point to line segment
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return false;
        
        // Calculate projection of point onto line
        const t = (
            (point.x - startPoint.x) * dx +
            (point.y - startPoint.y) * dy
        ) / (length * length);
        
        // If t < 0, closest point is start point
        // If t > 1, closest point is end point
        // Otherwise, closest point is on the line segment
        if (t < 0 || t > 1) return false;
        
        // Calculate closest point on line
        const closestPoint = {
            x: startPoint.x + t * dx,
            y: startPoint.y + t * dy
        };
        
        // Check if point is within threshold distance
        const distanceToLine = Math.sqrt(
            Math.pow(point.x - closestPoint.x, 2) +
            Math.pow(point.y - closestPoint.y, 2)
        );
        
        return distanceToLine <= 5; // 5 pixels threshold
    }

    updatePosition(newPosition: Point): void {
        // Update internal data
        this.data.position = newPosition;
        
        // Update visual representation
        if (this.group) {
            this.group.position(newPosition);
            this.group.getLayer()?.batchDraw();
        }
        
        // Update node positions
        const angle = this.data.angle;
        const halfWidth = this.data.properties.width / 2;
        
        const startPos = {
            x: newPosition.x - Math.cos(angle) * halfWidth,
            y: newPosition.y - Math.sin(angle) * halfWidth
        };
        
        const endPos = {
            x: newPosition.x + Math.cos(angle) * halfWidth,
            y: newPosition.y + Math.sin(angle) * halfWidth
        };
        
        this.startNodeObject.setPosition(startPos.x, startPos.y);
        this.endNodeObject.setPosition(endPos.x, endPos.y);
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

    private findNearestWallNode(position: Point): { nodeId: string, distance: number } | null {
        const nodes = this.wallGraph.getAllNodes();
        let nearestNode: { nodeId: string, distance: number } | null = null;
        let minDistance = Infinity;

        nodes.forEach(node => {
            const distance = Math.sqrt(
                Math.pow(node.position.x - position.x, 2) +
                Math.pow(node.position.y - position.y, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = { nodeId: node.id, distance };
            }
        });

        // Only return if within snapping distance (e.g., 10 pixels)
        return nearestNode && nearestNode.distance <= 10 ? nearestNode : null;
    }

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

        // Update window position and geometry
        this.updateWindowPosition();
    }

    toJSON(): SerializedWindowData {
        return {
            ...super.toJSON(),
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

    fromJSON(data: SerializedWindowData): void {
        super.fromJSON(data);
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
    toStorageData(): StorageWindowData {
        return {
            id: this.id,
            wallId: this.data.wallId,
            position: this.getRelativePosition(),
            width: this.data.properties.width,
            height: this.data.properties.height,
            sillHeight: this.data.properties.sillHeight || 100,
            style: 'default',
            metadata: {
                isOpen: this.data.properties.isOpen,
                color: this.data.properties.color,
                label: this.data.properties.label,
                windowNumber: this._windowNumber
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
        const windowDx = this.data.position.x - startPoint.x;
        const windowDy = this.data.position.y - startPoint.y;
        const windowProjection = (windowDx * dx + windowDy * dy) / wallLength;

        return windowProjection / wallLength;
    }

    // Create from storage format
    static fromStorageData(data: StorageWindowData, wallGraph: WallGraph): WindowObject {
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

        const window = new WindowObject({
            wallId: data.wallId,
            position,
            angle: 0,
            startNodeId: '',
            endNodeId: '',
            properties: {
                width: data.width,
                height: data.height,
                sillHeight: data.sillHeight,
                color: data.metadata?.color || '#FF69B4',
                isOpen: data.metadata?.isOpen || false,
                openDirection: 'left',
                label: data.metadata?.label || ''
            },
            isFlipped: false,
            connectedNodes: {}
        }, wallGraph);

        if (data.metadata?.windowNumber) {
            window.setWindowNumber(data.metadata.windowNumber);
        }

        return window;
    }
} 