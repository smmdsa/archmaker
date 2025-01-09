import Konva from 'konva';
import { Point } from '../../../store/ProjectStore';
import { IRoom } from '../interfaces/IRoom';
import { WallRenderer } from '../../wall-tool/renderers/WallRenderer';

interface RoomRenderOptions {
    wallThickness?: number;
    color?: string;
    showDimensions?: boolean;
    isPreview?: boolean;
}

export class RoomRenderer {
    private wallRenderer: WallRenderer;

    constructor() {
        this.wallRenderer = new WallRenderer();
    }

    clear(layer: Konva.Layer): void {
        layer.destroyChildren();
        layer.draw();
    }

    renderRoom(layer: Konva.Layer, room: IRoom, options: RoomRenderOptions = {}): void {
        const corners = this.calculateCorners(room.startPoint, room.width, room.height);
        
        // Renderizar cada pared usando WallRenderer
        for (let i = 0; i < corners.length; i++) {
            const startPoint = corners[i];
            const endPoint = corners[(i + 1) % corners.length];
            
            this.wallRenderer.renderWall(layer, {
                id: room.walls[i].id,
                startPoint,
                endPoint,
                thickness: options.wallThickness || room.properties.wallThickness,
                height: room.properties.wallHeight,
                properties: room.properties
            }, {
                thickness: options.wallThickness,
                color: options.color,
                showDimensions: options.showDimensions
            });
        }

        layer.batchDraw();
    }

    renderPreview(layer: Konva.Layer, startPoint: Point, currentPoint: Point, options: RoomRenderOptions = {}): void {
        const width = currentPoint.x - startPoint.x;
        const height = currentPoint.y - startPoint.y;
        const corners = this.calculateCorners(startPoint, width, height);

        // Renderizar líneas punteadas para cada pared
        for (let i = 0; i < corners.length; i++) {
            const start = corners[i];
            const end = corners[(i + 1) % corners.length];
            
            this.wallRenderer.renderPreview(layer, start, end, {
                thickness: options.wallThickness,
                showDimensions: options.showDimensions
            });
        }

        layer.batchDraw();
    }

    private calculateCorners(startPoint: Point, width: number, height: number): Point[] {
        return [
            startPoint,
            { x: startPoint.x + width, y: startPoint.y },
            { x: startPoint.x + width, y: startPoint.y + height },
            { x: startPoint.x, y: startPoint.y + height }
        ];
    }
} 