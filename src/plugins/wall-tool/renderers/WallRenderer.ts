import { Layer } from 'konva/lib/Layer';
import { Line } from 'konva/lib/shapes/Line';
import { Wall } from '../models/Wall';
import { Vector2 } from 'three';

interface WallRendererConfig {
    thickness: number;
    color: string;
    opacity?: number;
    dashEnabled?: boolean;
    dash?: number[];
}

export class WallRenderer {
    private config: WallRendererConfig;

    constructor(config: WallRendererConfig) {
        this.config = {
            thickness: config.thickness || 2,
            color: config.color || '#666',
            opacity: config.opacity || 1,
            dashEnabled: config.dashEnabled || false,
            dash: config.dash || [5, 5]
        };
    }

    createWallLine(wall: Wall, layer: Layer): Line {
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
            stroke: this.config.color,
            strokeWidth: wall.getProperties().thickness || this.config.thickness,
            opacity: this.config.opacity,
            name: 'wall',
            data: {
                wallId: wall.getId()
            }
        });

        if (this.config.dashEnabled && this.config.dash) {
            line.dash(this.config.dash);
        }

        layer.add(line);
        return line;
    }

    createPreviewWall(startPoint: Vector2, endPoint: Vector2, thickness: number): Line {
        // Ensure coordinates are valid numbers
        const points = [
            Math.round(startPoint.x),
            Math.round(startPoint.y),
            Math.round(endPoint.x),
            Math.round(endPoint.y)
        ];

        // Verify all points are valid numbers
        if (!points.every(coord => Number.isFinite(coord))) {
            console.error('Invalid coordinates detected in preview wall:', points);
            return new Line({
                points: [0, 0, 0, 0],
                stroke: 'red',
                strokeWidth: 2
            });
        }

        const line = new Line({
            points: points,
            stroke: this.config.color,
            strokeWidth: thickness,
            opacity: this.config.opacity,
            name: 'preview-wall'
        });

        if (this.config.dashEnabled && this.config.dash) {
            line.dash(this.config.dash);
        }

        return line;
    }

    updateWallLine(line: Line, wall: Wall): void {
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
} 