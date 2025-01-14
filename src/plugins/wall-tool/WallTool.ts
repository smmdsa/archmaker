import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { CanvasStore } from '../../store/CanvasStore';
import { Point } from '../../core/types/geometry';
import { Line } from 'konva/lib/shapes/Line';
import { NodeObject } from './objects/NodeObject';
import { WallObject } from './objects/WallObject';
import { SelectionStore } from '../../store/SelectionStore';

enum WallToolMode {
    IDLE = 'idle',
    DRAWING = 'drawing',
    MOVING_NODE = 'moving_node',
    SPLITTING_WALL = 'splitting_wall'
}

interface WallToolState {
    mode: WallToolMode;
    isDrawing: boolean;
    startNode: NodeObject | null;
    activeNode: NodeObject | null;
    activeWall: WallObject | null;
    previewLine: Line | null;
    snapThreshold: number;
    isDragging: boolean;
}

const toolManifest = {
    id: 'wall-tool',
    name: 'Wall Tool',
    version: '1.0.0',
    icon: '📏',
    tooltip: 'Draw walls (W)',
    section: 'draw',
    order: 1,
    shortcut: 'w'
};

@ToolPlugin({
    id: 'wall-tool',
    name: 'Wall Tool',
    version: '1.0.0',
    description: 'Tool for drawing walls',
    icon: '📏',
    tooltip: 'Draw walls (W)',
    section: 'draw',
    order: 1,
    shortcut: 'w'
})
export class WallTool extends BaseTool {
    private readonly canvasStore: CanvasStore;
    private readonly selectionStore: SelectionStore;
    private state: WallToolState = {
        mode: WallToolMode.IDLE,
        isDrawing: false,
        startNode: null,
        activeNode: null,
        activeWall: null,
        previewLine: null,
        snapThreshold: 10,
        isDragging: false
    };

