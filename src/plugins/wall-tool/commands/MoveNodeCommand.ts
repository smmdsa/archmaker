import { Point } from '../../../core/types/geometry';
import { ICommand, ICommandContext, ICommandMetadata } from './interfaces/ICommand';
import { WallGraphService } from '../services/WallGraphService';
import { IWallNode } from '../types/WallTypes';

export class MoveNodeCommand implements ICommand {
    private previousPosition: Point | null = null;
    private metadata: ICommandMetadata;

    constructor(
        private nodeId: string,
        private newPosition: Point,
        private context: ICommandContext & { graphService: WallGraphService }
    ) {
        this.metadata = {
            description: `Move node ${nodeId} to (${newPosition.x}, ${newPosition.y})`,
            timestamp: Date.now()
        };
    }

    async execute(): Promise<void> {
        const node = this.context.graphService.getNode(this.nodeId);
        if (!node) {
            throw new Error(`Node ${this.nodeId} not found`);
        }

        this.previousPosition = { ...node.position };
        const success = this.context.graphService.moveNode(this.nodeId, this.newPosition);
        
        if (!success) {
            throw new Error(`Failed to move node ${this.nodeId}`);
        }
    }

    async undo(): Promise<void> {
        if (this.previousPosition) {
            const success = this.context.graphService.moveNode(this.nodeId, this.previousPosition);
            if (!success) {
                throw new Error(`Failed to undo node movement ${this.nodeId}`);
            }
        }
    }

    async redo(): Promise<void> {
        await this.execute();
    }

    getMetadata(): ICommandMetadata {
        return this.metadata;
    }

    getNode(): IWallNode | undefined {
        return this.context.graphService.getNode(this.nodeId);
    }
} 