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
    PLACING_DOOR = 'placing_door'
}

interface DoorToolState {
    mode: DoorToolMode;
    selectedWall: WallObject | null;
    previewLine: Line | null;
    doorPosition: Point | null;
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
        previewLine: null,
        doorPosition: null
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
            this.state.mode = DoorToolMode.SELECTING_WALL;
            this.logger.info('Door tool: Selecting wall');
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
        }
    }

    private updatePreview(): void {
        if (!this.layer || !this.state.selectedWall || !this.state.doorPosition) {
            return;
        }

        // Clear existing preview
        this.clearPreview();

        // Create preview line
        this.state.previewLine = new Line({
            points: [-50, 0, 50, 0], // 1-meter door preview
            stroke: '#666',
            strokeWidth: 2,
            dash: [5, 5],
            x: this.state.doorPosition.x,
            y: this.state.doorPosition.y,
            rotation: this.calculateDoorAngle(this.state.selectedWall) * 180 / Math.PI
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

            // Calculate door width (100cm)
            const doorWidth = 100;
            const wallData = wall.getData();
            const angle = this.calculateDoorAngle(wall);

            // Calculate door node positions (50cm on each side)
            const leftOffset = {
                x: -50 * Math.cos(angle),
                y: -50 * Math.sin(angle)
            };
            const rightOffset = {
                x: 50 * Math.cos(angle),
                y: 50 * Math.sin(angle)
            };

            const leftPoint = {
                x: point.x + leftOffset.x,
                y: point.y + leftOffset.y
            };
            const rightPoint = {
                x: point.x + rightOffset.x,
                y: point.y + rightOffset.y
            };

            // Create door nodes
            const leftNode = this.wallGraph.createNode(leftPoint);
            const rightNode = this.wallGraph.createNode(rightPoint);

            if (!leftNode || !rightNode) {
                throw new Error('Failed to create door nodes');
            }

            this.logger.info('Created door nodes', {
                leftNodeId: leftNode.id,
                rightNodeId: rightNode.id
            });

            // Create wall segments
            const wall1 = this.wallGraph.createWall(wallData.startNodeId, leftNode.id);
            const doorSegment = this.wallGraph.createWall(leftNode.id, rightNode.id);
            const wall2 = this.wallGraph.createWall(rightNode.id, wallData.endNodeId);

            if (!wall1 || !doorSegment || !wall2) {
                throw new Error('Failed to create wall segments');
            }

            this.logger.info('Created wall segments', {
                wall1Id: wall1.id,
                doorSegmentId: doorSegment.id,
                wall2Id: wall2.id
            });

            // Create and add door object BEFORE removing the original wall
            const doorData: DoorData = {
                id: uuidv4(),
                wallId: doorSegment.id,
                position: point,
                angle: angle,
                startNodeId: leftNode.id,
                endNodeId: rightNode.id,
                properties: {
                    color: '#8B4513',
                    width: doorWidth,
                    isOpen: false,
                    openDirection: 'left'
                }
            };

            const doorObject = new DoorObject(doorData);
            this.doorStore.addDoor(doorObject);

            this.logger.info('Created door object', {
                doorId: doorObject.id,
                wallId: doorSegment.id,
                startNodeId: leftNode.id,
                endNodeId: rightNode.id
            });

            // Remove original wall AFTER creating and adding the door
            this.wallGraph.removeWall(wall.id);
            this.logger.info('Removed original wall', { wallId: wall.id });

            // Emit graph changed event with updated counts
            this.eventManager.emit('graph:changed', {
                nodeCount: this.wallGraph.getAllNodes().length,
                wallCount: this.wallGraph.getAllWalls().length,
                roomCount: this.wallGraph.getAllRooms().length,
                doorCount: this.doorStore.getAllDoors().length
            });

            this.logger.info('Door placement completed successfully');
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
        
        const dx = endNode.position.x - startNode.position.x;
        const dy = endNode.position.y - startNode.position.y;
        const angle = Math.atan2(dy, dx);
        
        this.logger.info('Calculated door angle:', {
            startNode: startNode.position,
            endNode: endNode.position,
            angleRadians: angle,
            angleDegrees: angle * 180 / Math.PI
        });
        
        return angle;
    }
} 