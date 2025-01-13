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
                await this.handleMouseDown(event.position);
                break;
            case 'mouseup':
                await this.handleMouseUp(event.position);
                break;
        }
    }

    private async handleMouseMove(point: Point): Promise<void> {
        switch (this.state.mode) {
            case DoorToolMode.SELECTING_WALL:
                // Find wall under cursor
                const walls = this.wallGraph.getAllWalls();
                let nearestWall: WallObject | null = null;
                let minDistance = Infinity;

                for (const wall of walls) {
                    if (wall.containsPoint(point)) {
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

                // Update door position
                if (nearestWall) {
                    this.state.doorPosition = this.getNearestPointOnWall(point, nearestWall);
                    this.updatePreview();
                }
                break;

            case DoorToolMode.DRAGGING_DOOR:
                if (!this.state.selectedDoor || !this.state.dragOffset) return;

                // Find nearest wall for snapping
                const nearestWallForDrag = this.findNearestWall(point);
                if (nearestWallForDrag) {
                    // Calculate new position considering drag offset
                    const newPos = {
                        x: point.x - this.state.dragOffset.x,
                        y: point.y - this.state.dragOffset.y
                    };

                    // Get snapped position on wall
                    const snappedPos = this.getNearestPointOnWall(newPos, nearestWallForDrag);
                    
                    // Update door position and wall reference
                    this.state.selectedDoor.updatePosition(snappedPos);
                    this.state.selectedDoor.updateWallReference(nearestWallForDrag);
                    
                    // Force redraw of the door
                    const layers = this.canvasStore.getLayers();
                    if (layers?.mainLayer) {
                        this.state.selectedDoor.render(layers.mainLayer);
                        layers.mainLayer.batchDraw();
                    }
                    
                    // Update preview if needed
                    this.updateDragPreview(snappedPos, nearestWallForDrag);
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

    private async handleMouseDown(point: Point): Promise<void> {
        if (this.state.mode === DoorToolMode.IDLE) {
            const hitDoor = this.findDoorAtPosition(point);
            if (hitDoor) {
                this.highlightDoor(hitDoor);
                this.initiateDoorDrag(hitDoor, point);
            } else {
                this.state.mode = DoorToolMode.SELECTING_WALL;
                this.logger.info('Door tool: Selecting wall');
            }
        }
    }

    private async handleMouseUp(point: Point): Promise<void> {
        if (this.state.mode === DoorToolMode.SELECTING_WALL && 
            this.state.selectedWall && 
            this.state.doorPosition) {
            // Place the door
            this.placeDoor(this.state.selectedWall, this.state.doorPosition);
            
            // Reset state
            this.state.selectedWall.setHighlighted(false);
            this.state.selectedWall = null;
            this.state.doorPosition = null;
            this.state.mode = DoorToolMode.IDLE;
            this.clearPreview();
            
            this.logger.info('Door tool: Door placed');
        } else if (this.state.mode === DoorToolMode.DRAGGING_DOOR) {
            if (this.state.selectedDoor) {
                // Finalize door movement
                const nearestWall = this.findNearestWall(point);
                if (nearestWall) {
                    const finalPos = this.getNearestPointOnWall(point, nearestWall);
                    this.state.selectedDoor.updatePosition(finalPos);
                    this.state.selectedDoor.updateWallReference(nearestWall);
                    
                    this.logger.info('Door tool: Door movement completed', {
                        doorId: this.state.selectedDoor.id,
                        newPosition: finalPos,
                        newWallId: nearestWall.id
                    });
                }
                
                // Clear highlight
                this.state.selectedDoor.setHighlighted(false);
            }
            
            // Reset state
            this.state.selectedDoor = null;
            this.state.dragStartPosition = null;
            this.state.dragOffset = null;
            this.state.mode = DoorToolMode.IDLE;
            this.clearDragPreview();
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

    private placeDoor(wall: WallObject, point: Point): void {
        try {
            this.logger.info('Starting door placement', { wallId: wall.id, point });

            // Calculate wall angle and door width
            const angle = this.calculateDoorAngle(wall);
            const doorWidth = 100; // 100cm standard door width

            // Create door data with the correct structure
            const doorData: DoorData = {
                id: uuidv4(), // ID should be part of the data
                wallId: wall.id,
                position: point,
                angle: angle,
                startNodeId: '', // Will be set by DoorObject
                endNodeId: '', // Will be set by DoorObject
                properties: {
                    color: '#8B4513',
                    width: doorWidth,
                    isOpen: false,
                    openDirection: 'left'
                },
                connectedNodes: {
                    startWallNodeId: undefined,
                    endWallNodeId: undefined
                }
            };

            // Create door object with the correct constructor signature
            const doorObject = new DoorObject(doorData, this.wallGraph);

            // Log door placement details for debugging
            this.logger.info('Door placement details', {
                wallAngle: angle * 180 / Math.PI,
                position: point,
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
        }
        // Set new highlight
        if (door) {
            door.setHighlighted(true);
        }
        this.state.selectedDoor = door;
    }

    private initiateDoorDrag(door: DoorObject, point: Point): void {
        const doorPos = door.getData().position;
        this.state.dragOffset = {
            x: point.x - doorPos.x,
            y: point.y - doorPos.y
        };
        this.state.dragStartPosition = point;
        this.state.mode = DoorToolMode.DRAGGING_DOOR;
        this.logger.info('Door tool: Started dragging door', {
            doorId: door.id,
            startPosition: point
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
} 