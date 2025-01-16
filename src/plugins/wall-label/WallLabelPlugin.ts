import type { IPlugin, PluginManifest } from '../../core/interfaces/IPlugin';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import { CanvasStore } from '../../store/CanvasStore';
import { WallLabelService } from './WallLabelService';
import { WallObject } from '../wall-tool/objects/WallObject';

export * from './WallLabelTopbarItem';

export class WallLabelPlugin implements IPlugin {
    private canvasStore: CanvasStore;
    private labelService: WallLabelService;
    private labelsVisible: boolean = true;

    readonly manifest: PluginManifest = {
        id: 'wall-label-plugin',
        name: 'Wall Label Plugin',
        version: '1.0.0',
        type: 'tool',
        description: 'Displays wall measurements as labels',
        author: 'ArchMaker'
    };

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager,
        private readonly scene: THREE.Scene
    ) {
        // Initialize stores and services
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
        this.labelService = new WallLabelService(eventManager, logger, scene);

        // Listen to wall events
        this.eventManager.on('wall:created', this.handleWallCreated.bind(this));
        this.eventManager.on('wall:updated', this.handleWallUpdated.bind(this));
        this.eventManager.on('wall:deleted', this.handleWallDeleted.bind(this));
        
        // Listen to visibility toggle
        this.eventManager.on('wall-label:toggle', this.handleVisibilityToggle.bind(this));
    }

    private handleWallCreated(event: { wall: WallObject }): void {
        if (event.wall) {
            this.labelService.createLabel(event.wall);
            this.logger.info('Wall Label Plugin: Wall created');
        }
    }

    private handleWallUpdated(event: { wallId: string }): void {
        const wall = this.getWall(event.wallId);
        if (wall) {
            this.labelService.updateLabel(wall);
        }
    }

    private handleWallDeleted(event: { wallId: string }): void {
        if (event.wallId) {
            this.labelService.removeLabel(event.wallId);
        }
    }

    private handleVisibilityToggle(event: { visible: boolean }): void {
        this.logger.debug(`WallLabelPlugin: Handling visibility toggle event, visible=${event.visible}`);
        this.labelsVisible = event.visible;
        this.labelService.setLabelsVisible(this.labelsVisible);
        this.logger.debug('WallLabelPlugin: Updated label visibility');
    }

    private getWall(wallId: string): WallObject | null {
        const wall = this.canvasStore.getWallGraph().getWall(wallId);
        return wall || null;
    }

    async initialize(): Promise<void> {
        this.logger.info('Initializing Wall Label Plugin...');
        
        // Create labels for existing walls
        const walls = this.canvasStore.getWallGraph().getAllWalls();
        walls.forEach(wall => this.labelService.createLabel(wall));
        
        // Set initial visibility
        this.labelService.setLabelsVisible(this.labelsVisible);
    }

    async dispose(): Promise<void> {
        this.logger.info('Disposing Wall Label Plugin...');
        this.labelService.dispose();
    }
} 