import { Layer } from 'konva/lib/Layer';
import { Line } from 'konva/lib/shapes/Line';
import { Wall } from '../models/Wall';
import { Vector2 } from 'three';

export class WallRenderer {
    static createWallLine(wall: Wall, layer: Layer): Line {
        const startPos = wall.getStartNode().getPosition();
        const endPos = wall.getEndNode().getPosition();

        // Ensure coordinates are valid numbers
        const points = [
            Math.round(startPos.x),
            Math.round(startPos.y),
            Math.round(endPos.x),
            Math.round(endPos.y)
        ];

        // Verify all points are valid numbers
        if (!points.every(coord => Number.isFinite(coord))) {
            console.error('Invalid coordinates detected in WallRenderer:', points);
            return new Line({
                points: [0, 0, 0, 0],
                stroke: 'red',
                strokeWidth: 2
            });
        }

        const line = new Line({
            points: points,
            stroke: '#666',
            strokeWidth: wall.getProperties().thickness || 2,
            name: 'wall',
            data: {
                wallId: wall.getId()
            }
        });

        layer.add(line);
        return line;
    }

    static createPreviewLine(startPoint: Vector2, endPoint: Vector2, layer: Layer): Line {
        // Ensure coordinates are valid numbers
        const points = [
            Math.round(startPoint.x),
            Math.round(startPoint.y),
            Math.round(endPoint.x),
            Math.round(endPoint.y)
        ];

        // Verify all points are valid numbers
        if (!points.every(coord => Number.isFinite(coord))) {
            console.error('Invalid coordinates detected in preview line:', points);
            return new Line({
                points: [0, 0, 0, 0],
                stroke: 'red',
                strokeWidth: 2
            });
        }

        const line = new Line({
            points: points,
            stroke: '#999',
            strokeWidth: 2,
            dash: [5, 5],
            name: 'preview'
        });

        layer.add(line);
        return line;
    }

    static updateWallLine(line: Line, wall: Wall): void {
        const startPos = wall.getStartNode().getPosition();
        const endPos = wall.getEndNode().getPosition();

        // Ensure coordinates are valid numbers
        const points = [
            Math.round(startPos.x),
            Math.round(startPos.y),
            Math.round(endPos.x),
            Math.round(endPos.y)
        ];

        // Verify all points are valid numbers
        if (!points.every(coord => Number.isFinite(coord))) {
            console.error('Invalid coordinates detected in updateWallLine:', points);
            return;
        }

        line.points(points);
    }

    static updatePreviewLine(line: Line, startPoint: Vector2, endPoint: Vector2): void {
        // Ensure coordinates are valid numbers
        const points = [
            Math.round(startPoint.x),
            Math.round(startPoint.y),
            Math.round(endPoint.x),
            Math.round(endPoint.y)
        ];

        // Verify all points are valid numbers
        if (!points.every(coord => Number.isFinite(coord))) {
            console.error('Invalid coordinates detected in updatePreviewLine:', points);
            return;
        }

        line.points(points);
    }
} 