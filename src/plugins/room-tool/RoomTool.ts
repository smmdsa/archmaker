import { DrawingTool } from '../../core/tools/DrawingTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { UIComponentManifest } from '../../core/interfaces/IUIRegion';
import { Point } from '../../core/types/geometry';
import { ProjectStore } from '../../store/ProjectStore';
import { RoomToolCore } from './core/RoomToolCore';
import { Layer } from 'konva/lib/Layer';
import { CanvasStore } from '../../store/CanvasStore';

const toolManifest = {
    id: 'room-tool',
    name: 'Square Room',
    version: '1.0.0',
    icon: '⬜',
    tooltip: 'Draw square room',
    section: 'draw',
    order: 2,
    shortcut: 'r'
};

interface CanvasLayers {
    mainLayer: Layer;
    tempLayer: Layer;
    gridLayer: Layer;
}

@ToolPlugin({
    id: 'room-tool',
    name: 'Square Room',
    version: '1.0.0',
    description: 'Tool for drawing square/rectangular rooms',
    icon: '⬜',
    tooltip: 'Draw square room',
    section: 'draw',
    order: 2,
    shortcut: 'r'
})
export class RoomTool extends DrawingTool {
    private readonly core: RoomToolCore;
    private mainLayer: Layer | null = null;
    private previewLayer: Layer | null = null;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager,
        store: ProjectStore
    ) {
        super(eventManager, logger, configManager, store, 'room-tool', toolManifest);
        
        // Get singleton instance of CanvasStore
        const canvasStore = CanvasStore.getInstance(eventManager, logger);

        this.core = new RoomToolCore(
            {
                defaultRoomProperties: {
                    wallThickness: 10,
                    wallHeight: 280
                },
                snapThreshold: 20
            },
            eventManager,
            logger,
            canvasStore
        );

        // Subscribe to canvas layers
        this.eventManager.on<CanvasLayers>('canvas:layers', (layers) => {
            this.logger.info('Received canvas layers in RoomTool');
            this.setLayers(layers.mainLayer, layers.tempLayer);
            canvasStore.setLayers(layers);
        });

        // Request layers if canvas is already initialized
        this.eventManager.emit('canvas:request-layers', null);

        // Subscribe to wall events for logging
        this.eventManager.on<{ wall: any }>('wall:created', (event) => {
            this.logger.info('Wall created in room tool context', { wall: event.wall });
        });

        this.logger.info('RoomTool initialized');
    }

    protected clearPreview(): void {
        if (this.previewLayer) {
            this.previewLayer.destroyChildren();
            this.previewLayer.batchDraw();
        }
    }

    private setLayers(mainLayer: Layer, tempLayer: Layer): void {
        this.logger.info('Setting layers in RoomTool', {
            mainLayerId: mainLayer.id(),
            tempLayerId: tempLayer.id()
        });
        this.mainLayer = mainLayer;
        this.previewLayer = tempLayer;
        this.core.setLayers(mainLayer, tempLayer);
    }

    protected async onDrawingStart(point: Point): Promise<void> {
        this.logger.info('Starting room drawing', { point });
        this.core.startDrawing(point);
    }

    protected async onDrawingUpdate(point: Point): Promise<void> {
        this.core.updateDrawing(point);
    }

    protected async onDrawingFinish(point: Point): Promise<void> {
        this.logger.info('Finishing room drawing', { point });
        await this.core.finishDrawing();
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (event.type === 'mousemove' && !event.position) return;

        switch (event.type) {
            case 'mousedown':
                if (event.position) {
                    await this.startDrawing(event.position);
                }
                break;
            case 'mousemove':
                if (event.position) {
                    await this.updateDrawing(event.position);
                }
                break;
            case 'mouseup':
                if (event.position) {
                    await this.finishDrawing(event.position);
                }
                break;
        }
    }

    getUIComponents(): UIComponentManifest[] {
        return [{
            id: 'room-tool-button',
            region: 'toolbar',
            order: 2,
            template: `
                <button class="toolbar-button" title="${toolManifest.tooltip} (${toolManifest.shortcut?.toUpperCase()})">${toolManifest.icon}</button>
            `,
            events: {
                click: () => this.activate()
            }
        }];
    }
} 