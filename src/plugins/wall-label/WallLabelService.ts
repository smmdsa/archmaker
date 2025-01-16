import * as THREE from 'three';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import { WallObject } from '../wall-tool/objects/WallObject';
import { WallLabelObject } from './objects/WallLabelObject';

export class WallLabelService {
    private labels: Map<string, WallLabelObject> = new Map();
    private labelsGroup: THREE.Group;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly scene: THREE.Scene
    ) {
        // Get the labels group from the scene
        this.labelsGroup = scene.children.find(child => child instanceof THREE.Group && child.name === 'labelsGroup') as THREE.Group;
        if (!this.labelsGroup) {
            this.logger.warn('Wall Label Service: Labels group not found in scene, creating new one');
            this.labelsGroup = new THREE.Group();
            this.labelsGroup.name = 'labelsGroup';
            scene.add(this.labelsGroup);
        }
    }

    public createLabel(wall: WallObject): void {
        // Create new label object
        const _ = new WallLabelObject(wall, this.eventManager, this.labelsGroup, this.logger);
    }

    public updateLabel(wall: WallObject): void {
        // Remove old label
        this.removeLabel(wall.id);
        // Create new label
        this.createLabel(wall);
    }

    public removeLabel(wallId: string): void {
        const label = this.labels.get(wallId);
        if (label) {
            label.dispose();
            this.labels.delete(wallId);
        }
    }

    public setLabelsVisible(visible: boolean): void {
        this.labels.forEach(label => label.setVisible(visible));
    }

    public dispose(): void {
        // Clean up all labels
        this.labels.forEach((label, wallId) => {
            this.removeLabel(wallId);
        });
        this.labels.clear();
    }
} 