import Konva from 'konva';
import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';
import { Point } from '../core/types/geometry';
import { CanvasStore } from '../store/CanvasStore';

export class Canvas2D {
    private stage: Konva.Stage;
    private mainLayer: Konva.Layer;
    private tempLayer: Konva.Layer;
    private gridLayer: Konva.Layer;
    private readonly canvasStore: CanvasStore;

    constructor(
        containerId: string,
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.logger.info('Initializing Canvas2D component...');
        
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Canvas container not found: ${containerId}`);
        }

        // Initialize Konva stage
        this.stage = new Konva.Stage({
            container: containerId,
            width: container.clientWidth,
            height: container.clientHeight
        });

        // Create layers
        this.gridLayer = new Konva.Layer({ id: 'grid-layer' });
        this.mainLayer = new Konva.Layer({ id: 'main-layer' });
        this.tempLayer = new Konva.Layer({ id: 'temp-layer' });

        // Add layers to stage
        this.stage.add(this.gridLayer);
        this.stage.add(this.mainLayer);
        this.stage.add(this.tempLayer);

        // Initialize CanvasStore
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
        
        // Set layers in CanvasStore
        this.canvasStore.setLayers({
            mainLayer: this.mainLayer,
            tempLayer: this.tempLayer,
            gridLayer: this.gridLayer
        });

        this.logger.info('Canvas2D layers initialized:', {
            gridLayer: this.gridLayer.id(),
            mainLayer: this.mainLayer.id(),
            tempLayer: this.tempLayer.id()
        });

        // Notify tools about available layers
        this.eventManager.emit('canvas:layers', {
            mainLayer: this.mainLayer,
            tempLayer: this.tempLayer,
            gridLayer: this.gridLayer
        });

        this.initialize();
    }

    private initialize(): void {
        // Set up canvas events
        this.setupEventListeners();

        // Draw initial grid
        this.drawGrid();

        // Handle window resizing
        window.addEventListener('resize', this.handleResize);
    }

    private setupEventListeners(): void {
        this.stage.on('mousedown touchstart', (e) => {
            const pos = this.getRelativePointerPosition();
            this.eventManager.emit('canvas:event', {
                type: 'mousedown',
                position: pos,
                originalEvent: e
            });
        });

        this.stage.on('mousemove touchmove', (e) => {
            const pos = this.getRelativePointerPosition();
            this.eventManager.emit('canvas:event', {
                type: 'mousemove',
                position: pos,
                originalEvent: e
            });
        });

        this.stage.on('mouseup touchend', (e) => {
            const pos = this.getRelativePointerPosition();
            this.eventManager.emit('canvas:event', {
                type: 'mouseup',
                position: pos,
                originalEvent: e
            });
        });
    }

    private handleResize = (): void => {
        const container = this.stage.container();
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.stage.width(width);
        this.stage.height(height);
        this.drawGrid();
    };

    private drawGrid(): void {
        const width = this.stage.width();
        const height = this.stage.height();
        const spacing = 20;

        this.gridLayer.destroyChildren();

        // Vertical lines
        for (let x = 0; x < width; x += spacing) {
            this.gridLayer.add(new Konva.Line({
                points: [x, 0, x, height],
                stroke: '#ddd',
                strokeWidth: 1
            }));
        }

        // Horizontal lines
        for (let y = 0; y < height; y += spacing) {
            this.gridLayer.add(new Konva.Line({
                points: [0, y, width, y],
                stroke: '#ddd',
                strokeWidth: 1
            }));
        }

        this.gridLayer.batchDraw();
    }

    private getRelativePointerPosition(): Point {
        const pos = this.stage.getPointerPosition();
        if (!pos) {
            return { x: 0, y: 0 };
        }

        return {
            x: pos.x,
            y: pos.y
        };
    }

    dispose(): void {
        window.removeEventListener('resize', this.handleResize);
        this.stage.destroy();
    }

    getStage(): Konva.Stage {
        return this.stage;
    }

    getMainLayer(): Konva.Layer {
        return this.mainLayer;
    }

    getTempLayer(): Konva.Layer {
        return this.tempLayer;
    }
} 