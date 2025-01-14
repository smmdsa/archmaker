import { Layer } from 'konva/lib/Layer';
import { Line } from 'konva/lib/shapes/Line';
import { Group } from 'konva/lib/Group';
import { Point } from '../../../core/types/geometry';

interface RenderOptions {
    wallThickness: number;
    isPreview?: boolean;
    color?: string;
}

export class RoomRenderer2D {
    private readonly DEFAULT_COLOR = '#666666';
    private readonly PREVIEW_COLOR = '#4a90e2';

    render(layer: Layer, points: Point[], options: RenderOptions): void {
        const group = new Group({
            opacity: options.isPreview ? 0.7 : 1
        });

        // Create preview walls
        for (let i = 0; i < points.length; i++) {
            const start = points[i];
            const end = points[(i + 1) % points.length];

            const wall = new Line({
                points: [start.x, start.y, end.x, end.y],
                stroke: options.color || (options.isPreview ? this.PREVIEW_COLOR : this.DEFAULT_COLOR),
                strokeWidth: options.wallThickness,
                lineCap: 'round',
                lineJoin: 'round',
                dash: options.isPreview ? [5, 5] : undefined
            });

            group.add(wall);
        }

        layer.add(group);
        layer.batchDraw();
    }

    clear(layer: Layer): void {
        layer.destroyChildren();
        layer.batchDraw();
    }
} 