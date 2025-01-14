import { StoreService } from '../StoreService';
import { IEventManager } from '../../interfaces/IEventManager';
import { ILogger } from '../../interfaces/ILogger';
import { Wall } from '../../../store/ProjectStore';

describe('StoreService', () => {
    let storeService: StoreService;
    let mockEventManager: jest.Mocked<IEventManager>;
    let mockLogger: jest.Mocked<ILogger>;

    beforeEach(() => {
        mockEventManager = {
            emit: jest.fn(),
            on: jest.fn(),
            off: jest.fn(),
            id: 'event-manager',
            getListenerCount: jest.fn(),
            clearAllListeners: jest.fn(),
        } as unknown as jest.Mocked<IEventManager>;

        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            setPluginContext: jest.fn(),
            clearPluginContext: jest.fn(),
        } as jest.Mocked<ILogger>;

        storeService = new StoreService(mockEventManager, mockLogger);
    });

    it('should initialize and dispose correctly', async () => {
        await storeService.initialize();
        expect(mockLogger.info).toHaveBeenCalledWith('Store service initialized');

        await storeService.dispose();
        expect(mockLogger.info).toHaveBeenCalledWith('Store service disposed');
    });

    describe('Wall Operations', () => {
        const mockWall: Omit<Wall, 'id'> = {
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 100, y: 100 },
            height: 240,
            thickness: 15,
            material: 'default'
        };

        it('should add a wall', () => {
            const id = storeService.addWall(mockWall);
            expect(id).toBe('wall-1');
            expect(storeService.getWall(id)).toEqual({ ...mockWall, id });
            expect(mockEventManager.emit).toHaveBeenCalledWith('store:wall:added', { wall: { ...mockWall, id } });
        });

        it('should get all walls', () => {
            const id1 = storeService.addWall(mockWall);
            const id2 = storeService.addWall(mockWall);
            
            const walls = storeService.getWalls();
            expect(walls).toHaveLength(2);
            expect(walls).toEqual([
                { ...mockWall, id: id1 },
                { ...mockWall, id: id2 }
            ]);
        });

        it('should update a wall', () => {
            const id = storeService.addWall(mockWall);
            const updates = { height: 300 };
            
            storeService.updateWall(id, updates);
            
            const updatedWall = storeService.getWall(id);
            expect(updatedWall?.height).toBe(300);
            expect(mockEventManager.emit).toHaveBeenCalledWith('store:wall:updated', {
                wall: { ...mockWall, ...updates, id }
            });
        });

        it('should remove a wall', () => {
            const id = storeService.addWall(mockWall);
            storeService.removeWall(id);
            
            expect(storeService.getWall(id)).toBeUndefined();
            expect(mockEventManager.emit).toHaveBeenCalledWith('store:wall:removed', { wallId: id });
        });
    });

    describe('Subscriptions', () => {
        it('should handle subscriptions', () => {
            const callback = jest.fn();
            const unsubscribe = storeService.subscribe(callback);

            storeService.addWall({
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 100, y: 100 },
                height: 240,
                thickness: 15,
                material: 'default'
            });

            expect(callback).toHaveBeenCalled();

            unsubscribe();
            storeService.addWall({
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 100, y: 100 },
                height: 240,
                thickness: 15,
                material: 'default'
            });

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });
}); 