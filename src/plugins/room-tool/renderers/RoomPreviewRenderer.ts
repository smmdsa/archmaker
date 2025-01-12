import { Layer } from 'konva/lib/Layer';
import { Line } from 'konva/lib/shapes/Line';
import { Text } from 'konva/lib/shapes/Text';
import { Group } from 'konva/lib/Group';
import { Point } from '../../../core/types/geometry';

interface PreviewOptions {
    wallThickness: number;
    showDimensions: boolean;
    isPreview?: boolean;
}

export class RoomPreviewRenderer {
    private readonly PREVIEW_COLOR = '#666666';
    private readonly DIMENSION_OFFSET = 20;
    private readonly DIMENSION_FONT_SIZE = 12;

    render(layer: Layer, points: Point[], options: PreviewOptions): void {
        const group = new Group({
            opacity: options.isPreview ? 0.7 : 1
        });

        // Draw walls
        for (let i = 0; i < points.length; i++) {
            const start = points[i];
            const end = points[(i + 1) % points.length];

            const wall = new Line({
                points: [start.x, start.y, end.x, end.y],
                stroke: this.PREVIEW_COLOR,
                strokeWidth: options.wallThickness,
                lineCap: 'round',
                lineJoin: 'round',
                dash: options.isPreview ? [5, 5] : undefined
            });

            group.add(wall);
        }

        // Add dimensions if needed
        if (options.showDimensions) {
            this.addDimensions(group, points);
        }

        layer.add(group);
        layer.batchDraw();
    }

    private addDimensions(group: Group, points: Point[]): void {
        if (points.length < 4) return;

        const width = Math.abs(points[1].x - points[0].x);
        const height = Math.abs(points[2].y - points[1].y);

        // Convert pixels to meters (assuming 100 pixels = 1 meter)
        const widthInMeters = (width / 100).toFixed(2);
        const heightInMeters = (height / 100).toFixed(2);

        // Width label (top)
        const widthLabel = new Text({
            x: points[0].x + width / 2,
            y: points[0].y - this.DIMENSION_OFFSET,
            text: `${widthInMeters}m`,
            fontSize: this.DIMENSION_FONT_SIZE,
            fill: this.PREVIEW_COLOR,
            align: 'center'
        });
        widthLabel.offsetX(widthLabel.width() / 2);

        // Width label (bottom)
        const widthLabelBottom = new Text({
            x: points[0].x + width / 2,
            y: points[2].y + this.DIMENSION_OFFSET,
            text: `${widthInMeters}m`,
            fontSize: this.DIMENSION_FONT_SIZE,
            fill: this.PREVIEW_COLOR,
            align: 'center'
        });
        widthLabelBottom.offsetX(widthLabelBottom.width() / 2);

        // Height label (left)
        const heightLabel = new Text({
            x: points[0].x - this.DIMENSION_OFFSET,
            y: points[0].y + height / 2,
            text: `${heightInMeters}m`,
            fontSize: this.DIMENSION_FONT_SIZE,
            fill: this.PREVIEW_COLOR,
            align: 'right',
            rotation: -90
        });
        heightLabel.offsetY(heightLabel.width() / 2);

        // Height label (right)
        const heightLabelRight = new Text({
            x: points[1].x + this.DIMENSION_OFFSET,
            y: points[1].y + height / 2,
            text: `${heightInMeters}m`,
            fontSize: this.DIMENSION_FONT_SIZE,
            fill: this.PREVIEW_COLOR,
            align: 'right',
            rotation: 90
        });
        heightLabelRight.offsetY(heightLabelRight.width() / 2);

        group.add(widthLabel, widthLabelBottom, heightLabel, heightLabelRight);
    }

    clear(layer: Layer): void {
        layer.destroyChildren();
        layer.batchDraw();
    }
} 