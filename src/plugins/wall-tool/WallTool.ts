import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { CanvasStore } from '../../store/CanvasStore';
import { Point } from '../../core/types/geometry';
import { NodeObject } from './objects/NodeObject';
import { WallObject } from './objects/WallObject';
import { SelectionStore } from '../../store/SelectionStore';
import { WallCommandService } from './services/WallCommandService';
import { WallValidationService } from './services/WallValidationService';
import { CommandManager } from './commands/CommandManager';
import { 
    SplitWallCommand,
    MoveNodeCommand,
    CreateWallCommand,
    DeleteWallCommand,
    MergeNodesCommand,
    CreateNodeCommand
} from './commands/Command';

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
    private readonly commandService: WallCommandService;
    private readonly validationService: WallValidationService;
    private readonly commandManager: CommandManager;
    private state: WallToolState = {
        mode: WallToolMode.IDLE,
        isDrawing: false,
        startNode: null,
        activeNode: null,
        activeWall: null,
        snapThreshold: 100,
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
        this.commandService = new WallCommandService(eventManager, logger);
        this.validationService = new WallValidationService(eventManager, logger, this.commandService.getWallGraph());
        this.commandManager = new CommandManager(logger);

        // Subscribe to wall removal events
        this.eventManager.on('wall:removed', (event: { wallId: string }) => {
            // If the removed wall was selected, reset the tool state
            if (this.state.selectedWall?.id === event.wallId) {
                this.resetToolState();
            }
        });

        // Subscribe to keyboard events for undo/redo
        this.eventManager.on('keyboard:keydown', async (event: { key: string, ctrlKey: boolean }) => {
            if (event.ctrlKey) {
                try {
                    if (event.key === 'z') {
                        this.logger.info('Ctrl+Z pressed, attempting to undo last command');
                        await this.commandManager.undo();
                    } else if (event.key === 'y') {
                        this.logger.info('Ctrl+Y pressed, attempting to redo last command');
                        await this.commandManager.redo();
                    }
                } catch (error) {
                    this.logger.error('Error during undo/redo operation:', error instanceof Error ? error : new Error(String(error)));
                }
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
            selectedNodes?: string[],
            selectedWalls?: string[],
            selectedDoors?: string[],
            selectedWindows?: string[],
            source?: string 
        }) => {
            // Skip if we're the source of the event to avoid state race conditions
            if (event.source === 'wall-tool') {
                return;
            }

            const graph = this.canvasStore.getWallGraph();
            const selectedWalls = event.selectedWalls || [];
            
            // Update our internal state to match selection
            if (selectedWalls.length === 1) {
                const selectedWall = graph.getWall(selectedWalls[0]);
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
            case 'dblclick' as string:
                await this.handleWallSplit(event.position);
                break;
        }
    }

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        const graph = this.canvasStore.getWallGraph();
        const hitNode = this.validationService.findNearestNode(event.position, graph.getAllNodes(), this.state.snapThreshold);
        
        if (hitNode) {
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

            // Emit selection event
            this.eventManager.emit('selection:changed', {
                selectedNodes: [hitNode.id],
                selectedWalls: [],
                selectedDoors: [],
                selectedWindows: [],
                source: 'wall-tool'
            });
        } else {
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
                const newNode = await this.commandService.createNode(event.position);
                this.state.startNode = newNode;
                this.state.mode = WallToolMode.DRAWING;
                this.state.isDrawing = true;
                this.initPreviewLine(newNode.position);
            }
        }
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

                    // Check for snapping to other nodes
                    const nearestNode = this.validationService.findNearestNode(
                        targetPosition,
                        this.canvasStore.getWallGraph().getAllNodes().filter(n => n.id !== this.state.activeNode!.id),
                        this.state.snapThreshold
                    );

                    if (nearestNode) {
                        targetPosition = nearestNode.position;
                    }

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

                    // Emit single preview event for all connected walls
                    this.eventManager.emit('canvas:preview', {
                        data: {
                            type: 'walls',
                            walls: previewWalls.map(wall => ({
                                start: wall.start,
                                end: wall.end,
                                thickness: 10
                            }))
                        }
                    });
                }
                break;
            case WallToolMode.DRAWING:
                await this.handleDrawingMouseMove(event);
                break;
        }
    }

    private async handleDrawingMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.isDrawing || !this.state.startNode) return;

        const hitNode = this.validationService.findNearestNode(
            event.position,
            this.canvasStore.getWallGraph().getAllNodes(),
            this.state.snapThreshold
        );
        let endPoint = hitNode ? hitNode.position : event.position;

        // Apply modifier constraints using start node as reference
        endPoint = this.applyModifierConstraints(endPoint, this.state.startNode.position, event);

        // Emit preview event
        this.eventManager.emit('canvas:preview', {
            data: {
                type: 'wall',
                start: this.state.startNode.position,
                end: endPoint,
                thickness: 10
            }
        });
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
                    const nearestNode = this.validationService.findNearestNode(
                        event.position,
                        graph.getAllNodes().filter(n => n.id !== this.state.activeNode!.id),
                        this.state.snapThreshold
                    );

                    if (nearestNode) {
                        // Merge nodes using command system
                        const command = new MergeNodesCommand(
                            { commandService: this.commandService },
                            this.state.activeNode,
                            nearestNode
                        );
                        await this.commandManager.execute(command);

                        // Update selection
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

                        // Move node using command system
                        const command = new MoveNodeCommand(
                            { commandService: this.commandService },
                            this.state.activeNode,
                            finalPosition
                        );
                        await this.commandManager.execute(command);

                        // Keep the moved node selected
                        this.state.selectedNode = this.state.activeNode;
                        this.state.activeNode.setSelected(true);
                        this.state.activeNode.setHighlighted(true);
                    }

                    // Clear preview
                    this.eventManager.emit('canvas:preview', { data: null });
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

        try {
            const graph = this.canvasStore.getWallGraph();
            let endNode: NodeObject | null = null;
            let isNewEndNode = false;

            // Check if we're snapping to an existing node
            const hitNode = this.validationService.findNearestNode(
                event.position,
                graph.getAllNodes(),
                this.state.snapThreshold
            );

            if (hitNode) {
                endNode = hitNode;
            } else {
                // Create new end node using command system
                const createNodeCommand = new CreateNodeCommand(
                    { commandService: this.commandService },
                    event.position
                );
                await this.commandManager.execute(createNodeCommand);
                endNode = createNodeCommand.getNode();
                isNewEndNode = true;
            }

            // Create wall between nodes if they're different and valid
            if (endNode && endNode.id !== this.state.startNode.id && 
                this.validationService.isValidWall(this.state.startNode, endNode)) {
                this.logger.info('Creating new wall', {
                    startNodeId: this.state.startNode.id,
                    endNodeId: endNode.id,
                    isNewEndNode
                });
                const command = new CreateWallCommand(
                    { commandService: this.commandService },
                    this.state.startNode,
                    endNode,
                    undefined, // default properties
                    false, // startNode is always existing in this case
                    isNewEndNode
                );
                await this.commandManager.execute(command);
            }

            // Clean up
            this.cleanupPreviewLine();
            this.state.isDrawing = false;
            this.state.startNode = null;
        } catch (error) {
            this.logger.error('Error in handleDrawingMouseUp:', error instanceof Error ? error : new Error(String(error)));
            this.cleanupPreviewLine();
            this.state.isDrawing = false;
            this.state.startNode = null;
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

    private async handleWallSplit(point: Point): Promise<void> {
        const wall = this.findWallAtPosition(point);
        if (!wall || !this.validationService.isValidSplitPoint(point, wall)) return;

        const command = new SplitWallCommand({ commandService: this.commandService }, wall, point);
        this.commandManager.execute(command);
    }

    private async handleNodeMove(node: NodeObject, newPosition: Point): Promise<void> {
        const command = new MoveNodeCommand({ commandService: this.commandService }, node, newPosition);
        this.commandManager.execute(command);
    }

    private async handleWallCreate(startNode: NodeObject, endNode: NodeObject, properties?: any): Promise<void> {
        const command = new CreateWallCommand({ commandService: this.commandService }, startNode, endNode, properties);
        this.commandManager.execute(command);
    }

    private async handleWallDelete(wall: WallObject): Promise<void> {
        const command = new DeleteWallCommand({ commandService: this.commandService }, wall);
        this.commandManager.execute(command);
    }

    private initPreviewLine(startPoint: Point): void {
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
        this.eventManager.emit('canvas:preview', {
            data: null
        });
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
            snapThreshold: 20,
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
        
        // Apply angle constraints (CTRL or SHIFT)
        if (mouseEvent?.ctrlKey || mouseEvent?.shiftKey) {
            const angle = this.validationService.calculateAngle(referencePoint, result);
            const distance = this.validationService.getDistance(referencePoint, result);

            let snappedAngle;
            if (mouseEvent.ctrlKey) {
                // Snap to nearest 90 degrees
                snappedAngle = Math.round(angle / this.RECT_ANGLE_SNAP) * this.RECT_ANGLE_SNAP;
            } else if (mouseEvent.shiftKey) {
                // Snap to nearest 15 degrees
                snappedAngle = Math.round(angle / this.ANGLE_SNAP) * this.ANGLE_SNAP;
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
        }

        return result;
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
}
