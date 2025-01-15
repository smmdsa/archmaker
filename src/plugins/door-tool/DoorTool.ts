import { Point } from '../../core/types/geometry';
import { CanvasStore } from '../../store/CanvasStore';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import { BaseTool } from '../../core/tools/BaseTool';
import { DoorObject } from './objects/DoorObject';
import { DoorStore } from './stores/DoorStore';
import { WallObject } from '../wall-tool/objects/WallObject';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { v4 as uuidv4 } from 'uuid';
import type { DoorData } from './objects/DoorObject';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { WallGraph } from '../wall-tool/models/WallGraph';
import { DoorNode } from './objects/DoorNode';

enum DoorToolMode {
    IDLE = 'idle',
    SELECTING_WALL = 'selecting_wall',
    PLACING_DOOR = 'placing_door',
    MOVING_DOOR = 'moving_door',
    DRAGGING_DOOR = 'dragging_door',
    DRAGGING_NODE = 'dragging_node'
}

interface DoorToolState {
    mode: DoorToolMode;
    selectedWall: WallObject | null;
    selectedDoor: DoorObject | null;
    selectedNode: DoorNode | null;
    doorPosition: Point | null;
    dragStartPosition: Point | null;
    dragOffset: Point | null;
}

interface DoorProperties {
    width: number;
    color: string;
    isOpen: boolean;
    openDirection: 'left' | 'right';
}

const toolManifest = {
    id: 'door-tool',
    name: 'Door Tool',
    version: '1.0.0',
    icon: '🚪',
    tooltip: 'Place doors on walls (D)',
    section: 'architecture',
    order: 3,
    shortcut: 'd'
};

@ToolPlugin(toolManifest)
export class DoorTool extends BaseTool {
    private state: DoorToolState = {
        mode: DoorToolMode.IDLE,
        selectedWall: null,
        selectedDoor: null,
        selectedNode: null,
        doorPosition: null,
        dragStartPosition: null,
        dragOffset: null
    };
    
