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
    
    // Add zoom control properties
    private minZoom = 0.1;
    private maxZoom = 5;
    private zoomFactor = 1.1;
    private currentZoom = 1;
    
    // Add panning control
    private isPanning = false;
    private lastPointerPosition: Point | null = null;

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
        this.setupEventListeners();
        this.setupZoomHandling();
        this.setupPanHandling();
        this.drawGrid();
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

    private setupZoomHandling(): void {
        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            
            const oldScale = this.stage.scaleX();
            const pointer = this.stage.getPointerPosition();
            
            if (!pointer) return;
            
            const mousePointTo = {
                x: (pointer.x - this.stage.x()) / oldScale,
                y: (pointer.y - this.stage.y()) / oldScale,
            };
            
            // Calculate new scale
            let newScale = e.evt.deltaY < 0 ? oldScale * this.zoomFactor : oldScale / this.zoomFactor;
            
            // Enforce zoom limits
            newScale = Math.max(this.minZoom, Math.min(this.maxZoom, newScale));
            
            // Skip if no scale change
            if (newScale === oldScale) return;
            
            this.currentZoom = newScale;
            
            // Calculate new position
            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };
            
            // Apply new scale and position
            this.stage.scale({ x: newScale, y: newScale });
            this.stage.position(newPos);
            this.stage.batchDraw();
            
            // Update grid to maintain consistent spacing
            this.drawGrid();
            
            // Emit zoom event for other components
            this.eventManager.emit('canvas:zoom', {
                scale: newScale,
                position: newPos,
                pointer: pointer
            });
        });
    }

    private setupPanHandling(): void {
        // Prevent context menu on right click
        this.stage.container().addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Start panning on right mouse button down
        this.stage.on('mousedown', (e) => {
            // Check if it's right mouse button (button === 2)
            if (e.evt.button === 2) {
                e.evt.preventDefault();
                this.isPanning = true;
                this.lastPointerPosition = this.stage.getPointerPosition();
                // Change cursor to indicate panning
                document.body.style.cursor = 'grabbing';
            }
        });

        // Handle panning movement
        this.stage.on('mousemove', (e) => {
            if (!this.isPanning || !this.lastPointerPosition) return;

            const newPointerPosition = this.stage.getPointerPosition();
            if (!newPointerPosition) return;

            // Calculate the distance moved
            const dx = newPointerPosition.x - this.lastPointerPosition.x;
            const dy = newPointerPosition.y - this.lastPointerPosition.y;

            // Update stage position
            this.stage.position({
                x: this.stage.x() + dx,
                y: this.stage.y() + dy
            });
            this.stage.batchDraw();

            // Update grid
            this.drawGrid();

            // Store new position
            this.lastPointerPosition = newPointerPosition;

            // Emit pan event
            this.eventManager.emit('canvas:pan', {
                position: this.stage.position(),
                delta: { x: dx, y: dy }
            });
        });

        // Stop panning on mouse up or leave
        const stopPanning = () => {
            this.isPanning = false;
            this.lastPointerPosition = null;
            document.body.style.cursor = 'default';
        };

        this.stage.on('mouseup', (e) => {
            if (e.evt.button === 2) {
                stopPanning();
            }
        });

        this.stage.on('mouseleave', stopPanning);
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
        const spacing = 20 * this.currentZoom;

        this.gridLayer.destroyChildren();

        // Adjust grid based on zoom level
        const stageRect = {
            x: -this.stage.x() / this.currentZoom,
            y: -this.stage.y() / this.currentZoom,
            width: width / this.currentZoom,
            height: height / this.currentZoom
        };

        // Vertical lines
        for (let x = Math.floor(stageRect.x / spacing) * spacing; x < stageRect.x + stageRect.width; x += spacing) {
            this.gridLayer.add(new Konva.Line({
                points: [x, stageRect.y, x, stageRect.y + stageRect.height],
                stroke: '#ddd',
                strokeWidth: 1 / this.currentZoom
            }));
        }

        // Horizontal lines
        for (let y = Math.floor(stageRect.y / spacing) * spacing; y < stageRect.y + stageRect.height; y += spacing) {
            this.gridLayer.add(new Konva.Line({
                points: [stageRect.x, y, stageRect.x + stageRect.width, y],
                stroke: '#ddd',
                strokeWidth: 1 / this.currentZoom
            }));
        }

        this.gridLayer.batchDraw();
    }

    private getRelativePointerPosition(): Point {
        const pos = this.stage.getPointerPosition();
        if (!pos) {
            return { x: 0, y: 0 };
        }

        // Get the current transform of the stage
        const transform = {
            x: this.stage.x(),
            y: this.stage.y(),
            scale: this.stage.scaleX()
        };

        // Calculate the actual position in the scaled and transformed space
        return {
            x: (pos.x - transform.x) / transform.scale,
            y: (pos.y - transform.y) / transform.scale
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

    getZoom(): number {
        return this.currentZoom;
    }

    setZoom(zoom: number, center?: Point): void {
        const oldScale = this.stage.scaleX();
        let newScale = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        
        if (newScale === oldScale) return;
        
        const pointer = center || {
            x: this.stage.width() / 2,
            y: this.stage.height() / 2
        };
        
        const mousePointTo = {
            x: (pointer.x - this.stage.x()) / oldScale,
            y: (pointer.y - this.stage.y()) / oldScale,
        };
        
        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        
        this.currentZoom = newScale;
        this.stage.scale({ x: newScale, y: newScale });
        this.stage.position(newPos);
        this.stage.batchDraw();
        
        this.drawGrid();
        
        this.eventManager.emit('canvas:zoom', {
            scale: newScale,
            position: newPos,
            pointer: pointer
        });
    }
} 