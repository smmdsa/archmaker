import Konva from 'konva';
import { ProjectStore } from '../store/ProjectStore';
import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';
import { ToolService } from '../core/tools/services/ToolService';
import { Point } from '../core/types/geometry';
import { DrawingManager } from '../core/drawing/DrawingManager';
import { DrawEvent, DrawEventType } from '../core/events/DrawEvents';

export class Canvas2D {
    private stage: Konva.Stage;
    private mainLayer: Konva.Layer;
    private tempLayer: Konva.Layer;
    private gridLayer: Konva.Layer;
    private unsubscribeStore: (() => void) | null = null;

    constructor(
        containerId: string,
        private readonly store: ProjectStore,
        private readonly toolService: ToolService,
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly drawingManager: DrawingManager
    ) {
        this.logger.info('Initializing Canvas2D component...');
        
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Canvas container not found: ${containerId}`);
        }

        // Inicializar el stage de Konva
        this.stage = new Konva.Stage({
            container: containerId,
            width: container.clientWidth,
            height: container.clientHeight
        });

        // Crear capas
        this.gridLayer = new Konva.Layer();
        this.mainLayer = new Konva.Layer();
        this.tempLayer = new Konva.Layer();

        // Agregar capas al stage
        this.stage.add(this.gridLayer);
        this.stage.add(this.mainLayer);
        this.stage.add(this.tempLayer);

        // Asegurarnos de que el drawingManager esté inicializado
        if (!this.drawingManager) {
            throw new Error('DrawingManager is required but was not provided');
        }

        this.logger.info('Canvas2D layers initialized:', {
            gridLayer: this.gridLayer.id(),
            mainLayer: this.mainLayer.id(),
            tempLayer: this.tempLayer.id()
        });

        // Notificar a las herramientas sobre las capas disponibles
        this.eventManager.emit('canvas:layers', {
            mainLayer: this.mainLayer,
            tempLayer: this.tempLayer,
            gridLayer: this.gridLayer
        });

        this.initialize();
    }

    private initialize(): void {
        // Configurar eventos del canvas
        this.setupEventListeners();

        // Dibujar la cuadrícula inicial
        this.drawGrid();

        // Suscribirse a eventos de dibujo
        this.eventManager.on<DrawEvent>('draw:event', (event) => {
            this.logger.info('Received draw event in Canvas2D:', {
                type: event.type,
                objectType: event.objectType,
                id: event.id,
                hasDrawingManager: !!this.drawingManager,
                mainLayerId: this.mainLayer.id()
            });

            if (!this.drawingManager) {
                this.logger.error('DrawingManager not initialized');
                return;
            }

            switch (event.type) {
                case DrawEventType.CREATE:
                    const drawable = this.drawingManager.getDrawable(event.id);
                    if (drawable) {
                        drawable.render(this.mainLayer);
                        this.mainLayer.batchDraw();
                    } else {
                        this.logger.warn('Drawable not found for CREATE event:', {
                            id: event.id,
                            registeredFactories: this.drawingManager.getRegisteredFactoryTypes()
                        });
                    }
                    break;
                case DrawEventType.UPDATE:
                    const updatableDrawable = this.drawingManager.getDrawable(event.id);
                    if (updatableDrawable) {
                        updatableDrawable.update(event.metadata);
                        this.mainLayer.batchDraw();
                    } else {
                        this.logger.warn('Drawable not found for UPDATE event:', event.id);
                    }
                    break;
                case DrawEventType.DELETE:
                    const deletableDrawable = this.drawingManager.getDrawable(event.id);
                    if (deletableDrawable) {
                        deletableDrawable.destroy();
                        this.mainLayer.batchDraw();
                    } else {
                        this.logger.warn('Drawable not found for DELETE event:', event.id);
                    }
                    break;
            }
        });

        // Manejar redimensionamiento de ventana
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

        // Líneas verticales
        for (let x = 0; x < width; x += spacing) {
            this.gridLayer.add(new Konva.Line({
                points: [x, 0, x, height],
                stroke: '#ddd',
                strokeWidth: 1
            }));
        }

        // Líneas horizontales
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
        if (this.unsubscribeStore) {
            this.unsubscribeStore();
        }
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