    // Add angle constraint properties
    private readonly RECT_ANGLE_SNAP = 90; // For CTRL key
    private readonly ANGLE_SNAP = 15;      // For SHIFT key
    private readonly GRID_SNAP = 10;       // For ALT key

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, 'wall-tool', toolManifest);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
        this.selectionStore = SelectionStore.getInstance(eventManager, logger);
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        switch (event.type) {
            case 'mousedown':
                await this.handleMouseDown(event);
                break;
            case 'mousemove':
                await this.handleMouseMove(event);
                break;
            case 'mouseup':
                await this.handleMouseUp(event);
                break;
        }
    }

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        const graph = this.canvasStore.getWallGraph();
        const hitNode = this.findNodeAtPosition(event.position);

        if (hitNode) {
            if (this.state.mode === WallToolMode.IDLE) {
                // Start node movement
                this.state.activeNode = hitNode;
                this.state.mode = WallToolMode.MOVING_NODE;
                this.state.isDragging = true;
            } else {
                // Start drawing from existing node
                this.state.startNode = hitNode;
                this.state.mode = WallToolMode.DRAWING;
                this.state.isDrawing = true;
                this.initPreviewLine(hitNode.position);
            }
        } else {
            // Check if we hit a wall
            const hitWall = this.findWallAtPosition(event.position);
            if (hitWall && this.state.mode === WallToolMode.IDLE) {
                // Split wall mode
                this.state.activeWall = hitWall;
                this.state.mode = WallToolMode.SPLITTING_WALL;
                await this.handleWallSplit(event.position);
            } else if (this.state.mode === WallToolMode.IDLE) {
                // Create new node and start drawing
                this.state.startNode = graph.createNode(event.position);
                this.state.mode = WallToolMode.DRAWING;
                this.state.isDrawing = true;
                this.initPreviewLine(this.state.startNode.position);
            }
        }
    }

    private async handleMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        switch (this.state.mode) {
            case WallToolMode.DRAWING:
                await this.handleDrawingMouseMove(event);
                break;
            case WallToolMode.MOVING_NODE:
                await this.handleNodeMoveMouseMove(event);
                break;
        }
    }

    private async handleDrawingMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.isDrawing || !this.state.previewLine || !this.state.startNode) return;

        const hitNode = this.findNodeAtPosition(event.position);
        let endPoint = hitNode ? hitNode.position : event.position;

        // Apply grid snap if ALT is pressed
        if (event.originalEvent?.evt.altKey) {
            // First snap the end point to grid
            endPoint = this.snapToGrid(endPoint);
            // Then ensure the distance is also a multiple of grid size
            endPoint = this.snapDistanceToGrid(this.state.startNode.position, endPoint);
        }

        // Apply angle constraints if modifier keys are pressed
        if (event.originalEvent?.evt.ctrlKey || event.originalEvent?.evt.shiftKey) {
            const start = this.state.startNode.position;
            const angle = this.calculateAngle(start, endPoint);
            const distance = this.calculateDistance(start, endPoint);

            let snappedAngle;
            if (event.originalEvent.evt.ctrlKey) {
                // Snap to nearest 90 degrees
                snappedAngle = Math.round(angle / this.RECT_ANGLE_SNAP) * this.RECT_ANGLE_SNAP;
            } else if (event.originalEvent.evt.shiftKey) {
                // Snap to nearest 15 degrees
                snappedAngle = Math.round(angle / this.ANGLE_SNAP) * this.ANGLE_SNAP;
            }

            if (snappedAngle !== undefined) {
                const radians = (snappedAngle * Math.PI) / 180;
                endPoint = {
                    x: start.x + distance * Math.cos(radians),
                    y: start.y + distance * Math.sin(radians)
                };
                
                // If ALT is also pressed, ensure the distance is a multiple of grid size
                if (event.originalEvent.evt.altKey) {
                    endPoint = this.snapDistanceToGrid(start, endPoint);
                }
            }
        }

        // Update preview line
        this.state.previewLine.points([
            this.state.startNode.position.x,
            this.state.startNode.position.y,
            endPoint.x,
            endPoint.y
        ]);

        const layers = this.canvasStore.getLayers();
        layers?.tempLayer.batchDraw();
    }

    private calculateAngle(start: Point, end: Point): number {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        // Calculate angle in degrees (0 to 360)
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle < 0) angle += 360;
        return angle;
    }

    private calculateDistance(start: Point, end: Point): number {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private async handleNodeMoveMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.isDragging || !this.state.activeNode) return;

        const graph = this.canvasStore.getWallGraph();
        const nearestNode = this.findNearestNode(event.position, this.state.activeNode);
        let targetPosition = nearestNode && this.isWithinSnapThreshold(event.position, nearestNode.position) 
            ? nearestNode.position 
            : event.position;

        // Get connected walls to determine reference points for angle constraints
        const connectedWalls = this.state.activeNode.getConnectedWalls()
            .map(id => graph.getWall(id))
            .filter((wall): wall is WallObject => wall !== undefined);

        // Apply grid snap if ALT is pressed
        if (event.originalEvent?.evt.altKey && connectedWalls.length > 0) {
            // First snap the position to grid
            targetPosition = this.snapToGrid(targetPosition);
            
            // Then ensure the distance to connected nodes is a multiple of grid size
            for (const wall of connectedWalls) {
                const otherNodeId = wall.getStartNodeId() === this.state.activeNode.id ? 
                    wall.getEndNodeId() : wall.getStartNodeId();
                const otherNode = graph.getNode(otherNodeId);
                if (otherNode) {
                    targetPosition = this.snapDistanceToGrid(otherNode.position, targetPosition);
                    break; // Only use the first connected wall as reference
                }
            }
        }

        // Apply angle constraints if modifier keys are pressed
        if ((event.originalEvent?.evt.ctrlKey || event.originalEvent?.evt.shiftKey) && connectedWalls.length > 0) {
            // Find the first connected node to use as reference point
            let referenceNode: Point | null = null;
            
            // Try to find a reference node from connected walls
            for (const wall of connectedWalls) {
                const startNodeId = wall.getStartNodeId();
                const endNodeId = wall.getEndNodeId();
                if (startNodeId !== this.state.activeNode.id) {
                    const node = graph.getNode(startNodeId);
                    if (node) {
                        referenceNode = node.position;
                        break;
                    }
                } else if (endNodeId !== this.state.activeNode.id) {
                    const node = graph.getNode(endNodeId);
                    if (node) {
                        referenceNode = node.position;
                        break;
                    }
                }
            }

            if (referenceNode) {
                const angle = this.calculateAngle(referenceNode, targetPosition);
                const distance = this.calculateDistance(referenceNode, targetPosition);

                let snappedAngle;
                if (event.originalEvent.evt.ctrlKey) {
                    // Snap to nearest 90 degrees
                    snappedAngle = Math.round(angle / this.RECT_ANGLE_SNAP) * this.RECT_ANGLE_SNAP;
                } else if (event.originalEvent.evt.shiftKey) {
                    // Snap to nearest 15 degrees
                    snappedAngle = Math.round(angle / this.ANGLE_SNAP) * this.ANGLE_SNAP;
                }

                if (snappedAngle !== undefined) {
                    const radians = (snappedAngle * Math.PI) / 180;
                    targetPosition = {
                        x: referenceNode.x + distance * Math.cos(radians),
                        y: referenceNode.y + distance * Math.sin(radians)
                    };
                    
                    // If ALT is also pressed, ensure the distance is a multiple of grid size
                    if (event.originalEvent.evt.altKey) {
                        targetPosition = this.snapDistanceToGrid(referenceNode, targetPosition);
                    }
                }
            }
        }

        // Update node position
        this.state.activeNode.setPosition(targetPosition.x, targetPosition.y);

        // Update wall geometry based on node movement
        connectedWalls.forEach(wall => {
            if (wall.getStartNodeId() === this.state.activeNode!.id) {
                wall.updateStartPoint(targetPosition);
            } else if (wall.getEndNodeId() === this.state.activeNode!.id) {
                wall.updateEndPoint(targetPosition);
            }

            // Emit wall:moved event
            this.eventManager.emit('wall:moved', {
                wallId: wall.id,
                wall: wall,
                newStartPoint: wall.getData().startPoint,
                newEndPoint: wall.getData().endPoint
            });
        });

        // Force walls to re-render
        const layers = this.canvasStore.getLayers();
        if (layers) {
            connectedWalls.forEach(wall => {
                wall.render(layers.mainLayer);
            });
            // Also re-render the active node to ensure it stays on top
            this.state.activeNode.render(layers.mainLayer);
            layers.mainLayer.batchDraw();
        }
    }

    private async handleMouseUp(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        switch (this.state.mode) {
            case WallToolMode.DRAWING:
                await this.handleDrawingMouseUp(event);
                break;
            case WallToolMode.MOVING_NODE:
                await this.handleNodeMoveMouseUp(event);
                break;
        }

        // Reset state
        this.state.mode = WallToolMode.IDLE;
        this.state.isDragging = false;
    }

    private async handleDrawingMouseUp(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.isDrawing || !this.state.startNode) return;

        const graph = this.canvasStore.getWallGraph();
        let endNode: NodeObject;

        // Check if we're snapping to an existing node
        const hitNode = this.findNodeAtPosition(event.position);
        if (hitNode) {
            endNode = hitNode;
        } else {
            // Create new end node
            endNode = graph.createNode(event.position);
        }

        // Create wall between nodes if they're different
        if (endNode.id !== this.state.startNode.id) {
            const wall = graph.createWall(this.state.startNode.id, endNode.id);
            if (wall) {
                this.logger.info('Wall created', {
                    startNodeId: this.state.startNode.id,
                    endNodeId: endNode.id,
                    wallId: wall.id
                });
            }
        }

        // Clean up
        this.cleanupPreviewLine();
        this.state.isDrawing = false;
        this.state.startNode = null;
    }

    private async handleNodeMoveMouseUp(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.activeNode) return;

        const graph = this.canvasStore.getWallGraph();
        const nearestNode = this.findNearestNode(event.position, this.state.activeNode);

        if (nearestNode && this.isWithinSnapThreshold(event.position, nearestNode.position)) {
            // Merge nodes
            await this.mergeNodes(this.state.activeNode, nearestNode);
        }

        this.state.activeNode = null;
    }

    private async mergeNodes(sourceNode: NodeObject, targetNode: NodeObject): Promise<void> {
        const graph = this.canvasStore.getWallGraph();
        
        // Get all walls connected to source node
        const connectedWalls = sourceNode.getConnectedWalls()
            .map(id => graph.getWall(id))
            .filter((wall): wall is WallObject => wall !== undefined);
        
        // Transfer connections to target node
        for (const wall of connectedWalls) {
            const wallData = wall.getData();
            if (wallData.startNodeId === sourceNode.id) {
                graph.createWall(targetNode.id, wallData.endNodeId);
            } else if (wallData.endNodeId === sourceNode.id) {
                graph.createWall(wallData.startNodeId, targetNode.id);
            }
            graph.removeWall(wall.id);
        }

        // Remove the source node
        graph.removeNode(sourceNode.id);

        // Trigger redraw
        const layers = this.canvasStore.getLayers();
        if (layers) {
            layers.mainLayer.batchDraw();
        }
    }

    private findNodeAtPosition(position: Point): NodeObject | null {
        const graph = this.canvasStore.getWallGraph();
        const nodes = graph.getAllNodes();

        for (const node of nodes) {
            if (node.containsPoint(position)) {
                return node;
            }
        }

        return null;
    }

    private findNearestNode(position: Point, excludeNode: NodeObject): NodeObject | null {
        const graph = this.canvasStore.getWallGraph();
        const nodes = graph.getAllNodes().filter(node => node.id !== excludeNode.id);
        
        let nearestNode: NodeObject | null = null;
        let minDistance = Infinity;

        for (const node of nodes) {
            const distance = this.getDistance(position, node.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = node;
            }
        }

        return nearestNode;
    }

    private isWithinSnapThreshold(p1: Point, p2: Point): boolean {
        return this.getDistance(p1, p2) <= this.state.snapThreshold;
    }

    private getDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private initPreviewLine(startPoint: Point): void {
        const layers = this.canvasStore.getLayers();
        if (!layers) return;

        this.state.previewLine = new Line({
            points: [startPoint.x, startPoint.y, startPoint.x, startPoint.y],
            stroke: '#666',
            strokeWidth: 2,
            dash: [5, 5],
        });

        layers.tempLayer.add(this.state.previewLine);
        layers.tempLayer.batchDraw();
    }

    private cleanupPreviewLine(): void {
        if (this.state.previewLine) {
            this.state.previewLine.destroy();
            this.state.previewLine = null;

            const layers = this.canvasStore.getLayers();
            layers?.tempLayer.batchDraw();
        }
    }

    private findWallAtPosition(position: Point): WallObject | null {
        const graph = this.canvasStore.getWallGraph();
        const walls = graph.getAllWalls();

        for (const wall of walls) {
            if (wall.containsPoint(position)) {
                return wall;
            }
        }

        return null;
    }

    private async handleWallSplit(position: Point): Promise<void> {
        if (!this.state.activeWall) return;

        const graph = this.canvasStore.getWallGraph();
        
        // Create new node at split point
        const newNode = graph.createNode(position);

        // Get the original wall's data
        const wallData = this.state.activeWall.getData();
        
        // Create two new walls
        const wall1 = graph.createWall(wallData.startNodeId, newNode.id);
        const wall2 = graph.createWall(newNode.id, wallData.endNodeId);

        if (wall1 && wall2) {
            // Emit wall:split event before handling doors
            this.eventManager.emit('wall:split', {
                originalWallId: this.state.activeWall.id,
                newWalls: [
                    { id: wall1.id, wall: wall1 },
                    { id: wall2.id, wall: wall2 }
                ]
            });

            // Handle doors on the original wall before removing it
            const doorStore = this.canvasStore.getDoorStore();
            const doorsOnWall = doorStore.getAllDoors()
                .filter(door => door.getData().wallId === this.state.activeWall!.id);

            // For each door, determine which new wall it should be attached to
            doorsOnWall.forEach(door => {
                const doorData = door.getData();
                const doorPos = doorData.position;

                // Calculate relative position of door on original wall
                const wallStartPoint = wallData.startPoint;
                const wallEndPoint = wallData.endPoint;
                const wallLength = this.getDistance(wallStartPoint, wallEndPoint);
                const doorToStartDist = this.getDistance(doorPos, wallStartPoint);
                const relativePosition = doorToStartDist / wallLength;

                // Determine which new wall the door belongs to
                const newWall = relativePosition <= 0.5 ? wall1 : wall2;
                const newWallData = newWall.getData();
                const newWallLength = this.getDistance(newWallData.startPoint, newWallData.endPoint);
                const newDoorDist = relativePosition <= 0.5 ? 
                    (doorToStartDist / wallLength) * newWallLength :
                    ((doorToStartDist - wallLength/2) / (wallLength/2)) * newWallLength;

                // Calculate new door position
                const dx = newWallData.endPoint.x - newWallData.startPoint.x;
                const dy = newWallData.endPoint.y - newWallData.startPoint.y;
                const angle = Math.atan2(dy, dx);
                const newPosition: Point = {
                    x: newWallData.startPoint.x + Math.cos(angle) * newDoorDist,
                    y: newWallData.startPoint.y + Math.sin(angle) * newDoorDist
                };

                // Update door with new wall reference and position
                door.updatePosition(newPosition);
                door.updateWallReference(newWall);

                this.logger.info('Door reassigned after wall split', {
                    doorId: door.id,
                    originalWallId: this.state.activeWall!.id,
                    newWallId: newWall.id,
                    newPosition
                });
            });

            // Remove the original wall
            graph.removeWall(this.state.activeWall.id);

            this.logger.info('Wall split', {
                originalWallId: this.state.activeWall.id,
                newNodeId: newNode.id,
                wall1Id: wall1.id,
                wall2Id: wall2.id,
                affectedDoors: doorsOnWall.map(d => d.id)
            });
        }

        // Reset state
        this.state.activeWall = null;
        this.state.mode = WallToolMode.IDLE;

        // Trigger redraw
        const layers = this.canvasStore.getLayers();
        if (layers) {
            layers.mainLayer.batchDraw();
        }
    }

    private snapToGrid(position: Point): Point {
        return {
            x: Math.round(position.x / this.GRID_SNAP) * this.GRID_SNAP,
            y: Math.round(position.y / this.GRID_SNAP) * this.GRID_SNAP
        };
    }

    private snapDistanceToGrid(start: Point, end: Point): Point {
        // Calculate current distance and angle
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // Snap the distance to nearest grid multiple
        const snappedDistance = Math.round(currentDistance / this.GRID_SNAP) * this.GRID_SNAP;

        // Calculate new end point using snapped distance
        return {
            x: start.x + snappedDistance * Math.cos(angle),
            y: start.y + snappedDistance * Math.sin(angle)
        };
    }

    async activate(): Promise<void> {
        await super.activate();
        this.selectionStore.clearSelection();
    }

    async deactivate(): Promise<void> {
        this.cleanupPreviewLine();
        this.state = {
            mode: WallToolMode.IDLE,
            isDrawing: false,
            startNode: null,
            activeNode: null,
            activeWall: null,
            previewLine: null,
            snapThreshold: 10,
            isDragging: false
        };
        await super.deactivate();
    }
}
