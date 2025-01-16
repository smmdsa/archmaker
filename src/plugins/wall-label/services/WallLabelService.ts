import * as THREE from 'three';
import { WallObject } from '../../wall-tool/objects/WallObject';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { WallLabelObject } from '../objects/WallLabelObject';

export class WallLabelService {
    private labels: Map<string, WallLabelObject> = new Map();
    private labelsGroup: THREE.Group;
    private boundHandleWallCreated: (event: { wall: WallObject }) => void;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly scene: THREE.Scene
    ) {
        // Find or create labels group
        this.labelsGroup = this.scene.children.find(child => child.name === 'labelsGroup') as THREE.Group;
        if (!this.labelsGroup) {
            this.labelsGroup = new THREE.Group();
            this.labelsGroup.name = 'labelsGroup';
            this.scene.add(this.labelsGroup);
        }

        // Bind event handlers
        this.boundHandleWallCreated = this.handleWallCreated.bind(this);

        // Subscribe to wall events
        this.eventManager.on('wall:created', this.boundHandleWallCreated);
    }

    private handleWallCreated(event: { wall: WallObject }): void {
        this.createLabel(event.wall);
    }

    public initialize(walls: WallObject[]): void {
        // Create labels for all existing walls
        for (const wall of walls) {
            this.createLabel(wall);
        }
    }

    public createLabel(wall: WallObject): void {
        // Create new label
        const label = new WallLabelObject(wall, this.eventManager, this.labelsGroup);
        this.labels.set(wall.id, label);
    }

    public removeLabel(wallId: string): void {
        const label = this.labels.get(wallId);
        if (label) {
            label.dispose();
            this.labels.delete(wallId);
        }
    }

    public setLabelsVisible(visible: boolean): void {
        for (const label of this.labels.values()) {
            label.setVisible(visible);
        }
    }

    public dispose(): void {
        // Remove event listeners
        this.eventManager.off('wall:created', this.boundHandleWallCreated);

        // Dispose all labels
        for (const label of this.labels.values()) {
            label.dispose();
        }
        this.labels.clear();
    }
} 