import { StoreBasedTool } from './StoreBasedTool';
import type { IEventManager } from '../interfaces/IEventManager';
import type { ILogger } from '../interfaces/ILogger';
import type { IConfigManager } from '../interfaces/IConfig';
import type { CanvasEvent } from './interfaces/ITool';
import { Point } from '../types/geometry';
import Konva from 'konva';
import { ProjectStore } from '../../store/ProjectStore';
import { IDrawingProperties, IDrawingToolConfig } from './interfaces/IDrawingProperties';
import { DrawingEvent } from '../events/DrawingEvents';

export interface DrawingState {
    isDrawing: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
    snapPoint: Point | null;
}

export abstract class DrawingTool extends StoreBasedTool {
    protected drawingState: DrawingState = {
        isDrawing: false,
        startPoint: null,
        currentPoint: null,
        snapPoint: null
    };

    protected currentLayer: Konva.Layer | null = null;
    protected keydownHandler: (e: KeyboardEvent) => void;
    protected properties: IDrawingProperties;
    protected config: IDrawingToolConfig;
    protected readonly id: string;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager,
        store: ProjectStore,
        id: string,
        manifest: any
    ) {
        super(eventManager, logger, configManager, store, id, manifest);
        this.id = id;

        // Load config from configManager
        this.config = configManager.getPluginConfig(id)?.drawing || {
            defaultWallHeight: 280,
            defaultWallThickness: 15,
            defaultMaterial: 'default',
            defaultColor: '#cccccc',
            snapThreshold: 20
        };

        // Initialize properties with defaults
        this.properties = {
            wallHeight: this.config.defaultWallHeight,
            wallThickness: this.config.defaultWallThickness,
            material: this.config.defaultMaterial,
            color: this.config.defaultColor
        };

        this.keydownHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.cancelDrawing();
            }
        };
    }

    getProperties(): IDrawingProperties {
        return this.properties;
    }

    setProperties(props: Partial<IDrawingProperties>): void {
        this.properties = { ...this.properties, ...props };
    }

    protected handleKonvaEvent(ev: Konva.KonvaEventObject<MouseEvent>): void {
        const position = {
            x: ev.evt.offsetX,
            y: ev.evt.offsetY
        };

        const stage = ev.target.getStage();
        const layer = ev.target.getLayer();

        if (!stage || !layer) return;

        this.currentLayer = layer;

        const event: CanvasEvent = {
            type: ev.type as 'mousedown' | 'mousemove' | 'mouseup',
            position,
            originalEvent: ev.evt,
            canvas: {
                stage,
                previewLayer: layer,
                mainLayer: layer
            }
        };

        this.onCanvasEvent(event);
    }

    protected abstract onDrawingStart(point: Point): Promise<void>;
    protected abstract onDrawingUpdate(point: Point): Promise<void>;
    protected abstract onDrawingFinish(point: Point): Promise<void>;
    protected abstract clearPreview(): void;

    async startDrawing(point: Point): Promise<void> {
        if (!this.isActive) return;

        this.drawingState.isDrawing = true;
        this.drawingState.startPoint = point;
        this.drawingState.currentPoint = point;

        await this.onDrawingStart(point);
        
        const event: DrawingEvent = {
            type: 'drawing:start',
            toolId: this.id,
            timestamp: Date.now(),
            point
        };
        
        this.eventManager.emit('drawing', event);
    }

    async updateDrawing(point: Point): Promise<void> {
        if (!this.drawingState.isDrawing || !this.drawingState.startPoint) return;

        this.drawingState.currentPoint = point;
        await this.onDrawingUpdate(point);
        
        const event: DrawingEvent = {
            type: 'drawing:update',
            toolId: this.id,
            timestamp: Date.now(),
            startPoint: this.drawingState.startPoint,
            currentPoint: point
        };
        
        this.eventManager.emit('drawing', event);
    }

    async finishDrawing(point: Point): Promise<void> {
        if (!this.drawingState.isDrawing || !this.drawingState.startPoint) return;

        await this.onDrawingFinish(point);
        
        const event: DrawingEvent = {
            type: 'drawing:finish',
            toolId: this.id,
            timestamp: Date.now(),
            startPoint: this.drawingState.startPoint,
            endPoint: point,
            properties: { ...this.properties }
        };
        
        this.eventManager.emit('drawing', event);
        this.resetDrawingState();
    }

    protected async cancelDrawing(): Promise<void> {
        if (this.drawingState.isDrawing) {
            this.clearPreview();
            
            const event: DrawingEvent = {
                type: 'drawing:cancel',
                toolId: this.id,
                timestamp: Date.now()
            };
            
            this.eventManager.emit('drawing', event);
            this.resetDrawingState();
        }
    }

    private resetDrawingState(): void {
        this.drawingState = {
            isDrawing: false,
            startPoint: null,
            currentPoint: null,
            snapPoint: null
        };
    }

    async activate(): Promise<void> {
        await super.activate();
        if (this.currentLayer) {
            this.currentLayer.on('mousedown', this.handleKonvaEvent.bind(this));
            this.currentLayer.on('mousemove', this.handleKonvaEvent.bind(this));
        }
        window.addEventListener('keydown', this.keydownHandler);
        this.logger.info(`${this.id} activated`);
    }

    async deactivate(): Promise<void> {
        await super.deactivate();
        if (this.currentLayer) {
            this.currentLayer.off('mousedown');
            this.currentLayer.off('mousemove');
        }
        window.removeEventListener('keydown', this.keydownHandler);
        await this.cancelDrawing();
        this.logger.info(`${this.id} deactivated`);
    }

    async dispose(): Promise<void> {
        window.removeEventListener('keydown', this.keydownHandler);
        await super.dispose();
    }
} 