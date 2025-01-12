import { Layer } from 'konva/lib/Layer';
import { Circle } from 'konva/lib/shapes/Circle';
import { WallNode } from '../models/WallNode';
import { Vector2 } from 'three';

interface NodeRendererConfig {
    radius: number;
    color: string;
    opacity?: number;
}

export class NodeRenderer {
    private config: NodeRendererConfig;

    constructor(config: NodeRendererConfig) {
        this.config = {
            radius: config.radius || 5,
            color: config.color || '#666',
            opacity: config.opacity || 1
        };
    }

    createNodeCircle(node: WallNode, layer: Layer): Circle {
        const pos = node.getPosition();

        // Ensure coordinates are valid numbers
        const x = Math.round(pos.x);
        const y = Math.round(pos.y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            console.error('Invalid coordinates detected in NodeRenderer:', { x, y });
            return new Circle({
                x: 0,
                y: 0,
                radius: this.config.radius,
                fill: 'red',
                stroke: 'black',
                strokeWidth: 1
            });
        }

        const circle = new Circle({
            x: x,
            y: y,
            radius: this.config.radius,
            fill: '#fff',
            stroke: this.config.color,
            strokeWidth: 1,
            opacity: this.config.opacity,
            draggable: true,
            name: 'node',
            data: {
                nodeId: node.getId()
            }
        });

        layer.add(circle);
        return circle;
    }

    createPreviewNode(position: Vector2): Circle {
        // Ensure coordinates are valid numbers
        const x = Math.round(position.x);
        const y = Math.round(position.y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            console.error('Invalid coordinates detected in preview node:', { x, y });
            return new Circle({
                x: 0,
                y: 0,
                radius: this.config.radius,
                fill: 'red',
                stroke: 'black',
                strokeWidth: 1
            });
        }

        const circle = new Circle({
            x: x,
            y: y,
            radius: this.config.radius,
            fill: '#fff',
            stroke: this.config.color,
            strokeWidth: 1,
            opacity: this.config.opacity,
            name: 'preview-node'
        });

        return circle;
    }

    updateNodeCircle(circle: Circle, node: WallNode): void {
        const pos = node.getPosition();

        // Ensure coordinates are valid numbers
        const x = Math.round(pos.x);
        const y = Math.round(pos.y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            console.error('Invalid coordinates detected in updateNodeCircle:', { x, y });
            return;
        }

        circle.position({ x, y });
    }

    highlightNode(circle: Circle, highlight: boolean): void {
        circle.fill(highlight ? '#ccc' : '#fff');
    }
} 