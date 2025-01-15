import { Point } from '../../core/types/geometry';
import { CanvasStore } from '../../store/CanvasStore';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import { BaseTool } from '../../core/tools/BaseTool';
import { WindowObject } from './objects/WindowObject';
import { WindowStore } from './stores/WindowStore';
import { WallObject } from '../wall-tool/objects/WallObject';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { v4 as uuidv4 } from 'uuid';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { WallGraph } from '../wall-tool/models/WallGraph';
import { WindowNode } from './objects/WindowNode';

enum WindowToolMode {
    IDLE = 'idle',
    SELECTING_WALL = 'selecting_wall',
    PLACING_WINDOW = 'placing_window',
    MOVING_WINDOW = 'moving_window',
    DRAGGING_WINDOW = 'dragging_window',
    DRAGGING_NODE = 'dragging_node'
}

interface WindowToolState {
    mode: WindowToolMode;
    selectedWall: WallObject | null;
    selectedWindow: WindowObject | null;
    selectedNode: WindowNode | null;
    windowPosition: Point | null;
    dragStartPosition: Point | null;
    dragOffset: Point | null;
}

interface WindowProperties {
    width: number;
    height: number;
    color: string;
}

const toolManifest = {
    id: 'window-tool',
    name: 'Window Tool',
    version: '1.0.0',
    icon: '🪟',
    tooltip: 'Place windows on walls (E)',
    section: 'architecture',
    order: 4,
    shortcut: 'e'
};

@ToolPlugin(toolManifest)
export class WindowTool extends BaseTool {
    private state: WindowToolState = {
        mode: WindowToolMode.IDLE,
        selectedWall: null,
        selectedWindow: null,
        selectedNode: null,
        windowPosition: null,
        dragStartPosition: null,
        dragOffset: null
    };

