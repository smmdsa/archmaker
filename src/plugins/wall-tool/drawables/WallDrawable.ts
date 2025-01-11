import { v4 as uuidv4 } from 'uuid';
import Konva from 'konva';
import { IDrawable, IDrawableMetadata } from '../../../core/interfaces/IDrawable';
import { Point } from '../../../core/types/geometry';

interface WallMetadata extends IDrawableMetadata {
    type: 'wall';
    id?: string;
    startPoint: Point;
    endPoint: Point;
    thickness: number;
    height: number;
    color?: string;
}

export class WallDrawable implements IDrawable {
    public readonly id: string;
    public readonly type: string = 'wall';
    private shape: Konva.Line | null = null;
    private startGizmo: Konva.Circle | null = null;
    private endGizmo: Konva.Circle | null = null;

    constructor(
        public metadata: WallMetadata,
        private readonly onGizmoMove?: (id: string, point: Point, isStart: boolean) => void
    ) {
        console.info('Constructing WallDrawable with metadata:', metadata);
        this.id = metadata.id || uuidv4();
    }

    render(layer: Konva.Layer): void {
        console.info('Rendering wall:', {
            id: this.id,
            metadata: this.metadata
        });

        // Crear la línea principal de la pared
        this.shape = new Konva.Line({
            points: [
                this.metadata.startPoint.x,
                this.metadata.startPoint.y,
                this.metadata.endPoint.x,
                this.metadata.endPoint.y
            ],
            stroke: this.metadata.color || '#333333',
            strokeWidth: this.metadata.thickness,
            lineCap: 'round',
            lineJoin: 'round',
            name: `wall-${this.id}`
        });

        // Crear gizmos para los puntos de inicio y fin
        this.startGizmo = new Konva.Circle({
            x: this.metadata.startPoint.x,
            y: this.metadata.startPoint.y,
            radius: 8,
            fill: '#4CAF50',
            stroke: '#45a049',
            strokeWidth: 2,
            draggable: true,
            name: `wall-start-gizmo-${this.id}`
        });

        this.endGizmo = new Konva.Circle({
            x: this.metadata.endPoint.x,
            y: this.metadata.endPoint.y,
            radius: 8,
            fill: '#4CAF50',
            stroke: '#45a049',
            strokeWidth: 2,
            draggable: true,
            name: `wall-end-gizmo-${this.id}`
        });

        // Configurar eventos de arrastre para los gizmos
        this.setupGizmoDragEvents(this.startGizmo, true);
        this.setupGizmoDragEvents(this.endGizmo, false);

        // Agregar elementos a la capa
        layer.add(this.shape);
        layer.add(this.startGizmo);
        layer.add(this.endGizmo);

        console.info('Wall rendered successfully:', {
            id: this.id,
            layer: layer.id()
        });
    }

    private setupGizmoDragEvents(gizmo: Konva.Circle, isStart: boolean): void {
        gizmo.on('dragmove', () => {
            const point = { x: gizmo.x(), y: gizmo.y() };
            
            // Actualizar la línea mientras se arrastra
            if (this.shape) {
                const points = [...this.shape.points()];
                if (isStart) {
                    points[0] = point.x;
                    points[1] = point.y;
                } else {
                    points[2] = point.x;
                    points[3] = point.y;
                }
                this.shape.points(points);
            }

            // Notificar el movimiento
            if (this.onGizmoMove) {
                this.onGizmoMove(this.id, point, isStart);
            }
        });

        // Efectos visuales al pasar el mouse
        gizmo.on('mouseover', () => {
            gizmo.fill('#45a049');
            gizmo.scale({ x: 1.2, y: 1.2 });
            gizmo.getLayer()?.batchDraw();
        });

        gizmo.on('mouseout', () => {
            gizmo.fill('#4CAF50');
            gizmo.scale({ x: 1, y: 1 });
            gizmo.getLayer()?.batchDraw();
        });
    }

    update(metadata: WallMetadata): void {
        console.info('Updating wall:', {
            id: this.id,
            currentMetadata: this.metadata,
            newMetadata: metadata
        });

        this.metadata = metadata;

        if (this.shape) {
            this.shape.points([
                metadata.startPoint.x,
                metadata.startPoint.y,
                metadata.endPoint.x,
                metadata.endPoint.y
            ]);
            this.shape.strokeWidth(metadata.thickness);
            if (metadata.color) {
                this.shape.stroke(metadata.color);
            }
        }

        if (this.startGizmo) {
            this.startGizmo.position({
                x: metadata.startPoint.x,
                y: metadata.startPoint.y
            });
        }

        if (this.endGizmo) {
            this.endGizmo.position({
                x: metadata.endPoint.x,
                y: metadata.endPoint.y
            });
        }

        // Redibujar la capa
        this.shape?.getLayer()?.batchDraw();
    }

    destroy(): void {
        console.info('Destroying wall:', this.id);
        this.shape?.destroy();
        this.startGizmo?.destroy();
        this.endGizmo?.destroy();
        
        // Redibujar la capa
        this.shape?.getLayer()?.batchDraw();
    }
} 