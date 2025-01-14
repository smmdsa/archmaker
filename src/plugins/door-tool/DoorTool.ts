import { BaseTool } from '../../core/tools/BaseTool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { DoorObject, DoorData } from './objects/DoorObject';
import { DoorStore } from './stores/DoorStore';
import { WallObject } from '../wall-tool/objects/WallObject';
import { WallGraph } from '../wall-tool/models/WallGraph';
import { Point } from '../../core/types/geometry';
import { Layer } from 'konva/lib/Layer';
import { Line } from 'konva/lib/shapes/Line';
import { v4 as uuidv4 } from 'uuid';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import { CanvasStore } from '../../store/CanvasStore';
import { ISelectableObject, SelectableObjectType } from '../../core/interfaces/ISelectableObject';

enum DoorToolMode {
    IDLE = 'idle',
    SELECTING_WALL = 'selecting_wall',
    PLACING_DOOR = 'placing_door',
    MOVING_DOOR = 'moving_door',
    DRAGGING_DOOR = 'dragging_door'
}

interface DoorToolState {
    mode: DoorToolMode;
    selectedWall: WallObject | null;
    selectedDoor: DoorObject | null;
    previewLine: Line | null;
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

@ToolPlugin({
    id: 'door-tool',
    name: 'Door Tool',
    version: '1.0.0',
    description: 'Tool for placing doors on walls',
    icon: '🚪',
    tooltip: 'Place doors on walls (D)',
    section: 'architecture',
    order: 3,
    shortcut: 'd'
})
export class DoorTool extends BaseTool {
    private state: DoorToolState = {
        mode: DoorToolMode.IDLE,
        selectedWall: null,
        selectedDoor: null,
        previewLine: null,
        doorPosition: null,
        dragStartPosition: null,
        dragOffset: null
    };
    
    private doorStore: DoorStore;
    private wallGraph: WallGraph;
    private layer: Layer | null = null;
    private canvasStore: CanvasStore;
    
    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, 'door-tool', toolManifest);
        
        // Get instances of required stores
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
        this.doorStore = DoorStore.getInstance(eventManager, logger);
        this.wallGraph = this.canvasStore.getWallGraph();
        
        // Subscribe to canvas layer changes
        this.eventManager.on('canvas:layers', (event: any) => {
            const layers = this.canvasStore.getLayers();
            if (layers && layers.mainLayer) {
                this.layer = layers.mainLayer;
                this.logger.info('Door tool: Canvas layers initialized', {
                    layerId: this.layer.id(),
                    name: this.layer.name()
                });
            } else {
                this.logger.warn('Door tool: Canvas layers event received but mainLayer is null');
            }
        });

        // Subscribe to door removal events
        this.eventManager.on('door:removed', (event: { doorId: string }) => {
            // If the removed door was selected, reset the tool state
            if (this.state.selectedDoor?.id === event.doorId) {
                this.resetToolState();
            }
        });

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
                    
