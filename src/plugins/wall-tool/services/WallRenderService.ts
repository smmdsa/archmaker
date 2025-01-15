import { Point } from '../../../core/types/geometry';
import { NodeObject } from '../objects/NodeObject';
import { WallObject } from '../objects/WallObject';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { Line } from 'konva/lib/shapes/Line';
import { Layer } from 'konva/lib/Layer';

export class WallRenderService {
    private previewLayer: Layer;
    private previewLine: Line | null = null;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        layer: Layer
    ) {
        this.previewLayer = layer;
    }

    // Preview rendering
    startPreview(startPoint: Point): void {
        if (this.previewLine) {
            this.cleanupPreview();
        }

        this.previewLine = new Line({
            points: [startPoint.x, startPoint.y, startPoint.x, startPoint.y],
            stroke: '#2563eb',
            strokeWidth: 2,
            dash: [5, 5],
            listening: false
        });

        this.previewLayer.add(this.previewLine);
        this.previewLayer.batchDraw();
    }

    updatePreview(startPoint: Point, endPoint: Point): void {
        if (!this.previewLine) return;

        this.previewLine.points([
            startPoint.x, startPoint.y,
            endPoint.x, endPoint.y
        ]);
        this.previewLayer.batchDraw();
    }

    cleanupPreview(): void {
        if (this.previewLine) {
            this.previewLine.destroy();
            this.previewLine = null;
            this.previewLayer.batchDraw();
        }
    }

    // Wall rendering
    renderWall(wall: WallObject): void {
        const line = new Line({
            points: [
                wall.startNode.position.x,
                wall.startNode.position.y,
                wall.endNode.position.x,
                wall.endNode.position.y
            ],
            stroke: wall.isSelected() ? '#2563eb' : '#666666',
            strokeWidth: wall.isSelected() ? 3 : 2,
            listening: true
        });

        wall.setShape(line);
        this.previewLayer.add(line);
        this.previewLayer.batchDraw();
    }

    updateWallRender(wall: WallObject): void {
        const shape = wall.getShape();
        if (!shape) return;

        shape.points([
            wall.startNode.position.x,
            wall.startNode.position.y,
            wall.endNode.position.x,
            wall.endNode.position.y
        ]);

        shape.stroke(wall.isSelected() ? '#2563eb' : '#666666');
        shape.strokeWidth(wall.isSelected() ? 3 : 2);
        this.previewLayer.batchDraw();
    }

    // Node rendering
    renderNode(node: NodeObject): void {
        const circle = new Line({
            points: [node.position.x, node.position.y],
            stroke: node.isSelected() ? '#2563eb' : '#666666',
            strokeWidth: node.isSelected() ? 6 : 4,
            lineCap: 'round',
            lineJoin: 'round',
            listening: true
        });

        node.setShape(circle);
        this.previewLayer.add(circle);
        this.previewLayer.batchDraw();
    }

    updateNodeRender(node: NodeObject): void {
        const shape = node.getShape();
        if (!shape) return;

        shape.points([node.position.x, node.position.y]);
        shape.stroke(node.isSelected() ? '#2563eb' : '#666666');
        shape.strokeWidth(node.isSelected() ? 6 : 4);
        this.previewLayer.batchDraw();
    }

    // Highlight effects
    highlightWall(wall: WallObject, highlight: boolean = true): void {
        const shape = wall.getShape();
        if (!shape) return;

        if (highlight) {
            shape.stroke('#2563eb');
            shape.strokeWidth(3);
        } else {
            shape.stroke('#666666');
            shape.strokeWidth(2);
        }
        this.previewLayer.batchDraw();
    }

    highlightNode(node: NodeObject, highlight: boolean = true): void {
        const shape = node.getShape();
        if (!shape) return;

        if (highlight) {
            shape.stroke('#2563eb');
            shape.strokeWidth(6);
        } else {
            shape.stroke('#666666');
            shape.strokeWidth(4);
        }
        this.previewLayer.batchDraw();
    }

    // Cleanup
    dispose(): void {
        this.cleanupPreview();
    }
} 