import { BaseTool } from '../../core/tools/BaseTool';
import { IToolContext } from '../../core/tools/interfaces/ITool';
import { IPlugin } from '../../core/interfaces/IPlugin';
import { Point } from '../../store/ProjectStore';
import { WallService } from './services/WallService';
import { WallDrawingState, IWall } from './interfaces/IWall';
import { WallRenderer } from './renderers/WallRenderer';
import { ToolService } from '../../core/tools/services/ToolService';
import { Layer } from 'konva/lib/Layer';

export class WallTool extends BaseTool implements IPlugin {
    private drawingState: WallDrawingState | null = null;
    private wallService: WallService;
    private wallRenderer: WallRenderer;
    private readonly SNAP_THRESHOLD = 20; // pixels
    private readonly DEFAULT_WALL_THICKNESS = 20;
    private readonly DEFAULT_WALL_HEIGHT = 280;

    readonly manifest = {
        id: 'wall:default',
        name: 'Wall Tool',
        version: '1.0.0',
        description: 'Tool for creating and editing walls',
        dependencies: []
    };

    constructor() {
        super(
            'wall:default',
            'Wall',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/></svg>',
            'wall',
            'W'
        );
        this.wallService = WallService.getInstance();
        this.wallRenderer = new WallRenderer();
    }

    async initialize(): Promise<void> {
        // Registrar la herramienta en el ToolService
        ToolService.getInstance().registerTool(this);
        await super.initialize();
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Suscribirse a eventos de configuración
        this.subscribeToEvent('config-updated', (config) => {
            this.emitEvent('properties-changed', config);
        });

        // Suscribirse a eventos del grid
        this.subscribeToEvent('grid:size-changed', (size: number) => {
            this.wallRenderer.setGridSize(size);
        });

        this.subscribeToEvent('grid:enabled-changed', (enabled: boolean) => {
            this.wallRenderer.enableGridSnapping(enabled);
        });
    }

    // Event handlers
    onMouseDown(context: IToolContext): void {
        if (!this.isActive()) return;

        const snapPoint = this.wallService.getNearestSnapPoint(context.canvasPosition, this.SNAP_THRESHOLD);
        const startPoint = snapPoint || context.canvasPosition;

        this.drawingState = {
            isDrawing: true,
            startPoint,
            currentPoint: startPoint,
            snapPoint: snapPoint,
            previewWall: {
                startPoint,
                endPoint: startPoint,
                thickness: this.DEFAULT_WALL_THICKNESS,
                height: this.DEFAULT_WALL_HEIGHT
            }
        };

        // Renderizar puntos de snap y el indicador en la capa temporal
        this.wallRenderer.clear(context.layer);
        this.wallRenderer.renderSnapPoints(context.layer, this.wallService.getSnapPoints());
        if (snapPoint) {
            this.wallRenderer.renderSnapIndicator(context.layer, snapPoint);
            console.log('🎯 Snapped to existing point');
        }

        console.log('🏗️ Started wall drawing');
        this.emitEvent('drawing-start', {
            point: startPoint,
            snapped: !!snapPoint
        });
    }

    onMouseMove(context: IToolContext): void {
        if (!this.isActive() || !this.drawingState?.isDrawing) return;

        const snapPoint = this.wallService.getNearestSnapPoint(context.canvasPosition, this.SNAP_THRESHOLD);
        const currentPoint = snapPoint || context.canvasPosition;

        // Actualizar estado
        this.drawingState.currentPoint = currentPoint;
        this.drawingState.snapPoint = snapPoint;
        this.drawingState.previewWall = {
            ...this.drawingState.previewWall,
            endPoint: currentPoint
        };

        // Limpiar y renderizar elementos temporales
        this.wallRenderer.clear(context.layer);
        this.wallRenderer.renderSnapPoints(context.layer, this.wallService.getSnapPoints());
        if (snapPoint) {
            this.wallRenderer.renderSnapIndicator(context.layer, snapPoint);
        }

        // Renderizar preview en la capa temporal
        if (this.drawingState.startPoint) {
            this.wallRenderer.renderPreview(
                context.layer,
                this.drawingState.startPoint,
                currentPoint,
                {
                    thickness: this.DEFAULT_WALL_THICKNESS,
                    showDimensions: true
                }
            );
        }

        this.emitEvent('drawing-update', {
            start: this.drawingState.startPoint,
            current: currentPoint,
            snapped: !!snapPoint,
            preview: this.drawingState.previewWall
        });
    }

    onMouseUp(context: IToolContext): void {
        if (!this.isActive() || !this.drawingState?.isDrawing) return;

        const snapPoint = this.wallService.getNearestSnapPoint(context.canvasPosition, this.SNAP_THRESHOLD);
        const endPoint = snapPoint || context.canvasPosition;

        // Verificar distancia mínima
        if (this.drawingState.startPoint && 
            this.calculateDistance(this.drawingState.startPoint, endPoint) >= 10) {
            
            this.createWall(this.drawingState.startPoint, endPoint, context.mainLayer);
            console.log('✅ Wall created');
        } else {
            console.log('⚠️ Wall too short - minimum length required: 10px');
        }

        // Limpiar capa temporal
        this.wallRenderer.clear(context.layer);
        this.drawingState = null;
        this.emitEvent('drawing-end');
    }

    onKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Escape' && this.drawingState?.isDrawing) {
            console.log('🚫 Drawing cancelled');
            this.cancelDrawing();
        }
    }

    // Wall creation
    private async createWall(startPoint: Point, endPoint: Point, layer: Konva.Layer): Promise<void> {
        try {
            const wall = await this.wallService.createWall({
                startPoint,
                endPoint,
                thickness: this.DEFAULT_WALL_THICKNESS,
                height: this.DEFAULT_WALL_HEIGHT
            });

            // Renderizar el muro en la capa principal
            this.wallRenderer.renderWall(layer, wall, {
                thickness: this.DEFAULT_WALL_THICKNESS,
                color: '#666666'
            });

            const distance = Math.round(this.calculateDistance(startPoint, endPoint));
            console.log(`✨ Wall created - Length: ${distance}px`);
            this.emitEvent('wall-created', wall);
        } catch (error) {
            console.error('❌ Error creating wall:', error);
            this.emitEvent('wall-creation-error', error);
        }
    }

    // Helper methods
    private cancelDrawing(): void {
        if (this.drawingState) {
            this.emitEvent('drawing-cancel', {
                start: this.drawingState.startPoint,
                current: this.drawingState.currentPoint
            });
            this.drawingState = null;
        }
    }

    private calculateDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Plugin lifecycle
    async dispose(): Promise<void> {
        this.cancelDrawing();
        await super.dispose();
    }

    // Protected methods for tool-specific logic
    protected async onActivate(): Promise<void> {
        console.log(`🧱 Wall Tool activated - Press 'Escape' to cancel drawing, or use mouse drag to draw walls`);
        await super.onActivate();
    }

    protected async onDeactivate(): Promise<void> {
        console.log('🧱 Wall Tool deactivated');
        this.cancelDrawing();
        await super.onDeactivate();
    }
} 