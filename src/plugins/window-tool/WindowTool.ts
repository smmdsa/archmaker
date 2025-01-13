import { BaseTool } from '../../core/tools/BaseTool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { WindowObject } from './objects/WindowObject';
import { WindowStore } from './stores/WindowStore';
import { WallObject } from '../wall-tool/objects/WallObject';
import { WallGraph } from '../wall-tool/models/WallGraph';
import { Point } from '../../core/types/geometry';
import { Layer } from 'konva/lib/Layer';
import { Line } from 'konva/lib/shapes/Line';
import { v4 as uuidv4 } from 'uuid';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import { CanvasStore } from '../../store/CanvasStore';
import { ISelectableObject, SelectableObjectType } from '../../core/interfaces/ISelectableObject';

enum WindowToolMode {
    IDLE = 'idle',
    SELECTING_WALL = 'selecting_wall',
    PLACING_WINDOW = 'placing_window',
    MOVING_WINDOW = 'moving_window',
    DRAGGING_WINDOW = 'dragging_window'
}

interface WindowToolState {
    mode: WindowToolMode;
    selectedWall: WallObject | null;
    selectedWindow: WindowObject | null;
    previewLine: Line | null;
    windowPosition: Point | null;
    dragStartPosition: Point | null;
    dragOffset: Point | null;
}

interface WindowProperties {
    width: number;
    height: number;
    color: string;
    isOpen: boolean;
    openDirection: 'left' | 'right';
}

const toolManifest = {
    id: 'window-tool',
    name: 'Window Tool',
    version: '1.0.0',
    icon: '🪟',
    tooltip: 'Place windows on walls (N)',
    section: 'architecture',
    order: 4,
    shortcut: 'n'
};

@ToolPlugin({
    id: 'window-tool',
    name: 'Window Tool',
    version: '1.0.0',
    description: 'Tool for placing windows on walls',
    icon: '🪟',
    tooltip: 'Place windows on walls (N)',
    section: 'architecture',
    order: 4,
    shortcut: 'n'
})
export class WindowTool extends BaseTool {
    private state: WindowToolState = {
        mode: WindowToolMode.IDLE,
        selectedWall: null,
        selectedWindow: null,
        previewLine: null,
        windowPosition: null,
        dragStartPosition: null,
        dragOffset: null
    };
    
