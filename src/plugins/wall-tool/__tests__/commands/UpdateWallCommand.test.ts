import { UpdateWallCommand } from '../../commands/UpdateWallCommand';
import { IWallService } from '../../services/IWallService';
import { Wall, WallUpdateProperties } from '../../types/wall';

describe('UpdateWallCommand', () => {
    let wallService: jest.Mocked<IWallService>;
    let command: UpdateWallCommand;
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

    const updateProperties: WallUpdateProperties = {
        height: 300,
        thickness: 20,
        material: 'brick'
    };

    beforeEach(() => {
        wallService = {
            updateWall: jest.fn().mockResolvedValue(undefined),
            getWall: jest.fn().mockResolvedValue(mockWall),
            id: 'wall-service'
        } as unknown as jest.Mocked<IWallService>;

        command = new UpdateWallCommand(wallService, wallId, updateProperties);
    });

    it('should execute command', async () => {
        await command.execute();
        expect(wallService.updateWall).toHaveBeenCalledWith(wallId, updateProperties);
    });

    it('should undo command', async () => {
        const originalProperties: WallUpdateProperties = {
            height: mockWall.height,
            thickness: mockWall.thickness,
            material: mockWall.material
        };

        await command.execute();
        await command.undo();
        
        expect(wallService.updateWall).toHaveBeenCalledWith(wallId, originalProperties);
    });

    it('should throw error if wall not found', async () => {
        wallService.getWall.mockResolvedValue(undefined);
        await expect(command.execute()).rejects.toThrow('Wall not found');
    });

    it('should throw error if undo before execute', async () => {
        await expect(command.undo()).rejects.toThrow('Cannot undo command that has not been executed');
    });
}); 