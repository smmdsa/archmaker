import { WallService } from '../../services/WallService';
import { IEventManager } from '../../../../core/interfaces/IEventManager';
import { ILogger } from '../../../../core/interfaces/ILogger';
import { IWall } from '../../interfaces/IWall';
import { Point } from '../../../../core/types/geometry';

describe('WallService', () => {
    let wallService: WallService;
    let eventManager: jest.Mocked<IEventManager>;
    let logger: jest.Mocked<ILogger>;

    const mockPoint = (x: number, y: number): Point => ({ x, y });

    beforeEach(() => {
        eventManager = {
            emit: jest.fn().mockResolvedValue(undefined),
            on: jest.fn(),
            off: jest.fn(),
        } as unknown as jest.Mocked<IEventManager>;

        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as unknown as jest.Mocked<ILogger>;

        wallService = new WallService(eventManager, logger);
    });

    describe('Wall Creation', () => {
        it('should create wall with default properties', async () => {
            const startPoint = mockPoint(0, 0);
            const endPoint = mockPoint(100, 100);

            const wall = await wallService.createWall({
                startPoint,
                endPoint
            });

            expect(wall).toBeDefined();
            expect(wall.startPoint).toEqual(startPoint);
            expect(wall.endPoint).toEqual(endPoint);
            expect(wall.thickness).toBe(10);
            expect(wall.height).toBe(280);
            expect(eventManager.emit).toHaveBeenCalledWith('wall:created', { wall });
        });

        it('should create wall with custom properties', async () => {
            const wall = await wallService.createWall({
                startPoint: mockPoint(0, 0),
                endPoint: mockPoint(100, 100),
                thickness: 20,
                height: 300,
                properties: {
                    material: 'brick',
                    color: '#ff0000'
                }
            });

            expect(wall.thickness).toBe(20);
            expect(wall.height).toBe(300);
            expect(wall.properties.material).toBe('brick');
            expect(wall.properties.color).toBe('#ff0000');
        });
    });

    describe('Wall Updates', () => {
        let existingWall: IWall;

        beforeEach(async () => {
            existingWall = await wallService.createWall({
                startPoint: mockPoint(0, 0),
                endPoint: mockPoint(100, 100)
            });
        });

        it('should update wall properties', async () => {
            const updates = {
                thickness: 25,
                height: 320,
                properties: {
                    material: 'concrete'
                }
            };

            const updated = await wallService.updateWall(existingWall.id, updates);

            expect(updated.thickness).toBe(25);
            expect(updated.height).toBe(320);
            expect(updated.properties.material).toBe('concrete');
            expect(eventManager.emit).toHaveBeenCalledWith('wall:updated', { wall: updated });
        });

        it('should throw error when updating non-existent wall', async () => {
            await expect(wallService.updateWall('non-existent', {}))
                .rejects.toThrow('Wall with id non-existent not found');
        });
    });

    describe('Wall Deletion', () => {
        it('should delete existing wall', async () => {
            const wall = await wallService.createWall({
                startPoint: mockPoint(0, 0),
                endPoint: mockPoint(100, 100)
            });

            await wallService.deleteWall(wall.id);

            expect(wallService.getWall(wall.id)).toBeUndefined();
            expect(eventManager.emit).toHaveBeenCalledWith('wall:deleted', { wallId: wall.id });
        });

        it('should throw error when deleting non-existent wall', async () => {
            await expect(wallService.deleteWall('non-existent'))
                .rejects.toThrow('Wall with id non-existent not found');
        });
    });

    describe('Wall Queries', () => {
        let wall1: IWall;
        let wall2: IWall;

        beforeEach(async () => {
            wall1 = await wallService.createWall({
                startPoint: mockPoint(0, 0),
                endPoint: mockPoint(100, 100)
            });
            wall2 = await wallService.createWall({
                startPoint: mockPoint(100, 100),
                endPoint: mockPoint(200, 200)
            });
        });

        it('should get wall by id', () => {
            const found = wallService.getWall(wall1.id);
            expect(found).toBeDefined();
            expect(found?.id).toBe(wall1.id);
        });

        it('should get all walls', () => {
            const walls = wallService.getAllWalls();
            expect(walls).toHaveLength(2);
            expect(walls.map(w => w.id)).toContain(wall1.id);
            expect(walls.map(w => w.id)).toContain(wall2.id);
        });

        it('should get snap points', () => {
            const points = wallService.getSnapPoints();
            expect(points).toHaveLength(3); // 3 unique points
            expect(points).toContainEqual(mockPoint(0, 0));
            expect(points).toContainEqual(mockPoint(100, 100));
            expect(points).toContainEqual(mockPoint(200, 200));
        });

        it('should find nearest snap point', () => {
            const point = wallService.getNearestSnapPoint(mockPoint(98, 98), 5);
            expect(point).toEqual(mockPoint(100, 100));
        });

        it('should return null when no snap point is within threshold', () => {
            const point = wallService.getNearestSnapPoint(mockPoint(50, 50), 5);
            expect(point).toBeNull();
        });
    });
}); 