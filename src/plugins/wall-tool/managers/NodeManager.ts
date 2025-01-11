import { IWallNode } from '../types/WallTypes';
import { WallGraphService } from '../services/WallGraphService';
import { ILogger } from '../../../core/interfaces/ILogger';

export class NodeManager {
    constructor(private graphService: WallGraphService, private logger: ILogger) {}

    addNode(nodeId: string): void {
        const node = this.graphService.getNode(nodeId);
        if (node) {
            this.logger.info('Node added:', node);
            // Additional logic for adding a node
        }
    }

    removeNode(nodeId: string): void {
        const node = this.graphService.getNode(nodeId);
        if (node) {
            this.logger.info('Node removed:', node);
            // Additional logic for removing a node
        }
    }

    moveNode(nodeId: string, newPosition: { x: number, y: number }): void {
        const node = this.graphService.getNode(nodeId);
        if (node) {
            this.logger.info('Node moved:', { nodeId, newPosition });
            // Additional logic for moving a node
        }
    }
} 