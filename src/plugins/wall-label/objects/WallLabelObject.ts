import * as THREE from 'three';
import { Point } from '../../../core/types/geometry';
import { WallObject } from '../../wall-tool/objects/WallObject';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';

export class WallLabelObject {
    private sprite: THREE.Sprite;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private texture: THREE.CanvasTexture;
    private material: THREE.SpriteMaterial;
    private boundHandleNodeUpdated: (event: { node: { id: string, position: Point } }) => void;
    private boundHandleWallSplit: (event: { originalWallId: string }) => void;
    private boundHandleWallUpdated: (event: { wallId: string }) => void;

    constructor(
        private readonly wall: WallObject,
        private readonly eventManager: IEventManager,
        private readonly labelsGroup: THREE.Group,
        private readonly logger: ILogger
    ) {
        // Create canvas and context
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d')!;
        
        // Set canvas size
        this.canvas.width = 256;
        this.canvas.height = 64;

        // Create sprite material
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.material = new THREE.SpriteMaterial({ map: this.texture });
        this.sprite = new THREE.Sprite(this.material);

        // Add to group
        this.labelsGroup.add(this.sprite);

        // Bind event handlers
        this.boundHandleNodeUpdated = this.handleNodeUpdated.bind(this);
        this.boundHandleWallSplit = this.handleWallSplit.bind(this);
        this.boundHandleWallUpdated = this.handleWallUpdated.bind(this);

        // Subscribe to events
        this.eventManager.on('node:updated', this.boundHandleNodeUpdated);
        this.eventManager.on('wall:split', this.boundHandleWallSplit);
        this.eventManager.on('wall:updated', this.boundHandleWallUpdated);
        this.eventManager.on('wall:thickness:changed', this.boundHandleWallUpdated);
        this.eventManager.on('wall:properties:changed', this.boundHandleWallUpdated);
        this.eventManager.on('wall:deleted', this.handleWallDeleted.bind(this));
        this.eventManager.on('wall-label:toggle', this.handleWallLabelToggle.bind(this));
        
        // Initial update
        this.updateLabel();
    }

    private handleNodeUpdated(event: { node: { id: string, position: Point } }): void {
        const wallData = this.wall.getData();
        // Check if the updated node is part of this wall
        if (wallData.startNodeId === event.node.id || wallData.endNodeId === event.node.id) {
            // Update wall endpoints based on which node moved
            if (wallData.startNodeId === event.node.id) {
                wallData.startPoint = event.node.position;
            } else {
                wallData.endPoint = event.node.position;
            }
            this.updateLabel();
        }
    }

    private handleWallSplit(event: { originalWallId: string }): void {
        if (event.originalWallId === this.wall.id) {
            this.dispose();
        }
    }

    private handleWallUpdated(event: { wallId: string }): void {
        if (event.wallId === this.wall.id) {
            this.updateLabel();
        }
    }

    private handleWallDeleted(event: { wallId: string }): void {
        if (event.wallId === this.wall.id) {
            this.dispose();
        }
    }

    private updateLabel(): void {
        const data = this.wall.getData();
        const length = this.calculateWallLength(data.startPoint, data.endPoint);
        const position = this.calculateLabelPosition(data.startPoint, data.endPoint);

        // Clear canvas
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Style the text
        this.context.fillStyle = '#000000';
        this.context.font = 'bold 48px Arial';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';

        // Draw the text (length in meters with 2 decimal places)
        const lengthInMeters = length / 100; // Convert from cm to meters
        const text = `${lengthInMeters.toFixed(2)}m`;
        this.context.fillText(text, this.canvas.width/2, this.canvas.height/2);

        // Update texture
        this.texture.needsUpdate = true;

        // Calculate wall angle
        const angle = Math.atan2(data.endPoint.y - data.startPoint.y, data.endPoint.x - data.startPoint.x);
        
        // Calculate offset perpendicular to wall for label position
        const OFFSET_DISTANCE = 30; // Distance above the wall
        const offsetX = -Math.sin(angle) * OFFSET_DISTANCE;
        const offsetY = Math.cos(angle) * OFFSET_DISTANCE;

        // Update position with offset
        this.sprite.position.set(
            position.x + offsetX,
            position.y + offsetY,
            10
        );
        this.sprite.scale.set(100, 25, 1);

        // Determine if we need to flip the text for horizontal-ish walls
        let labelRotation = angle;
        if (Math.abs(angle) > Math.PI / 2) {
            // If wall is more than 90 degrees rotated, flip the text
            labelRotation = angle - Math.PI;
        }
        this.sprite.material.rotation = labelRotation;
    }

    private calculateWallLength(start: Point, end: Point): number {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private calculateLabelPosition(start: Point, end: Point): Point {
        return {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2
        };
    }

    public setVisible(visible: boolean): void {
        this.logger.info(`WallLabelObject: Setting visibility to ${visible} for wall ${this.wall.id}`);
        this.sprite.visible = visible;
    }

    public dispose(): void {
        // Remove event listeners
        this.eventManager.off('node:updated', this.boundHandleNodeUpdated);
        this.eventManager.off('wall:split', this.boundHandleWallSplit);
        this.eventManager.off('wall:updated', this.boundHandleWallUpdated);
        this.eventManager.off('wall:thickness:changed', this.boundHandleWallUpdated);
        this.eventManager.off('wall:properties:changed', this.boundHandleWallUpdated);

        // Remove from scene
        this.labelsGroup.remove(this.sprite);

        // Dispose resources
        this.material.dispose();
        this.texture.dispose();
    }

    private handleWallLabelToggle(event: { visible: boolean }): void {
        this.logger.info(`WallLabelObject: Received toggle event with visible=${event.visible} for wall ${this.wall.id}`);
        this.setVisible(event.visible);
    }
} 