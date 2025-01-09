import { ICommand } from '../../../core/interfaces/ICommand';
import { IWallService } from '../services/IWallService';
import { Wall, WallUpdateProperties } from '../types/wall';

export class UpdateWallCommand implements ICommand {
    private originalWall: Wall | undefined;

    constructor(
        private readonly wallService: IWallService,
        private readonly wallId: string,
        private readonly updateProperties: WallUpdateProperties
    ) {}

    async execute(): Promise<void> {
        // Guardar el estado original antes de actualizar
        this.originalWall = await this.wallService.getWall(this.wallId);
        if (!this.originalWall) {
            throw new Error('Wall not found');
        }

        await this.wallService.updateWall(this.wallId, this.updateProperties);
    }

    async undo(): Promise<void> {
        if (!this.originalWall) {
            throw new Error('Cannot undo command that has not been executed');
        }

        const originalProperties: WallUpdateProperties = {
            height: this.originalWall.height,
            thickness: this.originalWall.thickness,
            material: this.originalWall.material
        };

        await this.wallService.updateWall(this.wallId, originalProperties);
    }
} 