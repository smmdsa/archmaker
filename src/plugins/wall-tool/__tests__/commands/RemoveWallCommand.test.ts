import { RemoveWallCommand } from '../../commands/RemoveWallCommand';
import { IWallService } from '../../services/IWallService';
import { Wall } from '../../types/wall';

describe('RemoveWallCommand', () => {
    let wallService: jest.Mocked<IWallService>;
    let command: RemoveWallCommand;
    const wallId = 'wall-1';

    const mockWall: Wall = {
        id: wallId,
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 100 },
        height: 240,
        thickness: 15,
        material: 'default',
        length: 141.42,
        angle: 0.785
    };

    beforeEach(() => {
        wallService = {
            deleteWall: jest.fn().mockResolvedValue(undefined),
            getWall: jest.fn().mockResolvedValue(mockWall),
            createWall: jest.fn().mockResolvedValue(wallId),
            id: 'wall-service'
        } as unknown as jest.Mocked<IWallService>;

        command = new RemoveWallCommand(wallService, wallId);
    });

    it('should execute command', async () => {
        await command.execute();
        expect(wallService.deleteWall).toHaveBeenCalledWith(wallId);
    });

    it('should undo command', async () => {
        await command.execute();
        await command.undo();
        
        const { id, length, angle, ...properties } = mockWall;
        expect(wallService.createWall).toHaveBeenCalledWith(properties);
    });

    it('should throw error if wall not found', async () => {
        wallService.getWall.mockResolvedValue(undefined);
        await expect(command.execute()).rejects.toThrow('Wall not found');
    });

    it('should throw error if undo before execute', async () => {
        await expect(command.undo()).rejects.toThrow('Cannot undo command that has not been executed');
    });
}); 