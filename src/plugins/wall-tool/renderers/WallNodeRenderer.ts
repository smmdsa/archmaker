import Konva from 'konva';
import { IWallNode } from '../types/WallTypes';

export class WallNodeRenderer {
    private static readonly NODE_RADIUS = 10;
    private static readonly NODE_COLOR = '#4CAF50';
    private static readonly NODE_STROKE_COLOR = '#000000';
    private static readonly NODE_STROKE_WIDTH = 2;
    private static readonly NODE_HOVER_COLOR = '#45A049';
    private static readonly NODE_ACTIVE_COLOR = '#388E3C';
    private static readonly NODE_INTERSECTION_COLOR = '#FF9800';
    private static readonly NODE_ENDPOINT_COLOR = '#2196F3';

    static createNodeGizmo(node: IWallNode, layer: Konva.Layer): Konva.Circle {
        const color = this.getNodeColor(node);
        
        const gizmo = new Konva.Circle({
            x: node.position.x,
            y: node.position.y,
            radius: this.NODE_RADIUS,
            fill: color,
            stroke: this.NODE_STROKE_COLOR,
            strokeWidth: this.NODE_STROKE_WIDTH,
            draggable: true,
            id: `node-${node.id}`,
            shadowColor: 'black',
            shadowBlur: 4,
            shadowOffset: { x: 2, y: 2 },
            shadowOpacity: 0.4,
            opacity: 0.9
        });

        // Añadir eventos de hover
        gizmo.on('mouseenter', () => {
            document.body.style.cursor = 'pointer';
            gizmo.fill(this.NODE_HOVER_COLOR);
            gizmo.shadowOpacity(0.6);
            gizmo.opacity(1);
            gizmo.scale({ x: 1.2, y: 1.2 });
            layer.batchDraw();
        });

        gizmo.on('mouseleave', () => {
            document.body.style.cursor = 'default';
            gizmo.fill(color);
            gizmo.shadowOpacity(0.4);
            gizmo.opacity(0.9);
            gizmo.scale({ x: 1, y: 1 });
            layer.batchDraw();
        });

        // Eventos de arrastre
        gizmo.on('dragstart', () => {
            gizmo.shadowOpacity(0.7);
            gizmo.opacity(1);
            gizmo.scale({ x: 1.3, y: 1.3 });
            layer.batchDraw();
        });

        gizmo.on('dragend', () => {
            gizmo.shadowOpacity(0.4);
            gizmo.opacity(0.9);
            gizmo.scale({ x: 1, y: 1 });
            layer.batchDraw();
        });

        return gizmo;
    }

    static updateNodeGizmo(gizmo: Konva.Circle, node: IWallNode): void {
        const color = this.getNodeColor(node);
        gizmo.position({
            x: node.position.x,
            y: node.position.y
        });
        gizmo.fill(color);
        gizmo.getLayer()?.batchDraw();
    }

    static setNodeActive(gizmo: Konva.Circle, active: boolean): void {
        gizmo.fill(active ? this.NODE_ACTIVE_COLOR : this.getNodeColor(gizmo.getAttr('node')));
        gizmo.shadowOpacity(active ? 0.6 : 0.4);
        gizmo.opacity(active ? 1 : 0.9);
        gizmo.scale({ x: active ? 1.2 : 1, y: active ? 1.2 : 1 });
        gizmo.getLayer()?.batchDraw();
    }

    private static getNodeColor(node: IWallNode): string {
        if (node.metadata.isIntersection) {
            return this.NODE_INTERSECTION_COLOR;
        } else if (node.metadata.isEndpoint) {
            return this.NODE_ENDPOINT_COLOR;
        }
        return this.NODE_COLOR;
    }
} 