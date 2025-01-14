import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { Point } from '../../core/types/geometry';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { CanvasStore } from '../../store/CanvasStore';
import { Line } from 'konva/lib/shapes/Line';
import { Layer } from 'konva/lib/Layer';

interface RoomToolState {
    isDrawing: boolean;
    startPoint: Point | null;
    previewShape: Line | null;
}

@ToolPlugin({
    id: '@room-tool',
    name: 'Room Tool',
    version: '1.0.0',
    description: 'Tool for creating rectangular rooms',
    icon: '🔳',
    tooltip: 'Create rooms (R)',
    section: 'tools',
    order: 3,
    shortcut: 'r'
})
export class RoomTool extends BaseTool {
    private readonly state: RoomToolState = {
        isDrawing: false,
        startPoint: null,
        previewShape: null
    };

    private static readonly TOOL_ID = '@room-tool';
    private static readonly TOOL_MANIFEST = {
        id: RoomTool.TOOL_ID,
        name: 'Room Tool',
        version: '1.0.0',
        icon: '🔳',
        tooltip: 'Create rooms (R)',
        section: 'tools',
        order: 3,
        shortcut: 'r'
    };

    private canvasStore: CanvasStore;
    private tempLayer: Layer | null = null;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ) {
        super(eventManager, logger, RoomTool.TOOL_ID, RoomTool.TOOL_MANIFEST);
        
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);

        // Subscribe to canvas layer changes
        this.eventManager.on('canvas:layers', (event: any) => {
            this.tempLayer = event.tempLayer;
        });
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        const position = event.position;
        if (!position || !this.tempLayer) return;

        switch (event.type) {
            case 'mousedown':
                await this.handleMouseDown(position);
                break;
            case 'mousemove':
                await this.handleMouseMove(position);
                break;
            case 'mouseup':
                await this.handleMouseUp(position);
                break;
        }
    }

    private async handleMouseDown(point: Point): Promise<void> {
        // Start room creation
        this.state.isDrawing = true;
        this.state.startPoint = point;

        // Create preview shape
        this.state.previewShape = new Line({
            points: [point.x, point.y, point.x, point.y, point.x, point.y, point.x, point.y],
            closed: true,
            stroke: '#666666',
            strokeWidth: 1,
            dash: [5, 5]
        });

        this.tempLayer?.add(this.state.previewShape);
        this.tempLayer?.batchDraw();
    }

    private async handleMouseMove(point: Point): Promise<void> {
        if (!this.state.isDrawing || !this.state.startPoint || !this.state.previewShape) return;

        // Update preview shape
        const points = [
            this.state.startPoint.x, this.state.startPoint.y,
            point.x, this.state.startPoint.y,
            point.x, point.y,
            this.state.startPoint.x, point.y
        ];

        this.state.previewShape.points(points);
        this.tempLayer?.batchDraw();
    }

    private async handleMouseUp(point: Point): Promise<void> {
        if (!this.state.isDrawing || !this.state.startPoint) return;

        const width = Math.abs(point.x - this.state.startPoint.x);
        const height = Math.abs(point.y - this.state.startPoint.y);

        // Only create walls if it has a minimum size
        if (width > 20 && height > 20) {
            // Create walls using WallGraph
            const graph = this.canvasStore.getWallGraph();
            
            // Calculate corner points
            const corners: Point[] = [
                { x: this.state.startPoint.x, y: this.state.startPoint.y },
                { x: point.x, y: this.state.startPoint.y },
                { x: point.x, y: point.y },
                { x: this.state.startPoint.x, y: point.y }
            ];

            // Create nodes first
            const nodes = corners.map(corner => graph.createNode(corner));
            
            // Create walls between nodes
            for (let i = 0; i < nodes.length; i++) {
                const startNode = nodes[i];
                const endNode = nodes[(i + 1) % nodes.length];
                graph.createWall(startNode.id, endNode.id);
            }

            // Notify changes
            this.eventManager.emit('graph:changed', {
                nodeCount: graph.getAllNodes().length,
                wallCount: graph.getAllWalls().length
            });
        }

        // Clean up
        if (this.state.previewShape) {
            this.state.previewShape.destroy();
            this.state.previewShape = null;
            this.tempLayer?.batchDraw();
        }

        this.state.isDrawing = false;
        this.state.startPoint = null;
    }
} 