    private windowStore: WindowStore;
    private wallGraph: WallGraph;
    private layer: Layer | null = null;
    private canvasStore: CanvasStore;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, 'window-tool', toolManifest);
        
        // Get instances of required stores
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
        this.windowStore = WindowStore.getInstance(eventManager, logger);
        this.wallGraph = this.canvasStore.getWallGraph();
        
        // Subscribe to canvas layer changes
        this.eventManager.on('canvas:layers', (event: any) => {
            const layers = this.canvasStore.getLayers();
            if (layers && layers.mainLayer) {
                this.layer = layers.mainLayer;
                this.logger.info('Window tool: Canvas layers initialized', {
                    layerId: this.layer.id(),
                    name: this.layer.name()
                });
            } else {
                this.logger.warn('Window tool: Canvas layers event received but mainLayer is null');
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

        // Subscribe to keyboard events for window flipping
        this.eventManager.on('keyboard:keydown', (event: KeyboardEvent) => {
            if (this.isActive() && event.key.toLowerCase() === 'f') {
                this.logger.info('Window tool: F key pressed, attempting to flip window', {
                    selectedWindow: this.state.selectedWindow?.id
                });
                this.flipSelectedWindow();
                event.preventDefault();
                event.stopPropagation();
            }
        });

        // Subscribe to selection changes
        this.eventManager.on('selection:changed', (event: { selected: ISelectableObject[] }) => {
            const selectedWindows = event.selected.filter(obj => 
                obj.type === SelectableObjectType.WINDOW
            );
            
            // Update our internal state to match selection
            if (selectedWindows.length === 1) {
                const selectedWindow = selectedWindows[0] as WindowObject;
                this.state.selectedWindow = selectedWindow;
                selectedWindow.setSelected(true);
                selectedWindow.setHighlighted(true);
                
                // Force visual update
                const layers = this.canvasStore.getLayers();
                if (layers?.mainLayer) {
                    selectedWindow.render(layers.mainLayer);
                    layers.mainLayer.batchDraw();
                }
            } else {
                if (this.state.selectedWindow) {
                    this.state.selectedWindow.setSelected(false);
                    this.state.selectedWindow.setHighlighted(false);
                    
                    // Force visual update
                    const layers = this.canvasStore.getLayers();
                    if (layers?.mainLayer) {
                        this.state.selectedWindow.render(layers.mainLayer);
                        layers.mainLayer.batchDraw();
                    }
                }
                this.state.selectedWindow = null;
            }
        });

        // Subscribe to right-click events
        this.eventManager.on('canvas:contextmenu', (event: MouseEvent) => {
            if (this.isActive() && this.state.selectedWindow) {
                event.preventDefault();
                event.stopPropagation();
                this.flipSelectedWindow();
            }
        });

        // Handle object hit testing
        this.eventManager.on('object:hit-test', (event: { position: Point, callback: (obj: ISelectableObject | null) => void }) => {
            if (this.isActive()) {
                const hitWindow = this.findWindowAtPosition(event.position);
                if (hitWindow) {
                    event.callback(hitWindow);
                }
            }
        });

        // Subscribe to wall split events
        this.eventManager.on('wall:split', (event: { 
            originalWallId: string,
            newWalls: { id: string, wall: WallObject }[]
        }) => {
            this.handleWallSplit(event);
        });
    }

    async initialize(): Promise<void> {
        await super.initialize();
        
        // Try to get layers if already available
        const layers = this.canvasStore.getLayers();
        if (layers && layers.mainLayer) {
            this.layer = layers.mainLayer;
            this.logger.info('Window tool: Canvas layers initialized in initialize()', {
                layerId: this.layer.id(),
                name: this.layer.name()
            });
        } else {
            this.logger.warn('Window tool: No layers available during initialization');
        }
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!this.layer) {
            this.logger.warn('Window tool: Canvas layers not initialized');
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

    private async handleMouseMove(point: Point): Promise<void> {
        switch (this.state.mode) {
            case WindowToolMode.SELECTING_WALL:
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

                // Update window position and validate
                if (nearestWall) {
                    const newPosition = this.getNearestPointOnWall(point, nearestWall);
                    
                    // Create temporary window data for validation
                    const tempWindowData = {
                        id: '',
                        wallId: nearestWall.id,
                        position: newPosition,
                        angle: this.calculateWindowAngle(nearestWall),
                        startNodeId: '',
                        endNodeId: '',
                        isFlipped: false,
                        properties: {
                            width: 100,
                            height: 150,
                            color: '#FF69B4',
                            isOpen: false,
                            openDirection: 'left'
                        },
                        connectedNodes: {}
                    };

                    if (this.validateWindowPosition(tempWindowData, nearestWall)) {
                        this.state.windowPosition = newPosition;
                        this.updatePreview();
                    } else {
                        // Clear preview if position is invalid
                        this.clearPreview();
                    }
                }
                break;

            case WindowToolMode.MOVING_WINDOW:
            case WindowToolMode.DRAGGING_WINDOW:
                if (!this.state.selectedWindow || !this.state.dragOffset) {
                    this.logger.warn('Window tool: No window selected or drag offset missing during drag', {
                        selectedWindow: this.state.selectedWindow?.id,
                        dragOffset: this.state.dragOffset,
                        mode: this.state.mode
                    });
                    return;
                }

                const nearestWallForDrag = this.findNearestWall(point);
                if (nearestWallForDrag) {
                    const newPos = {
                        x: point.x - this.state.dragOffset.x,
                        y: point.y - this.state.dragOffset.y
                    };

                    const snappedPos = this.getNearestPointOnWall(newPos, nearestWallForDrag);
                    
                    // Validate new position before updating
                    if (this.validateWindowPosition(this.state.selectedWindow, nearestWallForDrag)) {
                        this.state.selectedWindow.updatePosition(snappedPos);
                        this.state.selectedWindow.updateWallReference(nearestWallForDrag);
                        
                        const layers = this.canvasStore.getLayers();
                        if (layers?.mainLayer) {
                            this.state.selectedWindow.render(layers.mainLayer);
                            layers.mainLayer.batchDraw();
                        }
                        
                        this.updateDragPreview(snappedPos, nearestWallForDrag);
                        
                        this.logger.info('Window tool: Window dragged', {
                            windowId: this.state.selectedWindow.id,
                            newPosition: snappedPos,
                            wallId: nearestWallForDrag.id,
                            mode: this.state.mode
                        });
                    }
                }
                break;
        }
    }

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        // Check if we hit a window
        const hitWindow = this.findWindowAtPosition(event.position);
        
        if (hitWindow) {
            // Clear any existing selection
            this.windowStore.getAllWindows().forEach(window => {
                if (window !== hitWindow) {
                    window.setSelected(false);
                    window.setHighlighted(false);
                    window.render(this.layer!);
                }
            });

            // Select and highlight the hit window
            hitWindow.setSelected(true);
            hitWindow.setHighlighted(true);
            this.state.selectedWindow = hitWindow;

            // Always calculate dragOffset when selecting a window
            const windowPos = hitWindow.getData().position;
            this.state.dragOffset = {
                x: event.position.x - windowPos.x,
                y: event.position.y - windowPos.y
            };
            this.state.dragStartPosition = event.position;

            // Set mode based on mouse button
            if (event.originalEvent instanceof MouseEvent && event.originalEvent.button === 0) {
                this.state.mode = WindowToolMode.DRAGGING_WINDOW;
                this.logger.info('Window tool: Started dragging window', {
                    windowId: hitWindow.id,
                    startPosition: event.position,
                    mode: this.state.mode,
                    dragOffset: this.state.dragOffset
                });
            } else {
                this.state.mode = WindowToolMode.MOVING_WINDOW;
            }

            // Force redraw to show selection
            const layers = this.canvasStore.getLayers();
            if (layers?.mainLayer) {
                hitWindow.render(layers.mainLayer);
                layers.mainLayer.batchDraw();
            }

            this.logger.info('Window tool: Window selected', {
                windowId: hitWindow.id,
                mode: this.state.mode,
                dragOffset: this.state.dragOffset
            });
            return;
        }

        // If we didn't hit a window, clear selection and continue with wall selection
        if (this.state.selectedWindow) {
            this.state.selectedWindow.setSelected(false);
            this.state.selectedWindow.setHighlighted(false);
            
            const layers = this.canvasStore.getLayers();
            if (layers?.mainLayer) {
                this.state.selectedWindow.render(layers.mainLayer);
                layers.mainLayer.batchDraw();
            }
            
            this.state.selectedWindow = null;
            this.state.dragOffset = null;
            this.state.dragStartPosition = null;
            this.state.mode = WindowToolMode.IDLE;
        }

        // Handle wall selection for window placement
        if (this.state.mode === WindowToolMode.IDLE) {
            this.state.mode = WindowToolMode.SELECTING_WALL;
            this.logger.info('Window tool: Selecting wall');
        }
    }

    private async handleMouseUp(point: Point): Promise<void> {
        switch (this.state.mode) {
            case WindowToolMode.SELECTING_WALL:
                if (this.state.selectedWall && this.state.windowPosition) {
                    this.placeWindow(this.state.selectedWall, this.state.windowPosition);
                    this.clearPreview();
                    this.state.mode = WindowToolMode.IDLE;
                }
                break;

            case WindowToolMode.DRAGGING_WINDOW:
            case WindowToolMode.MOVING_WINDOW:
                if (this.state.selectedWindow) {
                    const nearestWall = this.findNearestWall(point);
                    if (nearestWall) {
                        const snappedPos = this.getNearestPointOnWall(point, nearestWall);
                        if (this.validateWindowPosition(this.state.selectedWindow, nearestWall)) {
                            this.state.selectedWindow.updatePosition(snappedPos);
                            this.state.selectedWindow.updateWallReference(nearestWall);
                            
                            const layers = this.canvasStore.getLayers();
                            if (layers?.mainLayer) {
                                this.state.selectedWindow.render(layers.mainLayer);
                                layers.mainLayer.batchDraw();
                            }
                        }
                    }
                }
                this.clearDragPreview();
                this.state.mode = WindowToolMode.IDLE;
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
        if (!this.layer || !this.state.selectedWall || !this.state.windowPosition) {
            return;
        }

        // Clear existing preview
        this.clearPreview();

        const angle = this.calculateWindowAngle(this.state.selectedWall);
        const windowWidth = 100;
        const windowHeight = 150;

        // Create preview lines for window frame
        const framePoints: number[] = [];
        const numDivisions = 2;
        const spacing = windowWidth / numDivisions;

        for (let i = 0; i <= numDivisions; i++) {
            const x = -windowWidth/2 + i * spacing;
            framePoints.push(
                x, -windowHeight/4,
                x, windowHeight/4
            );
        }

        // Create preview line
        this.state.previewLine = new Line({
            points: framePoints,
            stroke: '#666',
            strokeWidth: 2,
            dash: [5, 5],
            x: this.state.windowPosition.x,
            y: this.state.windowPosition.y,
            rotation: angle * 180 / Math.PI
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

    private placeWindow(wall: WallObject, position: Point): void {
        try {
            // Validate position before placing window
            const angle = this.calculateWindowAngle(wall);
            const windowWidth = 100;
            const windowHeight = 150;

            const windowData = {
                id: uuidv4(),
                wallId: wall.id,
                position: position,
                angle: angle,
                startNodeId: '',
                endNodeId: '',
                isFlipped: false,
                properties: {
                    color: '#FF69B4',
                    width: windowWidth,
                    height: windowHeight,
                    isOpen: false,
                    openDirection: 'left'
                },
                connectedNodes: {}
            };

            if (!this.validateWindowPosition(windowData, wall)) {
                this.logger.warn('Window tool: Cannot place window at invalid position');
                return;
            }

            this.logger.info('Starting window placement', { wallId: wall.id, position });

            // Create window object
            const windowObject = new WindowObject(windowData, this.wallGraph);

            // Add window to store
            this.windowStore.addWindow(windowObject);

            // Emit graph changed event
            this.eventManager.emit('graph:changed', {
                nodeCount: this.wallGraph.getAllNodes().length,
                wallCount: this.wallGraph.getAllWalls().length,
                windowCount: this.windowStore.getAllWindows().length,
                doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
                roomCount: this.wallGraph.getAllRooms().length
            });

        } catch (error) {
            this.logger.error('Failed to place window', error instanceof Error ? error : new Error('Unknown error'));
            throw error;
        }
    }

    private calculateWindowAngle(wall: WallObject): number {
        const data = wall.getData();
        const dx = data.endPoint.x - data.startPoint.x;
        const dy = data.endPoint.y - data.startPoint.y;
        return Math.atan2(dy, dx);
    }

    private findWindowAtPosition(point: Point): WindowObject | null {
        const windows = this.windowStore.getAllWindows();
        return windows.find(window => window.containsPoint(point)) || null;
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
        const wallData = wall.getData();
        const start = wallData.startPoint;
        const end = wallData.endPoint;
        
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return start;
        
        const t = Math.max(0, Math.min(1, (
            (point.x - start.x) * dx +
            (point.y - start.y) * dy
        ) / (length * length)));
        
        return {
            x: start.x + t * dx,
            y: start.y + t * dy
        };
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

        const angle = this.calculateWindowAngle(wall);
        const windowWidth = this.state.selectedWindow?.getData().properties.width || 100;
        const windowHeight = this.state.selectedWindow?.getData().properties.height || 150;

        // Create preview frame
        const framePoints: number[] = [];
        const numDivisions = 2;
        const spacing = windowWidth / numDivisions;

        for (let i = 0; i <= numDivisions; i++) {
            const x = -windowWidth/2 + i * spacing;
            framePoints.push(
                x, -windowHeight/4,
                x, windowHeight/4
            );
        }

        // Create preview line
        this.state.previewLine = new Line({
            points: framePoints,
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

    private flipSelectedWindow(): void {
        if (!this.state.selectedWindow) {
            this.logger.warn('Window tool: No window selected for flipping');
            return;
        }

        try {
            this.state.selectedWindow.flipWindow();
            
            // Force redraw
            const layers = this.canvasStore.getLayers();
            if (layers?.mainLayer) {
                this.state.selectedWindow.render(layers.mainLayer);
                layers.mainLayer.batchDraw();
            }

            this.logger.info('Window tool: Window flipped', {
                windowId: this.state.selectedWindow.id
            });
        } catch (error) {
            this.logger.error('Window tool: Failed to flip window', error instanceof Error ? error : new Error('Unknown error'));
        }
    }

    private handleWallMovement(event: { 
        wallId: string, 
        wall: WallObject,
        newStartPoint: Point,
        newEndPoint: Point 
    }): void {
        // Find all windows on this wall
        const windowsOnWall = this.windowStore.getAllWindows()
            .filter(window => window.getData().wallId === event.wallId);

        if (windowsOnWall.length === 0) return;

        const layers = this.canvasStore.getLayers();
        if (!layers?.mainLayer) return;

        // Update each window's position
        windowsOnWall.forEach(window => {
            const windowData = window.getData();
            
            // Calculate relative position along wall (0 to 1)
            const oldWallData = event.wall.getData();
            const oldWallLength = this.getDistance(oldWallData.startPoint, oldWallData.endPoint);
            const windowToStartDist = this.getDistance(windowData.position, oldWallData.startPoint);
            const relativePosition = windowToStartDist / oldWallLength;

            // Calculate new position using the same relative position
            const newWallLength = this.getDistance(event.newStartPoint, event.newEndPoint);
            const newWindowDist = relativePosition * newWallLength;
            const dx = event.newEndPoint.x - event.newStartPoint.x;
            const dy = event.newEndPoint.y - event.newStartPoint.y;
            const angle = Math.atan2(dy, dx);

            const newPosition: Point = {
                x: event.newStartPoint.x + Math.cos(angle) * newWindowDist,
                y: event.newStartPoint.y + Math.sin(angle) * newWindowDist
            };

            // Update window position and angle
            window.updatePosition(newPosition);
            window.updateWallReference(event.wall);

            // Render the updated window
            window.render(layers.mainLayer);
        });

        // Batch draw all changes
        layers.mainLayer.batchDraw();

        this.logger.info('Window tool: Updated windows after wall movement', {
            wallId: event.wallId,
            updatedWindows: windowsOnWall.map(w => w.id)
        });
    }

    private validateWindowPosition(window: WindowObject | any, wall: WallObject): boolean {
        const windowWidth = window instanceof WindowObject ? 
            window.getData().properties.width : 
            window.properties.width;

        const windowHeight = window instanceof WindowObject ?
            window.getData().properties.height :
            window.properties.height;

        // Get wall data
        const wallData = wall.getData();
        const wallLength = this.getDistance(wallData.startPoint, wallData.endPoint);
        
        // Check if wall is long enough for window
        if (wallLength < windowWidth) {
            this.logger.warn('Window tool: Wall too short for window', {
                wallLength,
                windowWidth
            });
            return false;
        }

        // Get window position
        const windowPos = window instanceof WindowObject ? 
            window.getData().position : 
            window.position;

        // Calculate window endpoints
        const windowAngle = this.calculateWindowAngle(wall);
        const halfWidth = windowWidth / 2;
        const windowStart = {
            x: windowPos.x - Math.cos(windowAngle) * halfWidth,
            y: windowPos.y - Math.sin(windowAngle) * halfWidth
        };
        const windowEnd = {
            x: windowPos.x + Math.cos(windowAngle) * halfWidth,
            y: windowPos.y + Math.sin(windowAngle) * halfWidth
        };

        // Check if window endpoints are within wall bounds
        const startDist = this.getDistance(windowStart, wallData.startPoint);
        const endDist = this.getDistance(windowEnd, wallData.endPoint);
        const minMargin = 10; // Minimum margin from wall ends

        if (startDist < minMargin || endDist < minMargin) {
            this.logger.warn('Window tool: Window too close to wall endpoints', {
                startDist,
                endDist,
                minMargin
            });
            return false;
        }

        // Check for overlapping windows
        const windowsOnWall = this.windowStore.getAllWindows()
            .filter(w => w.getData().wallId === wall.id && 
                    (!(window instanceof WindowObject) || w.id !== window.id));

        for (const existingWindow of windowsOnWall) {
            const existingData = existingWindow.getData();
            const distance = this.getDistance(existingData.position, windowPos);
            const minDistance = (existingData.properties.width + windowWidth) / 2 + 10;

            if (distance < minDistance) {
                this.logger.warn('Window tool: Window overlaps with existing window', {
                    distance,
                    minDistance,
                    existingWindowId: existingWindow.id
                });
                return false;
            }
        }

        // Check for overlapping doors
        const doorsOnWall = this.canvasStore.getDoorStore().getDoorsByWall(wall.id);
        for (const door of doorsOnWall) {
            const doorData = door.getData();
            const distance = this.getDistance(doorData.position, windowPos);
            const minDistance = (doorData.properties.width + windowWidth) / 2 + 10;

            if (distance < minDistance) {
                this.logger.warn('Window tool: Window overlaps with door', {
                    distance,
                    minDistance,
                    doorId: door.id
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
        // Get all windows that were on the original wall
        const affectedWindows = this.windowStore.getAllWindows()
            .filter(window => window.getData().wallId === event.originalWallId);

        if (affectedWindows.length === 0) return;

        this.logger.info('Window tool: Handling wall split', {
            originalWallId: event.originalWallId,
            newWallIds: event.newWalls.map(w => w.id),
            affectedWindows: affectedWindows.map(w => w.id)
        });

        // For each affected window, find the closest new wall segment
        affectedWindows.forEach(window => {
            const windowPos = window.getData().position;
            let closestWall: WallObject | null = null;
            let minDistance = Infinity;

            // Find the closest new wall segment
            event.newWalls.forEach(({ wall }) => {
                const nearestPoint = this.getNearestPointOnWall(windowPos, wall);
                const distance = this.getDistance(windowPos, nearestPoint);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestWall = wall;
                }
            });

            if (closestWall) {
                // Update window's wall reference
                window.updateWallReference(closestWall);
                
                // Ensure window is properly positioned on the new wall
                const snappedPos = this.getNearestPointOnWall(windowPos, closestWall);
                window.updatePosition(snappedPos);

                this.logger.info('Window tool: Reassigned window to new wall segment', {
                    windowId: window.id,
                    newWallId: closestWall.id,
                    newPosition: snappedPos
                });
            }
        });

        // Force redraw
        const layers = this.canvasStore.getLayers();
        if (layers?.mainLayer) {
            layers.mainLayer.batchDraw();
        }
    }
} 