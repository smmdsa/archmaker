import { ICommand } from '../../../core/interfaces/ICommand';
import { IWallService } from '../services/IWallService';
import { WallProperties } from '../types/wall';

export class AddWallCommand implements ICommand {
    private createdWallId: string | undefined;

    constructor(
        private readonly wallService: IWallService,
        private readonly properties: WallProperties
    ) {}

    async execute(): Promise<void> {
        this.createdWallId = await this.wallService.createWall(this.properties);
    }

    async undo(): Promise<void> {
        if (!this.createdWallId) {
            throw new Error('Cannot undo command that has not been executed');
        }

        await this.wallService.deleteWall(this.createdWallId);
    }
} 