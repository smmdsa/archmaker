import { Layer } from 'konva/lib/Layer';
import { Point } from '../../../core/types/geometry';
import { RoomPreviewRenderer } from '../renderers/RoomPreviewRenderer';
import { ILogger } from '../../../core/interfaces/ILogger';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { WallService } from '../../wall-tool/services/WallService';
import { CanvasStore } from '../../../store/CanvasStore';

export enum RoomToolMode {
    IDLE = 'idle',
    DRAWING = 'drawing',
    EDITING = 'editing'
}

interface RoomToolConfig {
    defaultRoomProperties: {
        wallThickness: number;
        wallHeight: number;
    };
    snapThreshold: number;
}

export class RoomToolCore {
    private mode: RoomToolMode = RoomToolMode.IDLE;
    private mainLayer: Layer | null = null;
    private previewLayer: Layer | null = null;
    private startPoint: Point | null = null;
    private currentPoint: Point | null = null;
    private readonly previewRenderer: RoomPreviewRenderer;
    private readonly wallService: WallService;

    constructor(
        private readonly config: RoomToolConfig,
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly canvasStore: CanvasStore
    ) {
        this.previewRenderer = new RoomPreviewRenderer();
        this.wallService = new WallService(eventManager, logger, canvasStore);
    }

    setLayers(mainLayer: Layer, previewLayer: Layer): void {
        this.mainLayer = mainLayer;
        this.previewLayer = previewLayer;
        this.logger.info('Room tool layers set', {
            mainLayerId: mainLayer.id(),
            previewLayerId: previewLayer.id()
        });
    }

    setMode(mode: RoomToolMode): void {
        this.mode = mode;
        this.logger.info('Room tool mode changed', { mode });
    }

    startDrawing(point: Point): void {
        this.startPoint = point;
        this.currentPoint = point;
        this.mode = RoomToolMode.DRAWING;
        this.updatePreview();
    }

    updateDrawing(point: Point): void {
        if (this.mode !== RoomToolMode.DRAWING) return;
        this.currentPoint = point;
        this.updatePreview();
    }

    async finishDrawing(): Promise<void> {
        if (this.mode !== RoomToolMode.DRAWING || !this.startPoint || !this.currentPoint) {
            this.logger.info('Cannot finish drawing - invalid state', {
                mode: this.mode,
                hasStartPoint: !!this.startPoint,
                hasCurrentPoint: !!this.currentPoint
            });
            return;
        }

        const points = this.calculateRoomPoints();
        this.logger.info('Calculated room points', { points });
        
        try {
            // Create walls through WallService
            for (let i = 0; i < points.length; i++) {
                const startPoint = points[i];
                const endPoint = points[(i + 1) % points.length];

                this.logger.info('Creating wall', {
                    index: i,
                    startPoint,
                    endPoint,
                    thickness: this.config.defaultRoomProperties.wallThickness,
                    height: this.config.defaultRoomProperties.wallHeight
                });

                const wall = await this.wallService.createWall({
                    startPoint,
                    endPoint,
                    thickness: this.config.defaultRoomProperties.wallThickness,
                    height: this.config.defaultRoomProperties.wallHeight
                });

                this.logger.info('Wall created successfully', { wallId: wall.id, index: i });
            }

            this.logger.info('Room walls created successfully');
        } catch (error) {
            this.logger.error('Failed to create room walls', error as Error);
        }

        // Reset state
        this.startPoint = null;
        this.currentPoint = null;
        this.mode = RoomToolMode.IDLE;
        this.clearPreview();
        this.logger.info('Room tool state reset');
    }

    private updatePreview(): void {
        if (!this.previewLayer || !this.startPoint || !this.currentPoint) return;

        this.clearPreview();
        const points = this.calculateRoomPoints();
        this.previewRenderer.render(this.previewLayer, points, {
            wallThickness: this.config.defaultRoomProperties.wallThickness,
            showDimensions: true,
            isPreview: true
        });
    }

    private clearPreview(): void {
        if (this.previewLayer) {
            this.previewLayer.destroyChildren();
            this.previewLayer.batchDraw();
        }
    }

    private calculateRoomPoints(): Point[] {
        if (!this.startPoint || !this.currentPoint) return [];

        const x1 = Math.round(this.startPoint.x);
        const y1 = Math.round(this.startPoint.y);
        const x2 = Math.round(this.currentPoint.x);
        const y2 = Math.round(this.currentPoint.y);

        return [
            { x: x1, y: y1 },  // Top-left
            { x: x2, y: y1 },  // Top-right
            { x: x2, y: y2 },  // Bottom-right
            { x: x1, y: y2 }   // Bottom-left
        ];
    }
} 