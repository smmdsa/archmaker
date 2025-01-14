import { WallTool } from '../WallTool';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { ProjectStore } from '../../../store/ProjectStore';
import { IConfigManager } from '../../../core/interfaces/IConfig';
import { WallService } from '../services/WallService';

describe('WallTool', () => {
    let wallTool: WallTool;
    let mockStore: jest.Mocked<ProjectStore>;
    let mockEventManager: jest.Mocked<IEventManager>;
    let mockLogger: jest.Mocked<ILogger>;
    let mockConfigManager: jest.Mocked<IConfigManager>;
    let mockService: jest.Mocked<WallService>;

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

        mockService = {
            createWall: jest.fn().mockResolvedValue('wall-1'),
            initialize: jest.fn().mockResolvedValue(undefined),
            dispose: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<WallService>;

        // Mock WallService constructor
        jest.spyOn(require('../services/WallService'), 'WallService').mockImplementation(() => mockService);

        wallTool = new WallTool(mockStore, mockEventManager, mockLogger, mockConfigManager);
    });

    describe('Plugin Lifecycle', () => {
        it('should initialize correctly', async () => {
            await wallTool.initialize();
            expect(mockLogger.info).toHaveBeenCalledWith('Wall Tool initialized');
        });

        it('should activate and deactivate', async () => {
            await wallTool.activate();
            expect(mockLogger.info).toHaveBeenCalledWith('Wall Tool activated');

            await wallTool.deactivate();
            expect(mockLogger.info).toHaveBeenCalledWith('Wall Tool deactivated');
        });
    });

    describe('Tool Provider', () => {
        it('should provide wall tools', () => {
            const tools = wallTool.getTools();
            expect(tools).toHaveLength(2);
            expect(tools[0].id).toBe('wall-create');
            expect(tools[1].id).toBe('wall-edit');
        });

        it('should activate and deactivate tools', async () => {
            await wallTool.activateTool('wall-create');
            expect(mockEventManager.emit).toHaveBeenCalledWith('wall:tool:activated', { toolId: 'wall-create' });
            expect(wallTool.isToolActive('wall-create')).toBe(true);

            await wallTool.deactivateTool('wall-create');
            expect(mockEventManager.emit).toHaveBeenCalledWith('wall:tool:deactivated', { toolId: 'wall-create' });
            expect(wallTool.isToolActive('wall-create')).toBe(false);
        });
    });

    describe('Drawing Operations', () => {
        beforeEach(async () => {
            await wallTool.initialize();
            await wallTool.activate();
            await wallTool.activateTool('wall-create');
        });

        it('should start drawing', () => {
            const point = { x: 0, y: 0 };
            wallTool.startDrawing(point);
            expect(mockLogger.debug).toHaveBeenCalledWith('Started drawing wall', { point });
        });

        it('should update drawing', () => {
            const startPoint = { x: 0, y: 0 };
            const endPoint = { x: 100, y: 100 };
            wallTool.startDrawing(startPoint);
            wallTool.updateDrawing(endPoint);
            expect(mockLogger.debug).toHaveBeenCalledWith('Updated wall drawing', { point: endPoint });
        });

        it('should finish drawing', async () => {
            const startPoint = { x: 0, y: 0 };
            const endPoint = { x: 100, y: 100 };
            wallTool.startDrawing(startPoint);
            await wallTool.finishDrawing(endPoint);
            expect(mockService.createWall).toHaveBeenCalledWith(expect.objectContaining({
                startPoint,
                endPoint,
                height: 240,
                thickness: 15,
                material: 'default'
            }));
        });

        it('should cancel drawing', () => {
            const point = { x: 0, y: 0 };
            wallTool.startDrawing(point);
            wallTool.cancelDrawing();
            expect(mockLogger.debug).toHaveBeenCalledWith('Cancelled wall drawing');
        });

        it('should not draw when deactivated', async () => {
            const point = { x: 0, y: 0 };
            await wallTool.deactivate();
            wallTool.startDrawing(point);
            expect(mockService.createWall).not.toHaveBeenCalled();
        });
    });
}); 