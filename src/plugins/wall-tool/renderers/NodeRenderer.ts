import { Layer } from 'konva/lib/Layer';
import { Circle } from 'konva/lib/shapes/Circle';
import { WallNode } from '../models/WallNode';
import { Vector2 } from 'three';

export class NodeRenderer {
    static createNodeCircle(node: WallNode, radius: number, layer: Layer): Circle {
        const pos = node.getPosition();

        // Ensure coordinates are valid numbers
        const x = Math.round(pos.x);
        const y = Math.round(pos.y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            console.error('Invalid coordinates detected in NodeRenderer:', { x, y });
            return new Circle({
                x: 0,
                y: 0,
                radius: radius,
                fill: 'red',
                stroke: 'black',
                strokeWidth: 1
            });
        }

        const circle = new Circle({
            x: x,
            y: y,
            radius: radius,
            fill: '#fff',
            stroke: '#666',
            strokeWidth: 1,
            draggable: true,
            name: 'node',
            data: {
                nodeId: node.getId()
            }
        });

        layer.add(circle);
        return circle;
    }

    static createPreviewCircle(position: Vector2, radius: number, layer: Layer, highlight: boolean = false): Circle {
        // Ensure coordinates are valid numbers
        const x = Math.round(position.x);
        const y = Math.round(position.y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            console.error('Invalid coordinates detected in preview circle:', { x, y });
            return new Circle({
                x: 0,
                y: 0,
                radius: radius,
                fill: 'red',
                stroke: 'black',
                strokeWidth: 1
            });
        }

        const circle = new Circle({
            x: x,
            y: y,
            radius: radius,
            fill: highlight ? '#ccc' : '#fff',
            stroke: '#666',
            strokeWidth: 1,
            opacity: 0.5,
            name: 'preview-node'
        });

        layer.add(circle);
        return circle;
    }

    static updateNodeCircle(circle: Circle, node: WallNode): void {
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

    static updatePreviewCircle(circle: Circle, position: Vector2): void {
        // Ensure coordinates are valid numbers
        const x = Math.round(position.x);
        const y = Math.round(position.y);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            console.error('Invalid coordinates detected in updatePreviewCircle:', { x, y });
            return;
        }

        circle.position({ x, y });
    }

    static highlightNode(circle: Circle, highlight: boolean): void {
        circle.fill(highlight ? '#ccc' : '#fff');
        circle.opacity(highlight ? 0.8 : 1);
    }
} 