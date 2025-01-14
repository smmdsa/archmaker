import { Layer } from 'konva/lib/Layer';
import { Point } from '../../../core/types/geometry';
import { Line } from 'konva/lib/shapes/Line';
import { Text } from 'konva/lib/shapes/Text';
import { Group } from 'konva/lib/Group';

interface RenderOptions {
    wallThickness: number;
    showDimensions: boolean;
    isPreview?: boolean;
}

export class RoomRenderer {
    private readonly PREVIEW_COLOR = '#666666';
    private readonly DIMENSION_OFFSET = 20;
    private readonly DIMENSION_FONT_SIZE = 12;

    renderPreview(layer: Layer, startPoint: Point, endPoint: Point, options: RenderOptions): void {
        const width = Math.abs(endPoint.x - startPoint.x);
        const height = Math.abs(endPoint.y - startPoint.y);

        // Calcular los puntos de las esquinas
        const points = [
            startPoint,
            { x: startPoint.x + width, y: startPoint.y },
            { x: startPoint.x + width, y: startPoint.y + height },
            { x: startPoint.x, y: startPoint.y + height }
        ];

        // Crear el grupo para la preview
        const group = new Group({
            opacity: options.isPreview ? 0.7 : 1
        });

        // Renderizar las paredes
        for (let i = 0; i < 4; i++) {
            const line = new Line({
                points: [
                    points[i].x, points[i].y,
                    points[(i + 1) % 4].x, points[(i + 1) % 4].y
                ],
                stroke: this.PREVIEW_COLOR,
                strokeWidth: options.wallThickness,
                lineCap: 'round',
                lineJoin: 'round'
            });
            group.add(line);
        }

        // Renderizar dimensiones si es necesario
        if (options.showDimensions) {
            this.renderDimensions(group, startPoint, width, height);
        }

        layer.add(group);
        layer.batchDraw();
    }

    private renderDimensions(group: Group, startPoint: Point, width: number, height: number): void {
        // Etiqueta de ancho (abajo)
        const widthLabel = new Text({
            x: startPoint.x + width / 2,
            y: startPoint.y + height + this.DIMENSION_OFFSET,
            text: `${Math.round(width)}px`,
            fontSize: this.DIMENSION_FONT_SIZE,
            fill: this.PREVIEW_COLOR,
            align: 'center'
        });
        widthLabel.offsetX(widthLabel.width() / 2);

        // Etiqueta de ancho (arriba)
        const widthLabelTop = new Text({
            x: startPoint.x + width / 2,
            y: startPoint.y - this.DIMENSION_OFFSET - this.DIMENSION_FONT_SIZE,
            text: `${Math.round(width)}px`,
            fontSize: this.DIMENSION_FONT_SIZE,
            fill: this.PREVIEW_COLOR,
            align: 'center'
        });
        widthLabelTop.offsetX(widthLabelTop.width() / 2);

        // Etiqueta de alto (izquierda)
        const heightLabel = new Text({
            x: startPoint.x - this.DIMENSION_OFFSET,
            y: startPoint.y + height / 2,
            text: `${Math.round(height)}px`,
            fontSize: this.DIMENSION_FONT_SIZE,
            fill: this.PREVIEW_COLOR,
            align: 'right',
            rotation: -90
        });
        heightLabel.offsetY(heightLabel.width() / 2);

        // Etiqueta de alto (derecha)
        const heightLabelRight = new Text({
            x: startPoint.x + width + this.DIMENSION_OFFSET + this.DIMENSION_FONT_SIZE,
            y: startPoint.y + height / 2,
            text: `${Math.round(height)}px`,
            fontSize: this.DIMENSION_FONT_SIZE,
            fill: this.PREVIEW_COLOR,
            align: 'right',
            rotation: 90
        });
        heightLabelRight.offsetY(heightLabelRight.width() / 2);

        group.add(widthLabel, widthLabelTop, heightLabel, heightLabelRight);
    }

    clear(layer: Layer): void {
        layer.destroyChildren();
        layer.batchDraw();
    }
} 