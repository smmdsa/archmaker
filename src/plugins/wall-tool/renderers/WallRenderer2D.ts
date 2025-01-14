import Konva from 'konva';
import { Wall, WallDrawingState } from '../types/wall';
import { IWallService } from '../services/IWallService';
import { ILogger } from '../../../core/interfaces/ILogger';
import { Point } from '../../../store/ProjectStore';

export interface WallRenderer2DConfig {
    layer: Konva.Layer;
    strokeColor: string;
    strokeWidth: number;
    selectedColor: string;
    previewColor: string;
    snapDistance: number;
}

export class WallRenderer2D {
    private walls: Map<string, Konva.Line> = new Map();
    private previewLine: Konva.Line | null = null;
    private selectedWallId: string | null = null;

    constructor(
        private readonly service: IWallService,
        private readonly config: WallRenderer2DConfig,
        private readonly logger: ILogger
    ) {}

    public async initialize(): Promise<void> {
        this.logger.info('Initializing WallRenderer2D');
        await this.refreshWalls();
    }

    public async dispose(): Promise<void> {
        this.logger.info('Disposing WallRenderer2D');
        this.clearWalls();
    }

    public async refreshWalls(): Promise<void> {
        // Limpiar paredes existentes
        this.clearWalls();

        // Obtener y renderizar todas las paredes
        const walls = await this.service.getAllWalls();
        for (const wall of walls) {
            await this.renderWall(wall);
        }

        this.config.layer.batchDraw();
    }

    public updatePreview(state: WallDrawingState): void {
        if (!state.isDrawing || !state.startPoint) {
            if (this.previewLine) {
                this.previewLine.destroy();
                this.previewLine = null;
            }
            return;
        }

        const endPoint = state.currentEndPoint || state.startPoint;

        if (!this.previewLine) {
            this.previewLine = new Konva.Line({
                points: [
                    state.startPoint.x,
                    state.startPoint.y,
                    endPoint.x,
                    endPoint.y
                ],
                stroke: this.config.previewColor,
                strokeWidth: this.config.strokeWidth,
                dash: [5, 5],
                listening: false
            });
            this.config.layer.add(this.previewLine);
        } else {
            this.previewLine.points([
                state.startPoint.x,
                state.startPoint.y,
                endPoint.x,
                endPoint.y
            ]);
        }

        this.config.layer.batchDraw();
    }

    public selectWall(wallId: string | null): void {
        // Desseleccionar pared anterior
        if (this.selectedWallId) {
            const previousWall = this.walls.get(this.selectedWallId);
            if (previousWall) {
                previousWall.stroke(this.config.strokeColor);
            }
        }

        this.selectedWallId = wallId;

        // Seleccionar nueva pared
        if (wallId) {
            const wall = this.walls.get(wallId);
            if (wall) {
                wall.stroke(this.config.selectedColor);
            }
        }

        this.config.layer.batchDraw();
    }

    public findWallAtPoint(point: Point, tolerance: number = 5): string | null {
        for (const [id, line] of this.walls) {
            const points = line.points();
            const start = { x: points[0], y: points[1] };
            const end = { x: points[2], y: points[3] };

            if (this.isPointNearLine(point, start, end, tolerance)) {
                return id;
            }
        }
        return null;
    }

    private async renderWall(wall: Wall): Promise<void> {
        const line = new Konva.Line({
            points: [
                wall.startPoint.x,
                wall.startPoint.y,
                wall.endPoint.x,
                wall.endPoint.y
            ],
            stroke: this.config.strokeColor,
            strokeWidth: this.config.strokeWidth,
            hitStrokeWidth: 20 // Área más grande para facilitar la selección
        });

        // Agregar eventos
        line.on('mouseenter', () => {
            document.body.style.cursor = 'pointer';
            if (this.selectedWallId !== wall.id) {
                line.stroke(this.config.selectedColor);
                this.config.layer.batchDraw();
            }
        });

        line.on('mouseleave', () => {
            document.body.style.cursor = 'default';
            if (this.selectedWallId !== wall.id) {
                line.stroke(this.config.strokeColor);
                this.config.layer.batchDraw();
            }
        });

        this.walls.set(wall.id, line);
        this.config.layer.add(line);
    }

    private clearWalls(): void {
        for (const line of this.walls.values()) {
            line.destroy();
        }
        this.walls.clear();
        this.selectedWallId = null;
    }

    private isPointNearLine(point: Point, start: Point, end: Point, tolerance: number): boolean {
        const A = point.x - start.x;
        const B = point.y - start.y;
        const C = end.x - start.x;
        const D = end.y - start.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = start.x;
            yy = start.y;
        } else if (param > 1) {
            xx = end.x;
            yy = end.y;
        } else {
            xx = start.x + param * C;
            yy = start.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;

        return Math.sqrt(dx * dx + dy * dy) <= tolerance;
    }
} 