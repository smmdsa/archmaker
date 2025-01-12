import { DrawingTool } from '../../core/tools/DrawingTool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { WallToolCore } from './core/WallToolCore';
import { WallToolMode } from './core/WallToolState';
import { CommandManager } from './commands/CommandManager';
import { Layer } from 'konva/lib/Layer';
import { KonvaEventObject } from 'konva/lib/Node';
import { Point } from '../../core/types/geometry';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import { ProjectStore } from '../../store/ProjectStore';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { CreateWallCommand } from './commands/WallCommands';
import { Vector2 } from 'three';
import { Stage } from 'konva/lib/Stage';
import { CanvasStore } from '../../store/CanvasStore';

interface CanvasLayers {
    mainLayer: Layer;
    tempLayer: Layer;
    gridLayer: Layer;
}

const toolManifest = {
    id: 'wall-tool',
    name: 'Wall Tool',
    version: '1.0.0',
    icon: '🧱',
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
    icon: '🧱',
    tooltip: 'Draw walls (W)',
    section: 'draw',
    order: 1,
    shortcut: 'w'
})
export class WallTool extends DrawingTool {
    private readonly core: WallToolCore;
    private readonly commandManager: CommandManager;
    private mainLayer: Layer | null = null;
    private previewLayer: Layer | null = null;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager,
        store: ProjectStore,
        id: string = 'wall-tool',
        manifest = toolManifest
    ) {
        super(eventManager, logger, configManager, store, id, manifest);

        // Get singleton instance of CanvasStore
        const canvasStore = CanvasStore.getInstance(eventManager, logger);

        this.core = new WallToolCore({
            defaultWallProperties: {
                thickness: 10,
                height: 280
            },
            snapThreshold: 20,
            nodeRadius: 5
        }, canvasStore, eventManager);

        this.commandManager = new CommandManager();

        // Subscribe to canvas layers
        this.eventManager.on<CanvasLayers>('canvas:layers', (layers) => {
            this.logger.info('Received canvas layers in WallTool');
            this.setLayers(layers.mainLayer, layers.tempLayer);
            canvasStore.setLayers(layers);
        });

        // Request layers if canvas is already initialized
        this.eventManager.emit('canvas:request-layers', null);

        // Log initialization
        this.logger.info('WallTool initialized');
    }

    // Tool lifecycle methods
    async activate(): Promise<void> {
        await super.activate();
        this.logger.info('WallTool activated');
        
        // Request layers again on activation to ensure we have them
        if (!this.mainLayer || !this.previewLayer) {
            this.logger.info('Requesting canvas layers on activation');
            this.eventManager.emit('canvas:request-layers', null);
        }
        
        this.core.setMode(WallToolMode.IDLE);
    }

    async deactivate(): Promise<void> {
        await super.deactivate();
        this.logger.info('WallTool deactivated');
        this.core.setMode(WallToolMode.IDLE);
    }

    // Canvas setup
    setLayers(mainLayer: Layer, previewLayer: Layer): void {
        this.logger.info('Setting layers for WallTool', {
            mainLayerId: mainLayer.id(),
            previewLayerId: previewLayer.id()
        });
        this.mainLayer = mainLayer;
        this.previewLayer = previewLayer;
        this.core.setLayers(mainLayer, previewLayer);
    }

    // Event handlers
    handleMouseDown(e: KonvaEventObject<MouseEvent>): void {
        if (!this.mainLayer || !this.previewLayer) {
            this.logger.warn('Layers not set for WallTool');
            return;
        }
        this.logger.debug('Mouse down event in WallTool', { position: e.target.getStage()?.getPointerPosition() });
        this.core.handleMouseDown(e);
    }

    handleMouseMove(e: KonvaEventObject<MouseEvent>): void {
        if (!this.mainLayer || !this.previewLayer) return;
        this.core.handleMouseMove(e);
    }

    handleMouseUp(e: KonvaEventObject<MouseEvent>): void {
        if (!this.mainLayer || !this.previewLayer) return;
        this.core.handleMouseUp(e);
    }

    // Helper method to snap coordinates to pixel grid
    private snapToGrid(point: Point): { x: number, y: number } {
        return {
            x: Math.round(Number(point.x)),
            y: Math.round(Number(point.y))
        };
    }

    // Required DrawingTool implementations
    protected async onDrawingStart(point: Point): Promise<void> {
        this.logger.info('Starting wall drawing', { point });
        if (!this.mainLayer || !this.previewLayer) {
            this.logger.warn('Layers not set for drawing start');
            return;
        }

        const stage = this.mainLayer.getStage();
        if (!stage) {
            this.logger.error('No stage available for drawing');
            return;
        }

        // Snap coordinates to pixel grid
        const { x, y } = this.snapToGrid(point);
        this.logger.debug('Snapped coordinates', { original: point, snapped: { x, y } });

        stage.setPointersPositions({ x, y });

        const konvaEvent = {
            target: stage,
            type: 'mousedown',
            evt: new MouseEvent('mousedown', {
                clientX: x,
                clientY: y
            }),
            pointerId: 1,
            currentTarget: stage,
            cancelBubble: false,
        } as unknown as KonvaEventObject<MouseEvent>;

        this.core.handleMouseDown(konvaEvent);
    }

    protected async onDrawingUpdate(point: Point): Promise<void> {
        if (!this.mainLayer || !this.previewLayer) return;
        
        const stage = this.mainLayer.getStage();
        if (!stage) {
            this.logger.error('No stage available for drawing');
            return;
        }

        // Snap coordinates to pixel grid
        const { x, y } = this.snapToGrid(point);

        stage.setPointersPositions({ x, y });

        const konvaEvent = {
            target: stage,
            type: 'mousemove',
            evt: new MouseEvent('mousemove', {
                clientX: x,
                clientY: y
            }),
            pointerId: 1,
            currentTarget: stage,
            cancelBubble: false,
        } as unknown as KonvaEventObject<MouseEvent>;

        this.core.handleMouseMove(konvaEvent);
    }

    protected async onDrawingFinish(point: Point): Promise<void> {
        this.logger.info('Finishing wall drawing', { point });
        if (!this.mainLayer || !this.previewLayer) return;

        const stage = this.mainLayer.getStage();
        if (!stage) {
            this.logger.error('No stage available for drawing');
            return;
        }

        // Snap coordinates to pixel grid
        const { x, y } = this.snapToGrid(point);

        stage.setPointersPositions({ x, y });

        const konvaEvent = {
            target: stage,
            type: 'mouseup',
            evt: new MouseEvent('mouseup', {
                clientX: x,
                clientY: y
            }),
            pointerId: 1,
            currentTarget: stage,
            cancelBubble: false,
        } as unknown as KonvaEventObject<MouseEvent>;

        this.core.handleMouseUp(konvaEvent);
    }

    protected clearPreview(): void {
        if (this.previewLayer) {
            this.previewLayer.destroyChildren();
            this.previewLayer.batchDraw();
        }
    }

    public async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!event.position) {
            this.logger.warn('Canvas event without position');
            return;
        }

        this.logger.debug('Canvas event in WallTool', { type: event.type, position: event.position });

        switch (event.type) {
            case 'mousedown':
                await this.onDrawingStart(event.position);
                break;
            case 'mousemove':
                await this.onDrawingUpdate(event.position);
                break;
            case 'mouseup':
                await this.onDrawingFinish(event.position);
                break;
        }
    }

    // Keyboard shortcuts
    private registerKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    if (e.shiftKey) {
                        this.commandManager.redo();
                    } else {
                        this.commandManager.undo();
                    }
                    e.preventDefault();
                }
            }

            if (e.key === 'Escape') {
                this.core.setMode(WallToolMode.IDLE);
                e.preventDefault();
            }
        });
    }

    // Tool state
    getMode(): WallToolMode {
        return this.core.getMode();
    }

    // Command history
    canUndo(): boolean {
        return this.commandManager.canUndo();
    }

    canRedo(): boolean {
        return this.commandManager.canRedo();
    }

    undo(): void {
        this.commandManager.undo();
    }

    redo(): void {
        this.commandManager.redo();
    }

    // Cleanup
    async dispose(): Promise<void> {
        this.logger.info('Disposing WallTool');
        this.commandManager.clear();
        if (this.mainLayer) {
            this.mainLayer.destroyChildren();
        }
        if (this.previewLayer) {
            this.previewLayer.destroyChildren();
        }
        await super.dispose();
    }
}
