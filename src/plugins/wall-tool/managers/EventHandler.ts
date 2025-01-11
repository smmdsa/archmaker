import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { WallTool } from '../WallTool';

export class EventHandler {
    constructor(private eventManager: IEventManager, private logger: ILogger, private tool: WallTool) {}

    initialize(): void {
        this.logger.info('Initializing event handler...');
        this.eventManager.on('canvas:layers', this.handleCanvasLayers.bind(this));
        // Additional event subscriptions
    }

    private handleCanvasLayers(layers: { mainLayer: any, tempLayer: any }): void {
        this.logger.info('Handling canvas layers event:', layers);
        // Logic for handling canvas layers
    }

    // Additional event handling methods
} 