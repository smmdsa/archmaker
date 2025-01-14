import { Point } from '../../../core/types/geometry';
import { ICommand, ICommandContext, ICommandMetadata } from './interfaces/ICommand';
import { IWallNode } from '../types/WallTypes';
import { WallGraphService } from '../services/WallGraphService';

export class AddNodeCommand implements ICommand {
    private node: IWallNode | null = null;
    private metadata: ICommandMetadata;

    constructor(
        private position: Point,
        private context: ICommandContext & { graphService: WallGraphService }
    ) {
        this.metadata = {
            description: `Add node at (${position.x}, ${position.y})`,
            timestamp: Date.now()
        };
    }

    async execute(): Promise<void> {
        this.node = this.context.graphService.createNode(this.position);
    }

    async undo(): Promise<void> {
        if (this.node) {
            this.context.graphService.removeNode(this.node.id);
        }
    }

    async redo(): Promise<void> {
        await this.execute();
    }

    getMetadata(): ICommandMetadata {
        return this.metadata;
    }
} 