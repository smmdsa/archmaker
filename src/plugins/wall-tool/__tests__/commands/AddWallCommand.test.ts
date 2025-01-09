import { AddWallCommand } from '../../commands/AddWallCommand';
import { IWallService } from '../../services/IWallService';
import { WallProperties } from '../../types/wall';

describe('AddWallCommand', () => {
    let wallService: jest.Mocked<IWallService>;
    let command: AddWallCommand;
    let properties: WallProperties;

    beforeEach(() => {
        properties = {
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 100, y: 100 },
            height: 240,
            thickness: 15,
            material: 'default'
        };

        wallService = {
            createWall: jest.fn().mockResolvedValue('wall-1'),
            deleteWall: jest.fn().mockResolvedValue(undefined),
            id: 'wall-service'
        } as unknown as jest.Mocked<IWallService>;

        command = new AddWallCommand(wallService, properties);
    });

    it('should execute command', async () => {
        await command.execute();
        expect(wallService.createWall).toHaveBeenCalledWith(properties);
    });

    it('should undo command', async () => {
        await command.execute();
        await command.undo();
        expect(wallService.deleteWall).toHaveBeenCalledWith('wall-1');
    });

    it('should throw error if undo before execute', async () => {
        await expect(command.undo()).rejects.toThrow('Cannot undo command that has not been executed');
    });
}); 