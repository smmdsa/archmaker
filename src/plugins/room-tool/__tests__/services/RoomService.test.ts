import { RoomService } from '../../services/RoomService';
import { WallService } from '../../../wall-tool/services/WallService';
import { IWall } from '../../../wall-tool/interfaces/IWall';

describe('RoomService', () => {
    let roomService: RoomService;
    let mockWallService: jest.Mocked<WallService>;

    beforeEach(() => {
        mockWallService = {
            createWall: jest.fn().mockImplementation(async (params) => ({
                id: `wall-${Math.random()}`,
                ...params,
                properties: {
                    material: params.properties?.material || 'default'
                }
            }))
        } as unknown as jest.Mocked<WallService>;

        roomService = new RoomService(mockWallService);
    });

    describe('createRoom', () => {
        it('should create a room with four walls', async () => {
            const startPoint = { x: 100, y: 100 };
            const endPoint = { x: 300, y: 300 };
            const params = {
                height: 240,
                thickness: 15,
                properties: {
                    material: 'brick'
                }
            };

            const walls = await roomService.createRoom(startPoint, endPoint, params);

            expect(walls).toHaveLength(4);
            expect(mockWallService.createWall).toHaveBeenCalledTimes(4);

            // Verificar que cada pared se creó con los parámetros correctos
            const expectedPoints = [
                { x: 100, y: 100 },
                { x: 300, y: 100 },
                { x: 300, y: 300 },
                { x: 100, y: 300 }
            ];

            for (let i = 0; i < 4; i++) {
                expect(mockWallService.createWall).toHaveBeenCalledWith({
                    startPoint: expectedPoints[i],
                    endPoint: expectedPoints[(i + 1) % 4],
                    height: params.height,
                    thickness: params.thickness,
                    properties: params.properties
                });
            }
        });

        it('should throw error if room dimensions are too small', async () => {
            const startPoint = { x: 100, y: 100 };
            const endPoint = { x: 150, y: 150 };
            const params = {
                height: 240,
                thickness: 15
            };

            await expect(roomService.createRoom(startPoint, endPoint, params))
                .rejects
                .toThrow('Room dimensions too small - minimum size: 1m x 1m');

            expect(mockWallService.createWall).not.toHaveBeenCalled();
        });
    });
}); 