import { Vector2 } from 'three';
import { WallGraph } from '../models/WallGraph';
import { WallNode } from '../models/WallNode';
import { Wall } from '../models/Wall';
import { IEventManager } from '../interfaces/IEventManager';

export enum WallToolMode {
    IDLE = 'IDLE',
    DRAWING = 'DRAWING',
    MOVING_NODE = 'MOVING_NODE',
    SPLITTING_WALL = 'SPLITTING_WALL'
}

export interface WallToolStateContext {
    graph: WallGraph;
    defaultProperties: {
        thickness: number;
        height: number;
        material?: string;
    };
}

export class WallToolState {
    private mode: WallToolMode = WallToolMode.IDLE;
    private context: WallToolStateContext;
    private isDragging: boolean = false;
    
    // State-specific data
    private activeNode: WallNode | null = null;
    private startNode: WallNode | null = null;
    private activeWall: Wall | null = null;
    private tempPoint: Vector2 | null = null;

    constructor(
        context: WallToolStateContext,
        private readonly eventManager: IEventManager
    ) {
        this.context = context;
    }

    // Mode getters and setters
    getMode(): WallToolMode {
        return this.mode;
    }

    setMode(mode: WallToolMode): void {
        this.mode = mode;
        this.resetStateData();
    }

    // Handle mouse interactions
    handleMouseDown(point: Vector2): void {
        // Ensure we have valid coordinates
        const x = Math.round(point.x);
        const y = Math.round(point.y);
        const validPoint = new Vector2(x, y);
        this.isDragging = true;

        switch (this.mode) {
            case WallToolMode.IDLE:
                this.handleIdleMouseDown(validPoint);
                break;
            case WallToolMode.DRAWING:
                if (!this.isDragging) {
                    this.handleDrawingMouseDown(validPoint);
                }
                break;
            case WallToolMode.MOVING_NODE:
                this.handleMovingNodeMouseDown(validPoint);
                break;
            case WallToolMode.SPLITTING_WALL:
                this.handleSplittingWallMouseDown(validPoint);
                break;
        }
    }

    handleMouseMove(point: Vector2): void {
        // Ensure we have valid coordinates
        const x = Math.round(point.x);
        const y = Math.round(point.y);
        this.tempPoint = new Vector2(x, y);
        
        switch (this.mode) {
            case WallToolMode.DRAWING:
                // Just update preview while dragging
                break;
            case WallToolMode.MOVING_NODE:
                if (this.activeNode && this.isDragging) {
                    this.activeNode.setPosition(x, y);
                    // Node will automatically update its connected walls
                }
                break;
            case WallToolMode.SPLITTING_WALL:
                // Update split preview
                break;
        }
    }

    handleMouseUp(point: Vector2): void {
        // Ensure we have valid coordinates
        const x = Math.round(point.x);
        const y = Math.round(point.y);
        const validPoint = new Vector2(x, y);

        if (this.isDragging && this.mode === WallToolMode.DRAWING) {
            this.handleDrawingMouseDown(validPoint);
        }

        this.isDragging = false;

        switch (this.mode) {
            case WallToolMode.MOVING_NODE:
                this.finishNodeMove();
                break;
            case WallToolMode.SPLITTING_WALL:
                this.finishWallSplit(validPoint);
                break;
        }
    }

    // Mode-specific handlers
    private handleIdleMouseDown(point: Vector2): void {
        // Check for existing node first
        const existingNode = this.context.graph.findClosestNode(point);
        if (existingNode) {
            this.activeNode = existingNode;
            this.mode = WallToolMode.MOVING_NODE;
            return;
        }

        // Check for wall intersection
        const intersection = this.context.graph.findWallIntersection(point);
        if (intersection) {
            this.activeWall = intersection.wall;
            this.mode = WallToolMode.SPLITTING_WALL;
            return;
        }

        // Start new wall
        this.startNode = this.context.graph.addNode(point.x, point.y);
        this.mode = WallToolMode.DRAWING;
    }

    private handleDrawingMouseDown(point: Vector2): void {
        if (!this.startNode) return;

        const existingNode = this.context.graph.findClosestNode(point);
        const endNode = existingNode || this.context.graph.addNode(point.x, point.y);

        // Create the wall
        const wall = this.context.graph.createWall(this.startNode, endNode, this.context.defaultProperties);
        
        // Emit wall created event
        this.eventManager.emit('wall:created', { wall });

        // Continue drawing from this node
        this.startNode = endNode;
    }

    private handleMovingNodeMouseDown(point: Vector2): void {
        // Already handled in mouseDown
    }

    private handleSplittingWallMouseDown(point: Vector2): void {
        if (!this.activeWall) return;
        this.context.graph.splitWall(this.activeWall, point);
        this.mode = WallToolMode.IDLE;
    }

    private finishNodeMove(): void {
        this.activeNode = null;
        this.mode = WallToolMode.IDLE;
    }

    private finishWallSplit(point: Vector2): void {
        if (!this.activeWall) return;
        this.context.graph.splitWall(this.activeWall, point);
        this.activeWall = null;
        this.mode = WallToolMode.IDLE;
    }

    private resetStateData(): void {
        this.activeNode = null;
        this.startNode = null;
        this.activeWall = null;
        this.tempPoint = null;
        this.isDragging = false;
    }

    // Getters for rendering
    getActiveNode(): WallNode | null {
        return this.activeNode;
    }

    getStartNode(): WallNode | null {
        return this.startNode;
    }

    getTempPoint(): Vector2 | null {
        return this.tempPoint?.clone() || null;
    }

    getActiveWall(): Wall | null {
        return this.activeWall;
    }
} 