    private windowStore: WindowStore;
    private wallGraph: WallGraph;
    private canvasStore: CanvasStore;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, 'window-tool', toolManifest);
        this.windowStore = WindowStore.getInstance(eventManager, logger);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
        this.wallGraph = this.canvasStore.getWallGraph();
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

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position) {
            this.logger.warn('Window tool: Mouse down event without position');
            return;
        }

        this.logger.info('Window tool: Mouse down', {
            position: event.position,
            currentMode: this.state.mode,
            button: event.originalEvent instanceof MouseEvent ? event.originalEvent.button : 'unknown'
        });

        // First, check if we hit a window node
        const nodeHit = this.findWindowNodeAtPosition(event.position);
        if (nodeHit) {
            this.logger.info('Window tool: Hit window node', {
                nodeId: nodeHit.node.id,
                windowId: nodeHit.window.id,
                isEndpoint: nodeHit.node.isEndpointNode()
            });

            // Select the window and node
            this.state.selectedWindow = nodeHit.window;
            this.state.selectedNode = nodeHit.node;
            this.state.mode = WindowToolMode.DRAGGING_NODE;

            // Calculate drag offset
            const nodePos = nodeHit.node.getData().position;
            this.state.dragOffset = {
                x: event.position.x - nodePos.x,
                y: event.position.y - nodePos.y
            };
            this.state.dragStartPosition = event.position;

            // Update selection
            this.windowStore.getAllWindows().forEach(window => {
                if (window !== nodeHit.window) {
                    window.setSelected(false);
                    window.setHighlighted(false);
                }
            });
            nodeHit.window.setSelected(true);
            nodeHit.window.setHighlighted(true);

            return;
        }

        // If we didn't hit a node, check for window hit
        const hitWindow = this.findWindowAtPosition(event.position);
        
        if (hitWindow) {
            this.logger.info('Window tool: Hit existing window', {
                windowId: hitWindow.id,
                position: event.position
            });
            // Clear any existing selection
            this.windowStore.getAllWindows().forEach(window => {
                if (window !== hitWindow) {
                    window.setSelected(false);
                    window.setHighlighted(false);
                }
            });

            // Select and highlight the hit door
            hitWindow.setSelected(true);
            hitWindow.setHighlighted(true);
            this.state.selectedWindow = hitWindow;

            // Emit selection event
            this.eventManager.emit('selection:changed', {
                selectedNodes: [],
                selectedWalls: [],
                selectedDoors: [hitWindow.id],
                selectedWindows: [],
                source: 'window-tool'
            });

            // Calculate drag offset
            const windowPos = hitWindow.getData().position;
            this.state.dragOffset = {
                x: event.position.x - windowPos.x,
                y: event.position.y - windowPos.y
            };
            this.state.dragStartPosition = event.position;

            // Set mode based on mouse button
            if (event.originalEvent instanceof MouseEvent && event.originalEvent.button === 0) {
                this.state.mode = WindowToolMode.DRAGGING_WINDOW;
            } else {
                this.state.mode = WindowToolMode.MOVING_WINDOW;
            }

            return;
        }

        // If we didn't hit a door, clear selection
        if (this.state.selectedWindow) {
            this.state.selectedWindow.setSelected(false);
            this.state.selectedWindow.setHighlighted(false);
            
            // Emit empty selection event
            this.eventManager.emit('selection:changed', {
                selectedNodes: [],
                selectedWalls: [],
                selectedDoors: [],
                selectedWindows: [],
                source: 'window-tool'
            });
            
            this.state.selectedWindow = null;
            this.state.dragOffset = null;
            this.state.dragStartPosition = null;
            this.state.mode = WindowToolMode.IDLE;
        }

        // Handle wall selection for door placement
        if (this.state.mode === WindowToolMode.IDLE) {
            this.state.mode = WindowToolMode.SELECTING_WALL;
            this.logger.info('Window tool: Entering wall selection mode');
        }
    }


    private placeWindow(wall: WallObject, position: Point): void {
        const angle = this.calculateWindowAngle(wall);
        const window = new WindowObject({
            id: uuidv4(),
            wallId: wall.id,
            position,
            angle,
            isFlipped: false,
            properties: {
                width: 100,
                height: 150,
                color: '#FF69B4',
                isOpen: false,
                openDirection: 'left'
            },
            windowNumber: null
        });
        this.windowStore.addWindow(window);
        this.logger.info('Placed window on wall:', {
            wallId: wall.id,
            position
        });

        // Emit event to update the scene
        this.eventManager.emit('window:changed', {
            windowId: window.id,
            window: window
        });
    }

    private async handleMouseMove(point: Point): Promise<void> {
        this.logger.info('Window tool: Mouse move', {
            point,
            currentMode: this.state.mode,
            hasSelectedWall: !!this.state.selectedWall,
            hasSelectedWindow: !!this.state.selectedWindow
        });

        switch (this.state.mode) {
            case WindowToolMode.SELECTING_WALL:
                // Find wall under cursor
                const walls = this.wallGraph.getAllWalls();
                let nearestWall: WallObject | null = null;

                // Log total walls being checked
                this.logger.info('Window tool: Checking walls for hit detection', {
                    totalWalls: walls.length,
                    mousePosition: point
                });

                for (const wall of walls) {
                    if (wall.containsPoint(point)) {
                        nearestWall = wall;
                        this.logger.info('Window tool: Mouse is over wall', {
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

                // Update window position and preview
                if (nearestWall) {
                    const newPosition = this.getNearestPointOnWall(point, nearestWall);
                    this.state.windowPosition = newPosition;

                    // Emit preview event
                    this.eventManager.emit('canvas:preview', {
                        data: {
                            type: 'window',
                            position: newPosition,
                            angle: this.calculateWindowAngle(nearestWall),
                            width: 100, // Default window width
                            isFlipped: false
                        }
                    });
                } else {
                    // Clear preview if no wall is found
                    this.eventManager.emit('canvas:preview', { data: null });
                }
                break;

            case WindowToolMode.MOVING_WINDOW:
            case WindowToolMode.DRAGGING_WINDOW:
                if (!this.state.selectedWindow || !this.state.dragOffset) {
                    this.resetToolState();
                    return;
                }

                const nearestWallForDrag = this.findNearestWall(point);
                if (nearestWallForDrag) {
                    // Calculate new position on the wall
                    const newPos = this.getNearestPointOnWall(point, nearestWallForDrag);

                    // Emit preview event for dragging
                    const windowData = this.state.selectedWindow.getData();
                    this.eventManager.emit('canvas:preview', {
                        data: {
                            type: 'window',
                            position: newPos,
                            angle: this.calculateWindowAngle(nearestWallForDrag),
                            width: windowData.properties.width,
                            height: windowData.properties.height,
                            isFlipped: windowData.isFlipped
                        }
                    });
                } else {
                    // Clear preview if no wall is found
                    this.eventManager.emit('canvas:preview', { data: null });
                }
                break;

            case WindowToolMode.DRAGGING_NODE:
                if (!this.state.selectedNode || !this.state.selectedWindow || !this.state.dragOffset) {
                    this.resetToolState();
                    return;
                }

                const nearestWallForNode = this.findNearestWall(point);
                if (nearestWallForNode) {
                    // Calculate new position on the wall
                    const newPos = this.getNearestPointOnWall(point, nearestWallForNode);

                    // Move the node (which will update both nodes through the WindowNode's move method)
                    this.state.selectedNode.move(newPos);

                    // Update preview
                    const windowData = this.state.selectedWindow.getData();
                    this.eventManager.emit('canvas:preview', {
                        data: {
                            type: 'window',
                            position: windowData.position,
                            angle: windowData.angle,
                            width: windowData.properties.width,
                            height: windowData.properties.height,
                            isFlipped: windowData.isFlipped
                        }
                    });
                } else {
                    this.eventManager.emit('canvas:preview', { data: null });
                }
                break;
        }
    }

    private async handleMouseUp(point: Point): Promise<void> {
        this.logger.info('Window tool: Mouse up', {
            point,
            currentMode: this.state.mode,
            hasSelectedWall: !!this.state.selectedWall,
            hasWindowPosition: !!this.state.windowPosition
        });

        switch (this.state.mode) {
            case WindowToolMode.SELECTING_WALL:
                if (this.state.selectedWall && this.state.windowPosition) {
                    this.logger.info('Window tool: Attempting to place window', {
                        wallId: this.state.selectedWall.id,
                        position: this.state.windowPosition
                    });
                    this.placeWindow(this.state.selectedWall, this.state.windowPosition);
                    this.clearPreview();
                    this.state.mode = WindowToolMode.IDLE;
                } else {
                    this.logger.warn('Window tool: Cannot place window - missing wall or position', {
                        hasWall: !!this.state.selectedWall,
                        hasPosition: !!this.state.windowPosition
                    });
                }
                break;

            case WindowToolMode.DRAGGING_WINDOW:
                if (this.state.selectedWindow) {
                    const nearestWall = this.findNearestWall(point);
                    if (nearestWall) {
                        const snappedPos = this.getNearestPointOnWall(point, nearestWall);
                        
                        // Update window position and wall reference
                        this.state.selectedWindow.updatePosition(snappedPos);
                        this.state.selectedWindow.updateWallReference(nearestWall);
                        
                        // Trigger re-render
                        this.eventManager.emit('window:changed', {
                            windowId: this.state.selectedWindow.id,
                            window: this.state.selectedWindow
                        });

                        // Emit graph changed event to update counts
                        this.eventManager.emit('graph:changed', {
                            nodeCount: this.wallGraph.getAllNodes().length,
                            wallCount: this.wallGraph.getAllWalls().length,
                            doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
                            windowCount: this.windowStore.getAllWindows().length
                        });
                    }
                }
                this.clearPreview();
                this.state.mode = WindowToolMode.IDLE;
                this.state.dragOffset = null;
                this.state.dragStartPosition = null;
                break;

            case WindowToolMode.MOVING_WINDOW:
                if (this.state.selectedWindow) {
                    const nearestWall = this.findNearestWall(point);
                    if (nearestWall) {
                        const snappedPos = this.getNearestPointOnWall(point, nearestWall);
                        this.state.selectedWindow.updatePosition(snappedPos);
                        this.state.selectedWindow.updateWallReference(nearestWall);
                        
                        // Trigger re-render
                        this.eventManager.emit('window:changed', {
                            windowId: this.state.selectedWindow.id,
                            window: this.state.selectedWindow
                        });
                    }
                }
                this.clearPreview();
                this.state.mode = WindowToolMode.IDLE;
                this.state.dragOffset = null;
                this.state.dragStartPosition = null;
                break;

            case WindowToolMode.DRAGGING_NODE:
                if (this.state.selectedNode && this.state.selectedWindow) {
                    const nearestWall = this.findNearestWall(point);
                    if (nearestWall) {
                        const snappedPos = this.getNearestPointOnWall(point, nearestWall);
                        
                        // Update node position
                        this.state.selectedNode.move(snappedPos);
                        
                        // Trigger re-render
                        this.eventManager.emit('window:changed', {
                            windowId: this.state.selectedWindow.id,
                            window: this.state.selectedWindow
                        });

                        // Emit graph changed event
                        this.eventManager.emit('graph:changed', {
                            nodeCount: this.wallGraph.getAllNodes().length,
                            wallCount: this.wallGraph.getAllWalls().length,
                            doorCount: this.canvasStore.getDoorStore().getAllDoors().length,
                            windowCount: this.windowStore.getAllWindows().length
                        });
                    }
                }
                this.clearPreview();
                this.state.mode = WindowToolMode.IDLE;
                this.state.dragOffset = null;
                this.state.dragStartPosition = null;
                this.state.selectedNode = null;
                break;
        }

        // Clear wall highlight
        if (this.state.selectedWall) {
            this.state.selectedWall.setHighlighted(false);
            this.logger.info('Window tool: Clearing wall highlight', {
                wallId: this.state.selectedWall.id
            });
            this.state.selectedWall = null;
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

    private calculateWindowAngle(wall: WallObject): number {
        const data = wall.getData();
        const startNode = this.wallGraph.getNode(data.startNodeId);
        const endNode = this.wallGraph.getNode(data.endNodeId);

        if (!startNode || !endNode) {
            this.logger.error('Failed to calculate window angle: missing wall nodes');
            return 0;
        }

        // Calculate angle from wall direction
        const dx = endNode.position.x - startNode.position.x;
        const dy = endNode.position.y - startNode.position.y;
        return Math.atan2(dy, dx);
    }
    private resetToolState(): void {
        this.state.selectedWindow = null;
        this.state.dragOffset = null;
        this.state.dragStartPosition = null;
        this.state.mode = WindowToolMode.IDLE;
        // Clear any preview
        this.eventManager.emit('canvas:preview', { data: null });
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

    private clearPreview(): void {
        // Clear preview by emitting null data
        this.eventManager.emit('canvas:preview', {
            data: null
        });
    }

    private findWindowNodeAtPosition(point: Point): { node: WindowNode, window: WindowObject } | null {
        const windows = this.windowStore.getAllWindows();
        const NODE_HIT_RADIUS = 10; // Radius for node hit detection

        for (const window of windows) {
            // Check node A
            const nodeA = window.getNodeA();
            const distanceA = this.getDistance(point, nodeA.getData().position);
            if (distanceA <= NODE_HIT_RADIUS) {
                return { node: nodeA, window: window };
            }

            // Check node B
            const nodeB = window.getNodeB();
            const distanceB = this.getDistance(point, nodeB.getData().position);
            if (distanceB <= NODE_HIT_RADIUS) {
                return { node: nodeB, window: window };
            }
        }

        return null;
    }

    private findWindowAtPosition(point: Point): WindowObject | null {
        const windows = this.windowStore.getAllWindows();
        const WINDOW_HIT_PADDING = 20; // Larger hit box area around the window

        for (const window of windows) {
            const windowData = window.getData();
            const windowPos = windowData.position;
            const windowWidth = windowData.properties.width;
            const angle = windowData.angle;

            // Calculate window endpoints considering angle
            const dx = Math.cos(angle) * (windowWidth / 2);
            const dy = Math.sin(angle) * (windowWidth / 2);

            // Window endpoints
            const startPoint = { x: windowPos.x - dx, y: windowPos.y - dy };
            const endPoint = { x: windowPos.x + dx, y: windowPos.y + dy };

            // Calculate distance from point to door line segment
            const distance = this.getDistanceToLineSegment(point, startPoint, endPoint);

            // Check if point is within the padded hit box
            if (distance <= WINDOW_HIT_PADDING) {
                return window;
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
    
} 