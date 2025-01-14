import { RoomTool } from '../RoomTool';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { ProjectStore } from '../../../store/ProjectStore';
import { IConfigManager } from '../../../core/interfaces/IConfig';
import { WallService } from '../../wall-tool/services/WallService';
import { WallStoreAdapter } from '../../wall-tool/services/WallStoreAdapter';

describe('RoomTool', () => {
    let roomTool: RoomTool;
    let mockStore: jest.Mocked<ProjectStore>;
    let mockEventManager: jest.Mocked<IEventManager>;
    let mockLogger: jest.Mocked<ILogger>;
    let mockConfigManager: jest.Mocked<IConfigManager>;
    let mockWallService: jest.Mocked<WallService>;

    beforeEach(() => {
        mockStore = {
            addWall: jest.fn(),
            getWall: jest.fn(),
            getWalls: jest.fn(),
            removeWall: jest.fn(),
            subscribe: jest.fn(),
        } as unknown as jest.Mocked<ProjectStore>;

        mockEventManager = {
            emit: jest.fn().mockResolvedValue(undefined),
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
        } as unknown as jest.Mocked<ILogger>;

        mockConfigManager = {
            getPluginConfig: jest.fn().mockReturnValue({ settings: {} }),
            updatePluginConfig: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<IConfigManager>;

        mockWallService = {
            initialize: jest.fn().mockResolvedValue(undefined),
            dispose: jest.fn().mockResolvedValue(undefined),
            createWall: jest.fn().mockResolvedValue({ id: 'wall-1' }),
        } as unknown as jest.Mocked<WallService>;

        // Mock WallService constructor
        jest.spyOn(require('../../wall-tool/services/WallService'), 'WallService').mockImplementation(() => mockWallService);

        roomTool = new RoomTool(mockStore, mockEventManager, mockLogger, mockConfigManager);
    });

    describe('Plugin Lifecycle', () => {
        it('should initialize correctly', async () => {
            await roomTool.initialize();
            expect(mockLogger.info).toHaveBeenCalledWith('Room Tool initialized');
            expect(mockWallService.initialize).toHaveBeenCalled();
        });

        it('should activate and deactivate', async () => {
            await roomTool.activate();
            expect(mockLogger.info).toHaveBeenCalledWith('Room Tool activated');

            await roomTool.deactivate();
            expect(mockLogger.info).toHaveBeenCalledWith('Room Tool deactivated');
        });
    });

    describe('Drawing Operations', () => {
        beforeEach(async () => {
            await roomTool.initialize();
            await roomTool.activate();
            await roomTool.activateTool('room-create');
        });

        it('should start drawing', async () => {
            const startPoint = { x: 100, y: 100 };
            await roomTool.startDrawing(startPoint);
            expect(mockEventManager.emit).toHaveBeenCalledWith('room:drawing:start', { point: startPoint });
        });

        it('should update drawing', async () => {
            const startPoint = { x: 100, y: 100 };
            const endPoint = { x: 200, y: 200 };
            await roomTool.startDrawing(startPoint);
            await roomTool.updateDrawing(endPoint);
            expect(mockEventManager.emit).toHaveBeenCalledWith('room:drawing:update', {
                startPoint,
                endPoint
            });
        });

        it('should finish drawing and create room', async () => {
            const startPoint = { x: 100, y: 100 };
            const endPoint = { x: 300, y: 300 };
            await roomTool.startDrawing(startPoint);
            await roomTool.finishDrawing(endPoint);
            expect(mockWallService.createWall).toHaveBeenCalledTimes(4);
            expect(mockLogger.info).toHaveBeenCalledWith('Room created', expect.any(Object));
        });

        it('should cancel drawing', () => {
            const startPoint = { x: 100, y: 100 };
            roomTool.startDrawing(startPoint);
            roomTool.cancelDrawing();
            expect(roomTool['isDrawing']).toBe(false);
            expect(roomTool['startPoint']).toBeNull();
        });
    });
}); 