                    // Force visual update
                    const layers = this.canvasStore.getLayers();
                    if (layers?.mainLayer) {
                        selectedDoor.render(layers.mainLayer);
                        layers.mainLayer.batchDraw();
                    }
                } else {
                    // If the door doesn't exist anymore, reset state
                    this.resetToolState();
                }
            } else {
                if (this.state.selectedDoor) {
                    this.state.selectedDoor.setSelected(false);
                    this.state.selectedDoor.setHighlighted(false);
                    
                    // Force visual update
                    const layers = this.canvasStore.getLayers();
                    if (layers?.mainLayer) {
                        this.state.selectedDoor.render(layers.mainLayer);
                        layers.mainLayer.batchDraw();
                    }
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

        // Handle object hit testing
        this.eventManager.on('object:hit-test', (event: { position: Point, callback: (obj: ISelectableObject | null) => void }) => {
            if (this.isActive()) {
                const hitDoor = this.findDoorAtPosition(event.position);
                if (hitDoor) {
                    event.callback(hitDoor);
                }
            }
        });
    }

    async initialize(): Promise<void> {
        await super.initialize();
        
        // Try to get layers if already available
        const layers = this.canvasStore.getLayers();
        if (layers && layers.mainLayer) {
            this.layer = layers.mainLayer;
            this.logger.info('Door tool: Canvas layers initialized in initialize()', {
                layerId: this.layer.id(),
                name: this.layer.name()
            });
        } else {
            this.logger.warn('Door tool: No layers available during initialization');
        }

        // Add keyboard event listener for flipping doors
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            // Only handle if tool is active and we have a selected door
            if (this.isActive() && this.state.selectedDoor && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                e.stopPropagation();
                this.flipSelectedDoor();
            }
        });
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!this.layer) {
            this.logger.warn('Door tool: Canvas layers not initialized');
            return;
        }

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

    private getWorldPosition(screenPos: Point): Point | null {
        const layers = this.canvasStore.getLayers();
        if (!layers?.mainLayer) return null;
        
        const stage = layers.mainLayer.getStage();
        if (!stage) return null;

        return {
            x: (screenPos.x - stage.x()) / stage.scaleX(),
            y: (screenPos.y - stage.y()) / stage.scaleY()
        };
    }

    private async handleMouseMove(point: Point): Promise<void> {
        const worldPoint = this.getWorldPosition(point);
        if (!worldPoint) return;

        switch (this.state.mode) {
            case DoorToolMode.SELECTING_WALL:
                // Find wall under cursor using world coordinates
                const walls = this.wallGraph.getAllWalls();
                let nearestWall: WallObject | null = null;

                for (const wall of walls) {
                    if (wall.containsPoint(worldPoint)) {
                        nearestWall = wall;
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

                // Update door position and validate
                if (nearestWall) {
                    const newPosition = this.getNearestPointOnWall(worldPoint, nearestWall);
                    
                    // Create temporary door data for validation
                    const tempDoorData: DoorData = {
                        id: '',
                        wallId: nearestWall.id,
                        position: newPosition,
                        angle: this.calculateDoorAngle(nearestWall),
                        startNodeId: '',
                        endNodeId: '',
                        isFlipped: false,
                        properties: {
                            width: 100,
                            color: '#8B4513',
                            isOpen: false,
                            openDirection: 'left' as 'left' | 'right'
                        },
                        connectedNodes: {}
                    };

                    if (this.validateDoorPosition(tempDoorData, nearestWall)) {
                        this.state.doorPosition = newPosition;
                        this.updatePreview();
                    } else {
                        this.clearPreview();
                    }
                }
                break;

            case DoorToolMode.MOVING_DOOR:
            case DoorToolMode.DRAGGING_DOOR:
                if (!this.state.selectedDoor || !this.state.dragOffset) {
                    this.resetToolState();
                    return;
                }

                const nearestWallForDrag = this.findNearestWall(worldPoint);
                if (nearestWallForDrag) {
                    // Calculate new position in world coordinates
                    const newPos = {
                        x: worldPoint.x - this.state.dragOffset.x,
                        y: worldPoint.y - this.state.dragOffset.y
                    };

                    const snappedPos = this.getNearestPointOnWall(newPos, nearestWallForDrag);
                    
                    // Validate new position before updating
                    if (this.validateDoorPosition(this.state.selectedDoor, nearestWallForDrag)) {
                        this.state.selectedDoor.updatePosition(snappedPos);
                        this.state.selectedDoor.updateWallReference(nearestWallForDrag);
                        
                        const layers = this.canvasStore.getLayers();
                        if (layers?.mainLayer) {
                            this.state.selectedDoor.render(layers.mainLayer);
                            layers.mainLayer.batchDraw();
                        }
                        
                        this.updateDragPreview(snappedPos, nearestWallForDrag);
                    }
                }
                break;
        }
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

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        const worldPoint = this.getWorldPosition(event.position);
        if (!worldPoint) return;

        // Check if we hit a door using world coordinates
        const hitDoor = this.findDoorAtPosition(worldPoint);
        
        if (hitDoor) {
            // Clear any existing selection
            this.doorStore.getAllDoors().forEach(door => {
                if (door !== hitDoor) {
                    door.setSelected(false);
                    door.setHighlighted(false);
                    door.render(this.layer!);
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

            // Calculate drag offset in world coordinates
            const doorPos = hitDoor.getData().position;
            this.state.dragOffset = {
                x: worldPoint.x - doorPos.x,
                y: worldPoint.y - doorPos.y
            };
            this.state.dragStartPosition = worldPoint;

            // Set mode based on mouse button
            if (event.originalEvent instanceof MouseEvent && event.originalEvent.button === 0) {
                this.state.mode = DoorToolMode.DRAGGING_DOOR;
            } else {
                this.state.mode = DoorToolMode.MOVING_DOOR;
            }

            // Force redraw to show selection
            const layers = this.canvasStore.getLayers();
            if (layers?.mainLayer) {
                hitDoor.render(layers.mainLayer);
                layers.mainLayer.batchDraw();
            }

            return;
        }

        // If we didn't hit a door, clear selection
        if (this.state.selectedDoor) {
            this.state.selectedDoor.setSelected(false);
            this.state.selectedDoor.setHighlighted(false);
            
            const layers = this.canvasStore.getLayers();
            if (layers?.mainLayer) {
                this.state.selectedDoor.render(layers.mainLayer);
                layers.mainLayer.batchDraw();
            }
            
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
            this.logger.info('Door tool: Selecting wall');
        }
    }

    private async handleMouseUp(point: Point): Promise<void> {
        switch (this.state.mode) {
            case DoorToolMode.SELECTING_WALL:
                if (this.state.selectedWall && this.state.doorPosition) {
                    this.placeDoor(this.state.selectedWall, this.state.doorPosition);
                    this.clearPreview();
                    this.state.mode = DoorToolMode.IDLE;
                }
                break;

            case DoorToolMode.DRAGGING_DOOR:
            case DoorToolMode.MOVING_DOOR:
                if (this.state.selectedDoor) {
                    const nearestWall = this.findNearestWall(point);
                    if (nearestWall) {
                        const snappedPos = this.getNearestPointOnWall(point, nearestWall);
                        if (this.validateDoorPosition(this.state.selectedDoor, nearestWall)) {
                            this.state.selectedDoor.updatePosition(snappedPos);
                            this.state.selectedDoor.updateWallReference(nearestWall);
                            
                            const layers = this.canvasStore.getLayers();
                            if (layers?.mainLayer) {
                                this.state.selectedDoor.render(layers.mainLayer);
                                layers.mainLayer.batchDraw();
                            }
                        }
                    }
                }
                this.clearDragPreview();
                this.state.mode = DoorToolMode.IDLE;
                this.state.dragOffset = null;
                this.state.dragStartPosition = null;
                break;
        }

        // Clear wall highlight
        if (this.state.selectedWall) {
            this.state.selectedWall.setHighlighted(false);
            this.state.selectedWall = null;
        }
    }

    private updatePreview(): void {
        if (!this.layer || !this.state.selectedWall || !this.state.doorPosition) {
            return;
        }

        // Clear existing preview
        this.clearPreview();

        const angle = this.calculateDoorAngle(this.state.selectedWall);
        const perpAngle = angle + Math.PI/2;
        const doorWidth = 100;

        // Create preview line perpendicular to wall
        this.state.previewLine = new Line({
            points: [-doorWidth/2, 0, doorWidth/2, 0],
            stroke: '#666',
            strokeWidth: 2,
            dash: [5, 5],
            x: this.state.doorPosition.x,
            y: this.state.doorPosition.y,
            rotation: angle * 180 / Math.PI // Convert to degrees for Konva
        });

        this.layer.add(this.state.previewLine);
        this.layer.batchDraw();
    }

    private clearPreview(): void {
        if (this.state.previewLine) {
            this.state.previewLine.destroy();
            this.state.previewLine = null;
        }
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
                startNodeId: '',
                endNodeId: '',
                isFlipped: false,
                properties: {
                    color: '#8B4513',
                    width: doorWidth,
                    isOpen: false,
                    openDirection: 'left'
                },
                connectedNodes: {}
            };

            if (!this.validateDoorPosition(doorData, wall)) {
                this.logger.warn('Door tool: Cannot place door at invalid position');
                return;
            }

            this.logger.info('Starting door placement', { wallId: wall.id, position });

            // Create door object with the correct constructor signature
            const doorObject = new DoorObject(doorData, this.wallGraph);

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

    private findDoorAtPosition(point: Point): DoorObject | null {
        const doors = this.doorStore.getAllDoors();
        return doors.find(door => door.containsPoint(point)) || null;
    }

    private highlightDoor(door: DoorObject | null): void {
        // Clear previous highlight
        if (this.state.selectedDoor && this.state.selectedDoor !== door) {
            this.state.selectedDoor.setHighlighted(false);
            this.state.selectedDoor.setSelected(false);
        }
        
        // Set new highlight and selection
        if (door) {
            door.setHighlighted(true);
            door.setSelected(true);
        }
        
        this.state.selectedDoor = door;

        // Force redraw
        const layers = this.canvasStore.getLayers();
        if (layers?.mainLayer) {
            layers.mainLayer.batchDraw();
        }
    }

    private initiateDoorDrag(door: DoorObject, point: Point): void {
        const doorPos = door.getData().position;
        this.state.dragOffset = {
            x: point.x - doorPos.x,
            y: point.y - doorPos.y
        };
        this.state.dragStartPosition = point;
        this.state.mode = DoorToolMode.DRAGGING_DOOR;
        
        // Ensure door is selected and highlighted during drag
        door.setSelected(true);
        door.setHighlighted(true);
        
        // Force visual update
        const layers = this.canvasStore.getLayers();
        if (layers?.mainLayer) {
            door.render(layers.mainLayer);
            layers.mainLayer.batchDraw();
        }
        
        this.logger.info('Door tool: Started dragging door', {
            doorId: door.id,
            startPosition: point,
            mode: this.state.mode,
            dragOffset: this.state.dragOffset
        });
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

    private getDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private updateDragPreview(position: Point, wall: WallObject): void {
        // Clear existing preview
        this.clearDragPreview();

        if (!this.layer) return;

        const angle = this.calculateDoorAngle(wall);
        const doorWidth = this.state.selectedDoor?.getData().properties.width || 100;

        // Create preview line
        this.state.previewLine = new Line({
            points: [-doorWidth/2, 0, doorWidth/2, 0],
            stroke: '#666',
            strokeWidth: 2,
            dash: [5, 5],
            x: position.x,
            y: position.y,
            rotation: angle * 180 / Math.PI
        });

        // Add to temp layer instead of main layer for preview
        const layers = this.canvasStore.getLayers();
        if (layers?.tempLayer) {
            layers.tempLayer.add(this.state.previewLine);
            layers.tempLayer.batchDraw();
        }
    }

    private clearDragPreview(): void {
        if (this.state.previewLine) {
            this.state.previewLine.destroy();
            this.state.previewLine = null;
            
            const layers = this.canvasStore.getLayers();
            if (layers?.tempLayer) {
                layers.tempLayer.batchDraw();
            }
        }
    }

    private flipSelectedDoor(): void {
        if (!this.state.selectedDoor) {
            this.logger.warn('Door tool: No door selected for flipping');
            return;
        }

        try {
            this.state.selectedDoor.flipDoor();
            
            // Force redraw
            const layers = this.canvasStore.getLayers();
            if (layers?.mainLayer) {
                this.state.selectedDoor.render(layers.mainLayer);
                layers.mainLayer.batchDraw();
            }

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

        const layers = this.canvasStore.getLayers();
        if (!layers?.mainLayer) return;

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

            // Render the updated door
            door.render(layers.mainLayer);
        });

        // Batch draw all changes
        layers.mainLayer.batchDraw();

        this.logger.info('Door tool: Updated doors after wall movement', {
            wallId: event.wallId,
            updatedDoors: doorsOnWall.map(d => d.id)
        });
    }

    private validateDoorPosition(door: DoorObject | DoorData, wall: WallObject): boolean {
        // Skip validation if we're dragging the door and checking its current wall
        if (this.state.mode === DoorToolMode.DRAGGING_DOOR || 
            this.state.mode === DoorToolMode.MOVING_DOOR) {
            if (door instanceof DoorObject && door === this.state.selectedDoor && 
                wall.id === door.getData().wallId) {
                return true;
            }
        }

        const doorWidth = door instanceof DoorObject ? 
            door.getData().properties.width : 
            door.properties.width;

        // Get wall data
        const wallData = wall.getData();
        const wallLength = this.getDistance(wallData.startPoint, wallData.endPoint);
        
        // Check if wall is long enough for door
        if (wallLength < doorWidth) {
            this.logger.warn('Door tool: Wall too short for door', {
                wallLength,
                doorWidth
            });
            return false;
        }

        // Get door position
        const doorPos = door instanceof DoorObject ? 
            door.getData().position : 
            door.position;

        // Calculate door endpoints
        const doorAngle = this.calculateDoorAngle(wall);
        const halfWidth = doorWidth / 2;
        const doorStart = {
            x: doorPos.x - Math.cos(doorAngle) * halfWidth,
            y: doorPos.y - Math.sin(doorAngle) * halfWidth
        };
        const doorEnd = {
            x: doorPos.x + Math.cos(doorAngle) * halfWidth,
            y: doorPos.y + Math.sin(doorAngle) * halfWidth
        };

        // Check if door endpoints are within wall bounds
        const startDist = this.getDistance(doorStart, wallData.startPoint);
        const endDist = this.getDistance(doorEnd, wallData.endPoint);
        const minMargin = 10; // Minimum margin from wall ends

        if (startDist < minMargin || endDist < minMargin) {
            this.logger.warn('Door tool: Door too close to wall endpoints', {
                startDist,
                endDist,
                minMargin
            });
            return false;
        }

        // Check for overlapping doors, excluding the door being dragged
        const doorsOnWall = this.doorStore.getAllDoors()
            .filter(d => d.getData().wallId === wall.id && 
                    (!(door instanceof DoorObject) || d.id !== door.id));

        for (const existingDoor of doorsOnWall) {
            const existingData = existingDoor.getData();
            const distance = this.getDistance(existingData.position, doorPos);
            const minDistance = (existingData.properties.width + doorWidth) / 2 + 10;

            if (distance < minDistance) {
                this.logger.warn('Door tool: Door overlaps with existing door', {
                    distance,
                    minDistance,
                    existingDoorId: existingDoor.id
                });
                return false;
            }
        }

        return true;
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

        // For each affected door, find the closest new wall segment
        affectedDoors.forEach(door => {
            const doorPos = door.getData().position;
            
            // Find which new wall segment is closest to the door's current position
            let closestWall = event.newWalls[0].wall;
            let minDistance = this.getDistanceToWall(doorPos, closestWall);

            for (const { wall } of event.newWalls) {
                const distance = this.getDistanceToWall(doorPos, wall);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestWall = wall;
                }
            }

            // Only update the wall reference, maintaining the door's exact position
            door.updateWallReference(closestWall);

            this.logger.info('Door tool: Reassigned door after wall split', {
                doorId: door.id,
                originalWallId: event.originalWallId,
                newWallId: closestWall.id,
                position: doorPos,
                distanceToWall: minDistance
            });
        });

        // Force redraw
        const layers = this.canvasStore.getLayers();
        if (layers?.mainLayer) {
            layers.mainLayer.batchDraw();
        }
    }

    // Helper method to calculate the perpendicular distance from a point to a wall
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

    private resetToolState(): void {
        this.state.selectedDoor = null;
        this.state.dragOffset = null;
        this.state.dragStartPosition = null;
        this.state.mode = DoorToolMode.IDLE;
        this.clearPreview();
        this.clearDragPreview();
    }
} 