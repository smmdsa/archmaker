import { ICommand, ICommandContext, ICommandMetadata } from './interfaces/ICommand';
import { WallGraphService } from '../services/WallGraphService';
import { NodeConnectionResult } from '../types/WallTypes';

export class ConnectNodesCommand implements ICommand {
    private connectionResult: NodeConnectionResult | null = null;
    private metadata: ICommandMetadata;

    constructor(
        private startNodeId: string,
        private endNodeId: string,
        private thickness: number,
        private height: number,
        private context: ICommandContext & { graphService: WallGraphService }
    ) {
        this.metadata = {
            description: `Connect nodes ${startNodeId} and ${endNodeId}`,
            timestamp: Date.now()
        };
    }

    async execute(): Promise<void> {
        this.connectionResult = this.context.graphService.connectNodes(
            this.startNodeId,
            this.endNodeId,
            this.thickness,
            this.height
        );

        if (!this.connectionResult.success) {
            throw new Error(`Failed to connect nodes: ${this.connectionResult.error}`);
        }
    }

    async undo(): Promise<void> {
        if (this.connectionResult?.success && this.connectionResult.wallId) {
            this.context.graphService.removeWall(this.connectionResult.wallId);
        }
    }

    async redo(): Promise<void> {
        await this.execute();
    }

    getMetadata(): ICommandMetadata {
        return this.metadata;
    }

    getWallId(): string | undefined {
        return this.connectionResult?.wallId;
    }
} 