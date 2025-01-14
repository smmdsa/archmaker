import { Vector2 } from 'three';
import { WallNode } from '../models/WallNode';
import { Wall } from '../models/Wall';
import { NodeRenderer } from '../renderers/NodeRenderer';
import { WallRenderer } from '../renderers/WallRenderer';
import { Layer } from 'konva/lib/Layer';
import { Stage } from 'konva/lib/Stage';

describe('Wall Coordinate Handling', () => {
    let stage: Stage;
    let layer: Layer;

    beforeEach(() => {
        // Create a temporary container
        const container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);

        // Initialize Konva stage and layer
        stage = new Stage({
            container: 'test-container',
            width: 500,
            height: 500
        });
        layer = new Layer();
        stage.add(layer);
    });

    afterEach(() => {
        stage.destroy();
        document.getElementById('test-container')?.remove();
    });

    test('Node coordinates should be properly handled', () => {
        // Test with integer coordinates
        const node1 = new WallNode(100, 100);
        const pos1 = node1.getPosition();
        expect(pos1.x).toBe(100);
        expect(pos1.y).toBe(100);

        // Test with floating point coordinates
        const node2 = new WallNode(100.6, 100.4);
        const pos2 = node2.getPosition();
        expect(pos2.x).toBe(101); // Should be rounded
        expect(pos2.y).toBe(100); // Should be rounded
    });

    test('Wall coordinates should be properly handled', () => {
        const startNode = new WallNode(100, 100);
        const endNode = new WallNode(200, 200);
        const wall = new Wall(startNode, endNode, {
            thickness: 10,
            height: 280
        });

        // Test wall length calculation
        const length = wall.getLength();
        expect(Math.round(length)).toBe(141); // √(100² + 100²) ≈ 141.42
    });

    test('NodeRenderer should create valid Konva shapes', () => {
        const node = new WallNode(100, 100);
        const circle = NodeRenderer.createNodeCircle(node, 5, layer);

        expect(circle.x()).toBe(100);
        expect(circle.y()).toBe(100);
        expect(typeof circle.x()).toBe('number');
        expect(typeof circle.y()).toBe('number');
        expect(Number.isFinite(circle.x())).toBe(true);
        expect(Number.isFinite(circle.y())).toBe(true);
    });

    test('WallRenderer should create valid Konva shapes', () => {
        const startNode = new WallNode(100, 100);
        const endNode = new WallNode(200, 200);
        const wall = new Wall(startNode, endNode, {
            thickness: 10,
            height: 280
        });

        const line = WallRenderer.createWallLine(wall, layer);
        const points = line.points();

        expect(points.length).toBe(4);
        points.forEach(coord => {
            expect(typeof coord).toBe('number');
            expect(Number.isFinite(coord)).toBe(true);
        });
    });
}); 