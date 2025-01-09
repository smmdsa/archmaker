import { BaseTool } from '../../core/tools/BaseTool';
import { IToolContext } from '../../core/tools/interfaces/ITool';
import { IPlugin } from '../../core/interfaces/IPlugin';
import { Point } from '../../store/ProjectStore';
import { RoomService } from './services/RoomService';
import { RoomDrawingState } from './interfaces/IRoom';
import { RoomRenderer } from './renderers/RoomRenderer';
import { ToolService } from '../../core/tools/services/ToolService';

export class RoomTool extends BaseTool implements IPlugin {
    private drawingState: RoomDrawingState | null = null;
    private roomService: RoomService;
    private roomRenderer: RoomRenderer;
    private readonly SNAP_THRESHOLD = 20; // pixels
    private readonly DEFAULT_WALL_THICKNESS = 20;
    private readonly DEFAULT_WALL_HEIGHT = 280;

    readonly manifest = {
        id: 'room:default',
        name: 'Room Tool',
        version: '1.0.0',
        description: 'Tool for creating rooms with four walls',
        dependencies: ['wall:default']
    };

    constructor() {
        super(
            'room:default',
            'Room',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 13H3v-2h7V4h2v7h7v2h-7v7h-2v-7z"/></svg>',
            'room',
            'R'
        );
        this.roomService = RoomService.getInstance();
        this.roomRenderer = new RoomRenderer();
    }

    async initialize(): Promise<void> {
        ToolService.getInstance().registerTool(this);
        await super.initialize();
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.subscribeToEvent('config-updated', (config) => {
            this.emitEvent('properties-changed', config);
        });
    }

    onMouseDown(context: IToolContext): void {
        if (!this.isActive()) return;

        const snapPoint = this.roomService.getSnapPoints().find(point => 
            this.calculateDistance(point, context.canvasPosition) <= this.SNAP_THRESHOLD
        );

        const startPoint = snapPoint || context.canvasPosition;

        this.drawingState = {
            isDrawing: true,
            startPoint,
            currentPoint: startPoint,
            snapPoint: snapPoint,
            previewWalls: []
        };

        // Limpiar capa temporal y comenzar preview
        this.roomRenderer.clear(context.layer);
        console.log('🏠 Started room drawing');
    }

    onMouseMove(context: IToolContext): void {
        if (!this.isActive() || !this.drawingState?.isDrawing) return;

        const snapPoint = this.roomService.getSnapPoints().find(point => 
            this.calculateDistance(point, context.canvasPosition) <= this.SNAP_THRESHOLD
        );

        const currentPoint = snapPoint || context.canvasPosition;
        this.drawingState.currentPoint = currentPoint;

        // Limpiar y renderizar preview
        this.roomRenderer.clear(context.layer);
        this.roomRenderer.renderPreview(
            context.layer,
            this.drawingState.startPoint,
            currentPoint,
            {
                wallThickness: this.DEFAULT_WALL_THICKNESS,
                showDimensions: true,
                isPreview: true
            }
        );
    }

    onMouseUp(context: IToolContext): void {
        if (!this.isActive() || !this.drawingState?.isDrawing) return;

        const snapPoint = this.roomService.getSnapPoints().find(point => 
            this.calculateDistance(point, context.canvasPosition) <= this.SNAP_THRESHOLD
        );

        const endPoint = snapPoint || context.canvasPosition;
        const width = Math.abs(endPoint.x - this.drawingState.startPoint.x);
        const height = Math.abs(endPoint.y - this.drawingState.startPoint.y);

        // Verificar tamaño mínimo
        if (width >= 100 && height >= 100) {
            this.createRoom(
                this.drawingState.startPoint,
                width,
                height,
                context.mainLayer
            );
            console.log(`✅ Room created - ${width/100}m x ${height/100}m`);
        } else {
            console.log('⚠️ Room too small - minimum size: 1m x 1m');
        }

        // Limpiar estado y capa temporal
        this.roomRenderer.clear(context.layer);
        this.drawingState = null;
    }

    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape' && this.drawingState?.isDrawing) {
            this.cancelDrawing();
            console.log('🚫 Room drawing cancelled');
        }
    }

    private async createRoom(startPoint: Point, width: number, height: number, layer: Konva.Layer): Promise<void> {
        try {
            const room = await this.roomService.createRoom(
                startPoint,
                width,
                height,
                {
                    wallThickness: this.DEFAULT_WALL_THICKNESS,
                    wallHeight: this.DEFAULT_WALL_HEIGHT,
                    name: `Room ${Date.now()}`
                }
            );

            // Renderizar la habitación en la capa principal
            this.roomRenderer.renderRoom(layer, room, {
                showDimensions: true
            });

            this.emitEvent('room-created', room);
        } catch (error) {
            console.error('❌ Error creating room:', error);
            this.emitEvent('room-creation-error', error);
        }
    }

    private cancelDrawing(): void {
        if (this.drawingState) {
            this.drawingState = null;
            this.emitEvent('drawing-cancel');
        }
    }

    private calculateDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    protected async onActivate(): Promise<void> {
        console.log('🏠 Room Tool activated - Click and drag to create a room');
        await super.onActivate();
    }

    protected async onDeactivate(): Promise<void> {
        console.log('🏠 Room Tool deactivated');
        this.cancelDrawing();
        await super.onDeactivate();
    }
} 