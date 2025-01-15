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
import { KonvaEventObject } from 'konva/lib/Node';
import { v4 as uuidv4 } from 'uuid';

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
    snapThreshold: number;
    isDragging: boolean;
    selectedWall: WallObject | null;
    selectedNode: NodeObject | null;
    dragStartPosition: Point | null;
    dragOffset: Point | null;
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
        snapThreshold: 10,
        isDragging: false,
        selectedWall: null,
        selectedNode: null,
        dragStartPosition: null,
        dragOffset: null
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

        // Subscribe to wall removal events
        this.eventManager.on('wall:removed', (event: { wallId: string }) => {
            // If the removed wall was selected, reset the tool state
            if (this.state.selectedWall?.id === event.wallId) {
                this.resetToolState();
            }
        });

        // Subscribe to double-click events on wall objects
        this.eventManager.on('wall:dblclick', async (event: { wallId: string, position: Point }) => {
            if (!this.isActive()) return;

            this.logger.info('Double click on wall detected:', event);
            
            const wall = this.canvasStore.getWallGraph().getWall(event.wallId);
            if (wall) {
                this.logger.info('Wall hit on double click:', wall.id);
                this.state.activeWall = wall;
                this.state.mode = WallToolMode.SPLITTING_WALL;
                await this.handleWallSplit(event.position);
            }
        });

        // Subscribe to selection changes
        this.eventManager.on('selection:changed', (event: { 
            selectedNodes: string[],
            selectedWalls: string[],
            selectedDoors: string[],
            selectedWindows: string[],
            source: string 
        }) => {
            // Skip if we're the source of the event to avoid state race conditions
            if (event.source === 'wall-tool') {
                return;
            }

            const graph = this.canvasStore.getWallGraph();
            
            // Update our internal state to match selection
            if (event.selectedWalls.length === 1) {
                const selectedWall = graph.getWall(event.selectedWalls[0]);
                if (selectedWall) {
                    this.state.selectedWall = selectedWall;
                    selectedWall.setSelected(true);
                    selectedWall.setHighlighted(true);
                    
                } else {
                    // If the wall doesn't exist anymore, reset state
                    this.resetToolState();
                }
            } else {
                if (this.state.selectedWall) {
                    this.state.selectedWall.setSelected(false);
                    this.state.selectedWall.setHighlighted(false);
                    

                }
                this.resetToolState();
            }
        });
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
            case 'dblclick' as string:  // Type assertion to handle custom event type
                await this.handleWallSplit(event.position);
                break;
        }
    }

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        const graph = this.canvasStore.getWallGraph();
        const hitNode = this.findNodeAtPosition(event.position);
        this.logger.info('handleMouseDown: Mouse down', this.state.mode);
        if (hitNode) {
            this.logger.info('handleMouseDown: Node hit 1');
            // Always select the node when hit and prepare for potential movement
            this.state.selectedNode = hitNode;
            this.state.activeNode = hitNode;
            this.state.mode = WallToolMode.MOVING_NODE;
            this.state.isDragging = true;
            this.state.dragStartPosition = { ...event.position };
            this.state.dragOffset = {
                x: event.position.x - hitNode.position.x,
                y: event.position.y - hitNode.position.y
            };

            hitNode.setSelected(true);
            hitNode.setHighlighted(true);
            this.logger.info('handleMouseDown: Node hit 2', this.state.mode);
            // Emit selection event
            this.eventManager.emit('selection:changed', {
                selectedNodes: [hitNode.id],
                selectedWalls: [],
                selectedDoors: [],
                selectedWindows: [],
                source: 'wall-tool'
            });
            this.logger.info('handleMouseDown: Node hit 3', this.state.mode);


            this.logger.info('handleMouseDown: Node selected and prepared for movement:', {
                nodeId: hitNode.id,
                position: hitNode.position,
                dragOffset: this.state.dragOffset
            });
            this.logger.info('handleMouseDown: Node hit 4', this.state.mode);
        } else {
            this.logger.info('handleMouseDown: Node hit 5', this.state.mode);
            // Check if we hit a wall
            const hitWall = this.findWallAtPosition(event.position);
            if (hitWall) {
                if (this.state.mode === WallToolMode.IDLE) {
                    // Select the wall
                    this.state.selectedWall = hitWall;
                    hitWall.setSelected(true);
                    hitWall.setHighlighted(true);

                    // Emit selection event
                    this.eventManager.emit('selection:changed', {
                        selectedNodes: [],
                        selectedWalls: [hitWall.id],
                        selectedDoors: [],
                        selectedWindows: [],
                        source: 'wall-tool'
                    });


                }
            } else if (this.state.mode === WallToolMode.IDLE) {
                // Clear selection when clicking empty space
                if (this.state.selectedWall) {
                    this.state.selectedWall.setSelected(false);
                    this.state.selectedWall.setHighlighted(false);
                    

                    
                    // Emit empty selection event
                    this.eventManager.emit('selection:changed', {
                        selectedNodes: [],
                        selectedWalls: [],
                        selectedDoors: [],
                        selectedWindows: [],
                        source: 'wall-tool'
                    });
                }
                
                if (this.state.selectedNode) {
                    this.state.selectedNode.setSelected(false);
                    this.state.selectedNode.setHighlighted(false);
                    

                }
                
                // Create new node and start drawing
                this.state.startNode = graph.createNode(event.position);
                this.state.mode = WallToolMode.DRAWING;
                this.state.isDrawing = true;
                this.initPreviewLine(this.state.startNode.position);
            }
        }
        this.logger.info('handleMouseDown: Mouse down 6', this.state.mode);
    }

    private async handleMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position) return;
        switch (this.state.mode) {
            case WallToolMode.MOVING_NODE:
                if (this.state.activeNode && this.state.isDragging && this.state.dragOffset) {
                    let targetPosition = {
                        x: event.position.x - this.state.dragOffset.x,
                        y: event.position.y - this.state.dragOffset.y
                    };

                    // Get connected walls and find a reference node for angle constraints
                    const connectedWalls = this.state.activeNode.getConnectedWalls()
                        .map(id => this.canvasStore.getWallGraph().getWall(id))
                        .filter((wall): wall is WallObject => wall !== undefined);

                    // Find reference node from connected walls
                    let referenceNode: Point | null = null;
                    if (connectedWalls.length > 0) {
                        const wall = connectedWalls[0];
                        const otherNodeId = wall.getStartNodeId() === this.state.activeNode.id ? 
                            wall.getEndNodeId() : wall.getStartNodeId();
                        const otherNode = this.canvasStore.getWallGraph().getNode(otherNodeId);
                        if (otherNode) {
                            referenceNode = otherNode.position;
                        }
                    }

                    // Apply modifier constraints
                    targetPosition = this.applyModifierConstraints(targetPosition, referenceNode, event);

                    // Prepare preview data for connected walls
                    const previewWalls = connectedWalls.map(wall => {
                        const wallData = wall.getData();
                        const isStart = wall.getStartNodeId() === this.state.activeNode!.id;
                        return {
                            start: isStart ? targetPosition : wallData.startPoint,
                            end: isStart ? wallData.endPoint : targetPosition
                        };
                    });

                    // Emit preview event
                    this.eventManager.emit('canvas:preview', {
                        data: {
                            type: 'node',
                            position: targetPosition,
                            connectedWalls: previewWalls
                        }
                    });

                    this.logger.info('Moving node:', {
                        nodeId: this.state.activeNode.id,
                        newPosition: targetPosition,
                        modifiers: {
                            ctrl: (event.originalEvent as MouseEvent)?.ctrlKey,
                            shift: (event.originalEvent as MouseEvent)?.shiftKey,
                            alt: (event.originalEvent as MouseEvent)?.altKey
                        }
                    });
                }
                break;
            case WallToolMode.DRAWING:
                this.logger.info('Drawing mouse move');
                await this.handleDrawingMouseMove(event);
                break;
        }
    }

    private async handleDrawingMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.isDrawing || !this.state.startNode) return;

        const hitNode = this.findNodeAtPosition(event.position);
        let endPoint = hitNode ? hitNode.position : event.position;

        // Apply modifier constraints using start node as reference
        endPoint = this.applyModifierConstraints(endPoint, this.state.startNode.position, event);

        // Emit preview event
        this.eventManager.emit('canvas:preview', {
            data: {
                type: 'wall',
                start: this.state.startNode.position,
                end: endPoint,
                thickness: 10 // Use default thickness
            }
        });
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

    private async handleMouseUp(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        switch (this.state.mode) {
            case WallToolMode.DRAWING:
                await this.handleDrawingMouseUp(event);
                break;
            case WallToolMode.MOVING_NODE:
                if (this.state.activeNode && this.state.dragOffset) {
                    const graph = this.canvasStore.getWallGraph();
                    const nearestNode = this.findNodeAtPosition(event.position);

                    if (nearestNode && nearestNode !== this.state.activeNode) {
                        // Merge nodes if we're dropping onto another node
                        await this.mergeNodes(this.state.activeNode, nearestNode);
                        this.state.selectedNode = nearestNode;
                        nearestNode.setSelected(true);
                        nearestNode.setHighlighted(true);
                    } else {
                        // Calculate final position
                        let finalPosition = {
                            x: event.position.x - this.state.dragOffset.x,
                            y: event.position.y - this.state.dragOffset.y
                        };

                        // Apply final constraints
                        finalPosition = this.applyModifierConstraints(
                            finalPosition, 
                            this.state.dragStartPosition || null, 
                            event
                        );

                        // Update node position
                        this.state.activeNode.setPosition(finalPosition.x, finalPosition.y);

                        // Update connected walls
                        const connectedWalls = this.state.activeNode.getConnectedWalls()
                            .map(id => graph.getWall(id))
                            .filter((wall): wall is WallObject => wall !== undefined);

                        connectedWalls.forEach(wall => {
                            if (wall.getStartNodeId() === this.state.activeNode!.id) {
                                wall.updateStartPoint(finalPosition);
                            } else if (wall.getEndNodeId() === this.state.activeNode!.id) {
                                wall.updateEndPoint(finalPosition);
                            }

                            // Emit wall:moved event
                            this.eventManager.emit('wall:moved', {
                                wallId: wall.id,
                                wall: wall,
                                newStartPoint: wall.getData().startPoint,
                                newEndPoint: wall.getData().endPoint
                            });
                        });

                        // Emit node:changed event
                        this.eventManager.emit('node:changed', {
                            nodeId: this.state.activeNode.id,
                            node: this.state.activeNode,
                            position: finalPosition
                        });

                        // Emit graph:changed event to trigger a full update
                        this.eventManager.emit('graph:changed', {
                            nodeCount: graph.getAllNodes().length,
                            wallCount: graph.getAllWalls().length,
                            roomCount: 0,
                            doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
                            windowCount: this.canvasStore.getWindowStore().getAllWindows().length
                        });

                        // Keep the moved node selected
                        this.state.selectedNode = this.state.activeNode;
                        this.state.activeNode.setSelected(true);
                        this.state.activeNode.setHighlighted(true);
                    }

                    // Clear preview
                    this.eventManager.emit('canvas:preview', { data: null });

                    this.logger.info('Node movement completed:', {
                        nodeId: this.state.selectedNode.id,
                        finalPosition: this.state.selectedNode.position
                    });
                }
                break;
        }

        // Reset dragging state but maintain selection
        this.state.isDragging = false;
        this.state.activeNode = null;
        this.state.dragStartPosition = null;
        this.state.dragOffset = null;
        this.state.mode = WallToolMode.IDLE;
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
        // Emit initial preview event
        this.eventManager.emit('canvas:preview', {
            data: {
                type: 'wall',
                start: startPoint,
                end: startPoint,
                thickness: 10
            }
        });
    }

    private cleanupPreviewLine(): void {
        // Clear preview
        this.eventManager.emit('canvas:preview', {
            data: null
        });
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

    private async handleWallSplit(point: Point): Promise<void> {
        // Find the wall that was clicked
        const wall = this.findWallAtPosition(point);
        if (!wall) return;

        // Get the wall data before removing it
        const wallData = wall.getData();
        const wallId = wall.id;

        // Create new node at split point
        const newNode = this.canvasStore.getWallGraph().createNode(point);
        if (!newNode) return;

        // Create two new walls connecting to the new node
        const wall1 = this.canvasStore.getWallGraph().createWall(
            wallData.startNodeId,
            newNode.id
        );

        const wall2 = this.canvasStore.getWallGraph().createWall(
            newNode.id,
            wallData.endNodeId
        );

        if (!wall1 || !wall2) {
            this.logger.error('Failed to create new walls during split');
            return;
        }

        // Emit wall:split event before removing the original wall
        this.eventManager.emit('wall:split', {
            originalWallId: wallId,
            newWalls: [
                { id: wall1.id, wall: wall1 },
                { id: wall2.id, wall: wall2 }
            ]
        });

        // Remove the original wall
        this.canvasStore.getWallGraph().removeWall(wallId);

        // Emit graph changed event
        this.eventManager.emit('graph:changed', {
            nodeCount: this.canvasStore.getWallGraph().getAllNodes().length,
            wallCount: this.canvasStore.getWallGraph().getAllWalls().length,
            doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
            windowCount: this.canvasStore.getWindowStore().getAllWindows().length
        });
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
            snapThreshold: 10,
            isDragging: false,
            selectedWall: null,
            selectedNode: null,
            dragStartPosition: null,
            dragOffset: null
        };
        await super.deactivate();
    }

    private resetToolState(): void {
        this.state.selectedWall = null;
        this.state.selectedNode = null;
        this.state.activeWall = null;
        this.state.activeNode = null;
        this.state.startNode = null;
        this.state.isDrawing = false;
        this.state.isDragging = false;
        this.state.mode = WallToolMode.IDLE;
        this.cleanupPreviewLine();
    }

    private applyModifierConstraints(
        position: Point,
        referencePoint: Point | null,
        event: CanvasEvent
    ): Point {
        let result = { ...position };

        if (!referencePoint) return result;

        // Get modifier keys from the original event
        const mouseEvent = event.originalEvent as MouseEvent;
        
        this.logger.info('Applying modifier constraints:', {
            position,
            referencePoint,
            modifiers: {
                ctrl: mouseEvent?.ctrlKey,
                shift: mouseEvent?.shiftKey,
                alt: mouseEvent?.altKey
            }
        });
        
        // Apply angle constraints (CTRL or SHIFT)
        if (mouseEvent?.ctrlKey || mouseEvent?.shiftKey) {
            const angle = this.calculateAngle(referencePoint, result);
            const distance = this.calculateDistance(referencePoint, result);

            let snappedAngle;
            if (mouseEvent.ctrlKey) {
                // Snap to nearest 90 degrees
                snappedAngle = Math.round(angle / this.RECT_ANGLE_SNAP) * this.RECT_ANGLE_SNAP;
                this.logger.info('Snapping to 90 degrees:', { originalAngle: angle, snappedAngle });
            } else if (mouseEvent.shiftKey) {
                // Snap to nearest 15 degrees
                snappedAngle = Math.round(angle / this.ANGLE_SNAP) * this.ANGLE_SNAP;
                this.logger.info('Snapping to 15 degrees:', { originalAngle: angle, snappedAngle });
            }

            if (snappedAngle !== undefined) {
                const radians = (snappedAngle * Math.PI) / 180;
                result = {
                    x: referencePoint.x + distance * Math.cos(radians),
                    y: referencePoint.y + distance * Math.sin(radians)
                };
            }
        }

        // Apply grid snap (ALT)
        if (mouseEvent?.altKey) {
            // First snap the position to grid
            result = this.snapToGrid(result);
            // Then ensure the distance is also a multiple of grid size
            result = this.snapDistanceToGrid(referencePoint, result);
            this.logger.info('Snapping to grid:', { originalPosition: position, snappedPosition: result });
        }

        return result;
    }
}
