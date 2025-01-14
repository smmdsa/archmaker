import { ICommand } from '../../../core/interfaces/ICommand';
import { IWallService } from '../services/IWallService';
import { Wall } from '../types/wall';

export class RemoveWallCommand implements ICommand {
    private deletedWall: Wall | undefined;

    constructor(
        private readonly wallService: IWallService,
        private readonly wallId: string
    ) {}

    async execute(): Promise<void> {
        // Guardar el estado del muro antes de eliminarlo
        this.deletedWall = await this.wallService.getWall(this.wallId);
        if (!this.deletedWall) {
            throw new Error('Wall not found');
        }

        await this.wallService.deleteWall(this.wallId);
    }

    async undo(): Promise<void> {
        if (!this.deletedWall) {
            throw new Error('Cannot undo command that has not been executed');
        }

        const { id, length, angle, ...properties } = this.deletedWall;
        await this.wallService.createWall(properties);
    }
} 