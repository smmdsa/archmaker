import { Point } from '../../../core/types/geometry';
import { NodeObject } from '../objects/NodeObject';
import { WallObject } from '../objects/WallObject';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';

export enum WallToolMode {
    IDLE = 'idle',
    DRAWING = 'drawing',
    MOVING_NODE = 'moving_node',
    SPLITTING_WALL = 'splitting_wall'
}

export interface WallToolState {
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

export class WallToolStateManager {
    private state: WallToolState;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.state = this.getInitialState();
        this.setupEventListeners();
    }

    private getInitialState(): WallToolState {
        return {
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
    }

    private setupEventListeners(): void {
        // Listen for selection changes from other sources
        this.eventManager.on('selection:changed', (event: { 
            selectedNodes: string[],
            selectedWalls: string[],
            selectedDoors: string[],
            selectedWindows: string[],
            source: string 
        }) => {
            if (event.source === 'wall-tool') return;
            
            // Clear current selection
            this.clearSelection();
        });
    }

    // State transitions
    enterDrawingMode(startNode: NodeObject): void {
        this.state.mode = WallToolMode.DRAWING;
        this.state.isDrawing = true;
        this.state.startNode = startNode;
        this.logger.info('Entered drawing mode', { nodeId: startNode.id });
    }

    enterMovingNodeMode(node: NodeObject, position: Point): void {
        this.state.mode = WallToolMode.MOVING_NODE;
        this.state.activeNode = node;
        this.state.isDragging = true;
        this.state.dragStartPosition = { ...position };
        this.state.dragOffset = {
            x: position.x - node.position.x,
            y: position.y - node.position.y
        };
        this.logger.info('Entered moving node mode', { nodeId: node.id });
    }

    enterSplittingWallMode(wall: WallObject): void {
        this.state.mode = WallToolMode.SPLITTING_WALL;
        this.state.activeWall = wall;
        this.logger.info('Entered splitting wall mode', { wallId: wall.id });
    }

    enterIdleMode(): void {
        this.state.mode = WallToolMode.IDLE;
        this.state.isDrawing = false;
        this.state.isDragging = false;
        this.logger.info('Entered idle mode');
    }

    // Selection management
    selectWall(wall: WallObject): void {
        this.clearSelection();
        this.state.selectedWall = wall;
        wall.setSelected(true);
        wall.setHighlighted(true);
        
        this.eventManager.emit('selection:changed', {
            selectedNodes: [],
            selectedWalls: [wall.id],
            selectedDoors: [],
            selectedWindows: [],
            source: 'wall-tool'
        });
    }

    selectNode(node: NodeObject): void {
        this.clearSelection();
        this.state.selectedNode = node;
        node.setSelected(true);
        node.setHighlighted(true);
        
        this.eventManager.emit('selection:changed', {
            selectedNodes: [node.id],
            selectedWalls: [],
            selectedDoors: [],
            selectedWindows: [],
            source: 'wall-tool'
        });
    }

    clearSelection(): void {
        if (this.state.selectedWall) {
            this.state.selectedWall.setSelected(false);
            this.state.selectedWall.setHighlighted(false);
            this.state.selectedWall = null;
        }
        
        if (this.state.selectedNode) {
            this.state.selectedNode.setSelected(false);
            this.state.selectedNode.setHighlighted(false);
            this.state.selectedNode = null;
        }
    }

    // State getters
    getMode(): WallToolMode {
        return this.state.mode;
    }

    getState(): Readonly<WallToolState> {
        return { ...this.state };
    }

    // Reset
    reset(): void {
        this.clearSelection();
        this.state = this.getInitialState();
        this.logger.info('Wall tool state reset');
    }

    // Cleanup
    dispose(): void {
        this.clearSelection();
        this.state = this.getInitialState();
    }
} 