    private doorStore: DoorStore;
    private wallGraph: WallGraph;
    private canvasStore: CanvasStore;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, 'door-tool', toolManifest);
        
        this.doorStore = DoorStore.getInstance(eventManager, logger);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
        this.wallGraph = this.canvasStore.getWallGraph();

        // Subscribe to wall movement events
        this.eventManager.on('wall:moved', (event: { 
            wallId: string, 
            wall: WallObject,
            newStartPoint: Point,
            newEndPoint: Point 
        }) => {
            this.handleWallMovement(event);
        });

        // Subscribe to wall split events
        this.eventManager.on('wall:split', (event: { 
            originalWallId: string,
            newWalls: { id: string, wall: WallObject }[]
        }) => {
            this.handleWallSplit(event);
        });

        // Subscribe to keyboard events for door flipping
        this.eventManager.on('keyboard:keydown', (event: KeyboardEvent) => {
            if (this.isActive() && event.key.toLowerCase() === 'f') {
                this.logger.info('Door tool: F key pressed, attempting to flip door', {
                    selectedDoor: this.state.selectedDoor?.id
                });
                this.flipSelectedDoor();
                event.preventDefault();
                event.stopPropagation();
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
            // Update our internal state to match selection
            if (event.selectedDoors.length === 1) {
                const selectedDoor = this.doorStore.getDoor(event.selectedDoors[0]);
                if (selectedDoor) {
                    this.state.selectedDoor = selectedDoor;
                    selectedDoor.setSelected(true);
                    selectedDoor.setHighlighted(true);
                    
                    // Trigger re-render
                    this.eventManager.emit('door:changed', {
                        doorId: selectedDoor.id,
                        door: selectedDoor
                    });
                } else {
                    // If the door doesn't exist anymore, reset state
                    this.resetToolState();
                }
            } else {
                if (this.state.selectedDoor) {
                    this.state.selectedDoor.setSelected(false);
                    this.state.selectedDoor.setHighlighted(false);
                    
                    // Trigger re-render
                    this.eventManager.emit('door:changed', {
                        doorId: this.state.selectedDoor.id,
                        door: this.state.selectedDoor
                    });
                }
                this.resetToolState();
            }
        });

        // Subscribe to right-click events
        this.eventManager.on('canvas:contextmenu', (event: MouseEvent) => {
            if (this.isActive() && this.state.selectedDoor) {
                event.preventDefault();
                event.stopPropagation();
                this.flipSelectedDoor();
            }
        });
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        switch (event.type) {
            case 'mousemove':
                await this.handleMouseMove(event.position);
                break;
            case 'mousedown':
                await this.handleMouseDown(event);
                break;
            case 'mouseup':
                await this.handleMouseUp(event.position);
                break;
        }
    }

    private calculateDoorAngle(wall: WallObject): number {
        const data = wall.getData();
        const startNode = this.wallGraph.getNode(data.startNodeId);
        const endNode = this.wallGraph.getNode(data.endNodeId);
        
        if (!startNode || !endNode) {
            this.logger.error('Failed to calculate door angle: missing wall nodes');
            return 0;
        }
        
        // Calculate angle from wall direction
        const dx = endNode.position.x - startNode.position.x;
        const dy = endNode.position.y - startNode.position.y;
        return Math.atan2(dy, dx);
    }

    private resetToolState(): void {
        this.state.selectedDoor = null;
        this.state.dragOffset = null;
        this.state.dragStartPosition = null;
        this.state.mode = DoorToolMode.IDLE;
        // Clear any preview
        this.eventManager.emit('canvas:preview', { data: null });
    }

    private flipSelectedDoor(): void {
        if (!this.state.selectedDoor) {
            this.logger.warn('Door tool: No door selected for flipping');
            return;
        }

        try {
            this.state.selectedDoor.flipDoor();
            
            // Trigger re-render
            this.eventManager.emit('door:changed', {
                doorId: this.state.selectedDoor.id,
                door: this.state.selectedDoor
            });

            this.logger.info('Door tool: Door flipped', {
                doorId: this.state.selectedDoor.id
            });
        } catch (error) {
            this.logger.error('Door tool: Failed to flip door', error instanceof Error ? error : new Error('Unknown error'));
        }
    }

    private handleWallMovement(event: { 
        wallId: string, 
        wall: WallObject,
        newStartPoint: Point,
        newEndPoint: Point 
    }): void {
        // Find all doors on this wall
        const doorsOnWall = this.doorStore.getAllDoors()
            .filter(door => door.getData().wallId === event.wallId);

        if (doorsOnWall.length === 0) return;

        // Update each door's position
        doorsOnWall.forEach(door => {
            const doorData = door.getData();
            
            // Calculate relative position along wall (0 to 1)
            const oldWallData = event.wall.getData();
            const oldWallLength = this.getDistance(oldWallData.startPoint, oldWallData.endPoint);
            const doorToStartDist = this.getDistance(doorData.position, oldWallData.startPoint);
            const relativePosition = doorToStartDist / oldWallLength;

            // Calculate new position using the same relative position
            const newWallLength = this.getDistance(event.newStartPoint, event.newEndPoint);
            const newDoorDist = relativePosition * newWallLength;
            const dx = event.newEndPoint.x - event.newStartPoint.x;
            const dy = event.newEndPoint.y - event.newStartPoint.y;
            const angle = Math.atan2(dy, dx);

            const newPosition: Point = {
                x: event.newStartPoint.x + Math.cos(angle) * newDoorDist,
                y: event.newStartPoint.y + Math.sin(angle) * newDoorDist
            };

            // Update door position and angle
            door.updatePosition(newPosition);
            door.updateWallReference(event.wall);

            // Trigger re-render
            this.eventManager.emit('door:changed', {
                doorId: door.id,
                door: door
            });
        });

        this.logger.info('Door tool: Updated doors after wall movement', {
            wallId: event.wallId,
            updatedDoors: doorsOnWall.map(d => d.id)
        });
    }

    private handleWallSplit(event: {
        originalWallId: string,
        newWalls: { id: string, wall: WallObject }[]
    }): void {
        // Get all doors that were on the original wall
        const affectedDoors = this.doorStore.getAllDoors()
            .filter(door => door.getData().wallId === event.originalWallId);

        if (affectedDoors.length === 0) return;

        this.logger.info('Door tool: Handling wall split', {
            originalWallId: event.originalWallId,
            newWallIds: event.newWalls.map(w => w.id),
            affectedDoors: affectedDoors.map(d => d.id)
        });

        // For each affected door, determine which wall segment it should belong to
        affectedDoors.forEach(door => {
            const doorPos = door.getData().position;
            
            // Find which new wall segment the door overlaps with or is closest to
            let bestWall = event.newWalls[0].wall;
            let bestDistance = Infinity;
            let bestProjection = 0;

            for (const { wall } of event.newWalls) {
                const wallData = wall.getData();
                const startPoint = wallData.startPoint;
                const endPoint = wallData.endPoint;

                // Calculate wall vector
                const wallDx = endPoint.x - startPoint.x;
                const wallDy = endPoint.y - startPoint.y;
                const wallLengthSq = wallDx * wallDx + wallDy * wallDy;

                // Calculate projection of door position onto wall line
                const doorDx = doorPos.x - startPoint.x;
                const doorDy = doorPos.y - startPoint.y;
                const projection = (doorDx * wallDx + doorDy * wallDy) / wallLengthSq;

                // Calculate perpendicular distance to wall
                const projectedX = startPoint.x + projection * wallDx;
                const projectedY = startPoint.y + projection * wallDy;
                const distance = this.getDistance(doorPos, { x: projectedX, y: projectedY });

                // Check if door projects onto this wall segment (with small tolerance)
                if (projection >= -0.01 && projection <= 1.01) {
                    // Door overlaps this wall segment
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestWall = wall;
                        bestProjection = projection;
                    }
                } else if (distance < bestDistance) {
                    // Door doesn't overlap but might be closest to this segment
                    bestDistance = distance;
                    bestWall = wall;
                    bestProjection = Math.max(0, Math.min(1, projection));
                }
            }

            // Calculate the new position on the best wall
            const bestWallData = bestWall.getData();
            const wallDx = bestWallData.endPoint.x - bestWallData.startPoint.x;
            const wallDy = bestWallData.endPoint.y - bestWallData.startPoint.y;
            const newPosition = {
                x: bestWallData.startPoint.x + bestProjection * wallDx,
                y: bestWallData.startPoint.y + bestProjection * wallDy
            };

            // Update door position and wall reference
            door.updatePosition(newPosition);
            door.updateWallReference(bestWall);

            // Trigger re-render
            this.eventManager.emit('door:changed', {
                doorId: door.id,
                door: door
            });

            this.logger.info('Door tool: Reassigned door after wall split', {
                doorId: door.id,
                originalWallId: event.originalWallId,
                newWallId: bestWall.id,
                originalPosition: doorPos,
                newPosition: newPosition,
                distanceToWall: bestDistance,
                projectionOnWall: bestProjection
            });
        });

        // Emit graph changed event to update counts
        this.eventManager.emit('graph:changed', {
            nodeCount: this.wallGraph.getAllNodes().length,
            wallCount: this.wallGraph.getAllWalls().length,
            doorCount: this.doorStore.getAllDoors().length,
            windowCount: this.canvasStore.getWindowStore().getAllWindows().length
        });
    }

    private getDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private getDistanceToWall(point: Point, wall: WallObject): number {
        const wallData = wall.getData();
        const start = wallData.startPoint;
        const end = wallData.endPoint;

        // Calculate wall vector
        const wallDx = end.x - start.x;
        const wallDy = end.y - start.y;
        const wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);

        if (wallLength === 0) return Infinity;

        // Calculate perpendicular distance using the point-to-line formula
        const distance = Math.abs(
            (wallDy * point.x - wallDx * point.y + end.x * start.y - end.y * start.x) / wallLength
        );

        return distance;
    }

    private async handleMouseMove(point: Point): Promise<void> {
        this.logger.info('Door tool: Mouse move', {
            point,
            currentMode: this.state.mode,
            hasSelectedWall: !!this.state.selectedWall,
            hasSelectedDoor: !!this.state.selectedDoor
        });

        switch (this.state.mode) {
            case DoorToolMode.SELECTING_WALL:
                // Find wall under cursor
                const walls = this.wallGraph.getAllWalls();
                let nearestWall: WallObject | null = null;

                // Log total walls being checked
                this.logger.info('Door tool: Checking walls for hit detection', {
                    totalWalls: walls.length,
                    mousePosition: point
                });

                for (const wall of walls) {
                    if (wall.containsPoint(point)) {
                        nearestWall = wall;
                        this.logger.info('Door tool: Mouse is over wall', {
                            wallId: wall.id,
                            wallData: wall.getData(),
                            mousePosition: point,
                            wallStart: wall.getData().startPoint,
                            wallEnd: wall.getData().endPoint
                        });
                        break;
                    }
                }

                // Update highlighted wall
                if (this.state.selectedWall && this.state.selectedWall !== nearestWall) {
                    this.state.selectedWall.setHighlighted(false);
                }
                if (nearestWall && nearestWall !== this.state.selectedWall) {
                    nearestWall.setHighlighted(true);
                }
                this.state.selectedWall = nearestWall;

                // Update door position and preview
                if (nearestWall) {
                    const newPosition = this.getNearestPointOnWall(point, nearestWall);
                    this.state.doorPosition = newPosition;
                    
                    // Emit preview event
                    this.eventManager.emit('canvas:preview', {
                        data: {
                            type: 'door',
                            position: newPosition,
                            angle: this.calculateDoorAngle(nearestWall),
                            width: 100, // Default door width
                            isFlipped: false
                        }
                    });
                } else {
                    // Clear preview if no wall is found
                    this.eventManager.emit('canvas:preview', { data: null });
                }
                break;

            case DoorToolMode.MOVING_DOOR:
            case DoorToolMode.DRAGGING_DOOR:
                if (!this.state.selectedDoor || !this.state.dragOffset) {
                    this.resetToolState();
                    return;
                }

                const nearestWallForDrag = this.findNearestWall(point);
                if (nearestWallForDrag) {
                    // Calculate new position on the wall
                    const newPos = this.getNearestPointOnWall(point, nearestWallForDrag);
                    
                    // Emit preview event for dragging
                    const doorData = this.state.selectedDoor.getData();
                    this.eventManager.emit('canvas:preview', {
                        data: {
                            type: 'door',
                            position: newPos,
                            angle: this.calculateDoorAngle(nearestWallForDrag),
                            width: doorData.properties.width,
                            isFlipped: doorData.isFlipped
                        }
                    });
                } else {
                    // Clear preview if no wall is found
                    this.eventManager.emit('canvas:preview', { data: null });
                }
                break;

            case DoorToolMode.DRAGGING_NODE:
                if (!this.state.selectedNode || !this.state.selectedDoor || !this.state.dragOffset) {
                    this.resetToolState();
                    return;
                }

                const nearestWallForNode = this.findNearestWall(point);
                if (nearestWallForNode) {
                    // Calculate new position on the wall
                    const newPos = this.getNearestPointOnWall(point, nearestWallForNode);
                    
                    // Move the node (which will update both nodes through the DoorNode's move method)
                    this.state.selectedNode.move(newPos);
                    
                    // Update preview
                    const doorData = this.state.selectedDoor.getData();
                    this.eventManager.emit('canvas:preview', {
                        data: {
                            type: 'door',
                            position: doorData.position,
                            angle: doorData.angle,
                            width: doorData.properties.width,
                            isFlipped: doorData.isFlipped
                        }
                    });
                } else {
                    this.eventManager.emit('canvas:preview', { data: null });
                }
                break;
        }
    }

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position) {
            this.logger.warn('Door tool: Mouse down event without position');
            return;
        }

        this.logger.info('Door tool: Mouse down', {
            position: event.position,
            currentMode: this.state.mode,
            button: event.originalEvent instanceof MouseEvent ? event.originalEvent.button : 'unknown'
        });

        // First, check if we hit a door node
        const nodeHit = this.findDoorNodeAtPosition(event.position);
        if (nodeHit) {
            this.logger.info('Door tool: Hit door node', {
                nodeId: nodeHit.node.id,
                doorId: nodeHit.door.id,
                isEndpoint: nodeHit.node.isEndpointNode()
            });

            // Select the door and node
            this.state.selectedDoor = nodeHit.door;
            this.state.selectedNode = nodeHit.node;
            this.state.mode = DoorToolMode.DRAGGING_NODE;

            // Calculate drag offset
            const nodePos = nodeHit.node.getData().position;
            this.state.dragOffset = {
                x: event.position.x - nodePos.x,
                y: event.position.y - nodePos.y
            };
            this.state.dragStartPosition = event.position;

            // Update selection
            this.doorStore.getAllDoors().forEach(door => {
                if (door !== nodeHit.door) {
                    door.setSelected(false);
                    door.setHighlighted(false);
                }
            });
            nodeHit.door.setSelected(true);
            nodeHit.door.setHighlighted(true);

            return;
        }

        // If we didn't hit a node, check for door hit
        const hitDoor = this.findDoorAtPosition(event.position);
        
        if (hitDoor) {
            this.logger.info('Door tool: Hit existing door', {
                doorId: hitDoor.id,
                position: event.position
            });
            // Clear any existing selection
            this.doorStore.getAllDoors().forEach(door => {
                if (door !== hitDoor) {
                    door.setSelected(false);
                    door.setHighlighted(false);
                }
            });

            // Select and highlight the hit door
            hitDoor.setSelected(true);
            hitDoor.setHighlighted(true);
            this.state.selectedDoor = hitDoor;

            // Emit selection event
            this.eventManager.emit('selection:changed', {
                selectedNodes: [],
                selectedWalls: [],
                selectedDoors: [hitDoor.id],
                selectedWindows: [],
                source: 'door-tool'
            });

            // Calculate drag offset
            const doorPos = hitDoor.getData().position;
            this.state.dragOffset = {
                x: event.position.x - doorPos.x,
                y: event.position.y - doorPos.y
            };
            this.state.dragStartPosition = event.position;

            // Set mode based on mouse button
            if (event.originalEvent instanceof MouseEvent && event.originalEvent.button === 0) {
                this.state.mode = DoorToolMode.DRAGGING_DOOR;
            } else {
                this.state.mode = DoorToolMode.MOVING_DOOR;
            }

            return;
        }

        // If we didn't hit a door, clear selection
        if (this.state.selectedDoor) {
            this.state.selectedDoor.setSelected(false);
            this.state.selectedDoor.setHighlighted(false);
            
            // Emit empty selection event
            this.eventManager.emit('selection:changed', {
                selectedNodes: [],
                selectedWalls: [],
                selectedDoors: [],
                selectedWindows: [],
                source: 'door-tool'
            });
            
            this.state.selectedDoor = null;
            this.state.dragOffset = null;
            this.state.dragStartPosition = null;
            this.state.mode = DoorToolMode.IDLE;
        }

        // Handle wall selection for door placement
        if (this.state.mode === DoorToolMode.IDLE) {
            this.state.mode = DoorToolMode.SELECTING_WALL;
            this.logger.info('Door tool: Entering wall selection mode');
        }
    }

    private async handleMouseUp(point: Point): Promise<void> {
        this.logger.info('Door tool: Mouse up', {
            point,
            currentMode: this.state.mode,
            hasSelectedWall: !!this.state.selectedWall,
            hasDoorPosition: !!this.state.doorPosition
        });

        switch (this.state.mode) {
            case DoorToolMode.SELECTING_WALL:
                if (this.state.selectedWall && this.state.doorPosition) {
                    this.logger.info('Door tool: Attempting to place door', {
                        wallId: this.state.selectedWall.id,
                        position: this.state.doorPosition
                    });
                    this.placeDoor(this.state.selectedWall, this.state.doorPosition);
                    this.clearPreview();
                    this.state.mode = DoorToolMode.IDLE;
                } else {
                    this.logger.warn('Door tool: Cannot place door - missing wall or position', {
                        hasWall: !!this.state.selectedWall,
                        hasPosition: !!this.state.doorPosition
                    });
                }
                break;

            case DoorToolMode.DRAGGING_DOOR:
                if (this.state.selectedDoor) {
                    const nearestWall = this.findNearestWall(point);
                    if (nearestWall) {
                        const snappedPos = this.getNearestPointOnWall(point, nearestWall);
                        
                        // Update door position and wall reference
                        this.state.selectedDoor.updatePosition(snappedPos);
                        this.state.selectedDoor.updateWallReference(nearestWall);
                        
                        // Trigger re-render
                        this.eventManager.emit('door:changed', {
                            doorId: this.state.selectedDoor.id,
                            door: this.state.selectedDoor
                        });

                        // Emit graph changed event to update counts
                        this.eventManager.emit('graph:changed', {
                            nodeCount: this.wallGraph.getAllNodes().length,
                            wallCount: this.wallGraph.getAllWalls().length,
                            doorCount: this.doorStore.getAllDoors().length,
                            windowCount: this.canvasStore.getWindowStore().getAllWindows().length
                        });
                    }
                }
                this.clearDragPreview();
                this.state.mode = DoorToolMode.IDLE;
                this.state.dragOffset = null;
                this.state.dragStartPosition = null;
                break;

            case DoorToolMode.MOVING_DOOR:
                if (this.state.selectedDoor) {
                    const nearestWall = this.findNearestWall(point);
                    if (nearestWall) {
                        const snappedPos = this.getNearestPointOnWall(point, nearestWall);
                        this.state.selectedDoor.updatePosition(snappedPos);
                        this.state.selectedDoor.updateWallReference(nearestWall);
                        
                        // Trigger re-render
                        this.eventManager.emit('door:changed', {
                            doorId: this.state.selectedDoor.id,
                            door: this.state.selectedDoor
                        });
                    }
                }
                this.clearDragPreview();
                this.state.mode = DoorToolMode.IDLE;
                this.state.dragOffset = null;
                this.state.dragStartPosition = null;
                break;

            case DoorToolMode.DRAGGING_NODE:
                if (this.state.selectedNode && this.state.selectedDoor) {
                    const nearestWall = this.findNearestWall(point);
                    if (nearestWall) {
                        const snappedPos = this.getNearestPointOnWall(point, nearestWall);
                        
                        // Update node position
                        this.state.selectedNode.move(snappedPos);
                        
                        // Trigger re-render
                        this.eventManager.emit('door:changed', {
                            doorId: this.state.selectedDoor.id,
                            door: this.state.selectedDoor
                        });

                        // Emit graph changed event
                        this.eventManager.emit('graph:changed', {
                            nodeCount: this.wallGraph.getAllNodes().length,
                            wallCount: this.wallGraph.getAllWalls().length,
                            doorCount: this.doorStore.getAllDoors().length,
                            windowCount: this.canvasStore.getWindowStore().getAllWindows().length
                        });
                    }
                }
                this.clearDragPreview();
                this.state.mode = DoorToolMode.IDLE;
                this.state.dragOffset = null;
                this.state.dragStartPosition = null;
                this.state.selectedNode = null;
                break;
        }

        // Clear wall highlight
        if (this.state.selectedWall) {
            this.state.selectedWall.setHighlighted(false);
            this.logger.info('Door tool: Clearing wall highlight', {
                wallId: this.state.selectedWall.id
            });
            this.state.selectedWall = null;
        }
    }

    private updatePreview(): void {
        if (!this.state.selectedWall || !this.state.doorPosition) {
            this.logger.info('Door tool: Cannot update preview - missing wall or position', {
                hasWall: !!this.state.selectedWall,
                hasPosition: !!this.state.doorPosition
            });
            return;
        }

        const angle = this.calculateDoorAngle(this.state.selectedWall);
        const doorWidth = 100;

        this.logger.info('Door tool: Updating preview', {
            position: this.state.doorPosition,
            angle: angle * (180 / Math.PI), // Convert to degrees for readability
            doorWidth,
            wallId: this.state.selectedWall.id
        });

        // Emit preview event with door data
        this.eventManager.emit('canvas:preview', {
            data: {
                type: 'door',
                position: this.state.doorPosition,
                angle: angle,
                width: doorWidth,
                isFlipped: false
            }
        });
    }

    private clearPreview(): void {
        // Clear preview by emitting null data
        this.eventManager.emit('canvas:preview', {
            data: null
        });
    }

    private updateDragPreview(position: Point, wall: WallObject): void {
        if (!this.state.selectedDoor) return;

        const angle = this.calculateDoorAngle(wall);
        const doorData = this.state.selectedDoor.getData();

        // Emit preview event with door data
        this.eventManager.emit('canvas:preview', {
            data: {
                type: 'door',
                position: position,
                angle: angle,
                width: doorData.properties.width,
                isFlipped: doorData.isFlipped
            }
        });
    }

    private clearDragPreview(): void {
        // Clear preview by emitting null data
        this.eventManager.emit('canvas:preview', {
            data: null
        });
    }

    private findDoorAtPosition(point: Point): DoorObject | null {
        const doors = this.doorStore.getAllDoors();
        const DOOR_HIT_PADDING = 20; // Larger hit box area around the door

        for (const door of doors) {
            const doorData = door.getData();
            const doorPos = doorData.position;
            const doorWidth = doorData.properties.width;
            const angle = doorData.angle;

            // Calculate door endpoints considering angle
            const dx = Math.cos(angle) * (doorWidth / 2);
            const dy = Math.sin(angle) * (doorWidth / 2);

            // Door endpoints
            const startPoint = { x: doorPos.x - dx, y: doorPos.y - dy };
            const endPoint = { x: doorPos.x + dx, y: doorPos.y + dy };

            // Calculate distance from point to door line segment
            const distance = this.getDistanceToLineSegment(point, startPoint, endPoint);

            // Check if point is within the padded hit box
            if (distance <= DOOR_HIT_PADDING) {
                return door;
            }
        }

        return null;
    }

    private getDistanceToLineSegment(point: Point, start: Point, end: Point): number {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) return this.getDistance(point, start);

        // Calculate projection
        const t = Math.max(0, Math.min(1, (
            (point.x - start.x) * dx +
            (point.y - start.y) * dy
        ) / (length * length)));

        // Calculate nearest point on line segment
        const nearestPoint = {
            x: start.x + t * dx,
            y: start.y + t * dy
        };

        // Return distance to nearest point
        return this.getDistance(point, nearestPoint);
    }

    private findNearestWall(point: Point): WallObject | null {
        const walls = this.wallGraph.getAllWalls();
        let nearestWall: WallObject | null = null;
        let minDistance = Infinity;

        for (const wall of walls) {
            if (wall.containsPoint(point)) {
                return wall;
            }
            
            const nearestPoint = this.getNearestPointOnWall(point, wall);
            const distance = this.getDistance(point, nearestPoint);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestWall = wall;
            }
        }

        // Only return wall if within reasonable distance (e.g., 20 pixels)
        return minDistance <= 20 ? nearestWall : null;
    }

    private getNearestPointOnWall(point: Point, wall: WallObject): Point {
        const data = wall.getData();
        const startPoint = data.startPoint;
        const endPoint = data.endPoint;

        // Calculate vector from start to end
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) return startPoint;

        // Calculate projection of point onto line
        const t = (
            (point.x - startPoint.x) * dx +
            (point.y - startPoint.y) * dy
        ) / (length * length);

        // Clamp t to [0,1] to keep point on line segment
        const clampedT = Math.max(0, Math.min(1, t));

        // Calculate nearest point
        return {
            x: startPoint.x + clampedT * dx,
            y: startPoint.y + clampedT * dy
        };
    }

    private placeDoor(wall: WallObject, position: Point): void {
        try {
            // Validate position before placing door
            const angle = this.calculateDoorAngle(wall);
            const doorWidth = 100;

            const doorData: DoorData = {
                id: uuidv4(),
                wallId: wall.id,
                position: position,
                angle: angle,
                isFlipped: false,
                properties: {
                    color: '#8B4513',
                    width: doorWidth,
                    isOpen: false,
                    openDirection: 'left'
                },
                doorNumber: null  // The DoorStore will set this when adding the door
            };

            this.logger.info('Starting door placement', { wallId: wall.id, position });

            // Create door object
            const doorObject = new DoorObject(doorData);

            // Log door placement details for debugging
            this.logger.info('Door placement details', {
                wallAngle: angle * 180 / Math.PI,
                position: position,
                doorWidth
            });

            // Add door to store
            this.doorStore.addDoor(doorObject);

            // Emit graph changed event
            this.eventManager.emit('graph:changed', {
                nodeCount: this.wallGraph.getAllNodes().length,
                wallCount: this.wallGraph.getAllWalls().length,
                doorCount: this.doorStore.getAllDoors().length
            });

        } catch (error) {
            this.logger.error('Failed to place door', error instanceof Error ? error : new Error('Unknown error'));
            throw error;
        }
    }

    private findDoorNodeAtPosition(point: Point): { node: DoorNode, door: DoorObject } | null {
        const doors = this.doorStore.getAllDoors();
        const NODE_HIT_RADIUS = 10; // Radius for node hit detection

        for (const door of doors) {
            // Check node A
            const nodeA = door.getNodeA();
            const distanceA = this.getDistance(point, nodeA.getData().position);
            if (distanceA <= NODE_HIT_RADIUS) {
                return { node: nodeA, door: door };
            }

            // Check node B
            const nodeB = door.getNodeB();
            const distanceB = this.getDistance(point, nodeB.getData().position);
            if (distanceB <= NODE_HIT_RADIUS) {
                return { node: nodeB, door: door };
            }
        }

        return null;
    }
} 