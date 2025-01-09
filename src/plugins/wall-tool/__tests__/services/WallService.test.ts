import { WallService } from '../../services/WallService';
import { IEventManager } from '../../../../core/interfaces/IEventManager';
import { ILogger } from '../../../../core/interfaces/ILogger';
import { ProjectStore } from '../../../../store/ProjectStore';
import { IConfigManager } from '../../../../core/interfaces/IConfig';
import { IWallStoreAdapter } from '../../services/WallStoreAdapter';
import { Wall } from '../../types/wall';

describe('WallService', () => {
    let wallService: WallService;
    let store: jest.Mocked<ProjectStore>;
    let eventManager: jest.Mocked<IEventManager>;
    let logger: jest.Mocked<ILogger>;
    let configManager: jest.Mocked<IConfigManager>;
    let adapter: jest.Mocked<IWallStoreAdapter>;

    const mockWall: Wall = {
        id: 'wall-1',
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 100 },
        height: 240,
        thickness: 15,
        material: 'default',
        length: 141.42,
        angle: 0.785
    };

    beforeEach(async () => {
        store = {
            addWall: jest.fn().mockReturnValue('wall-1'),
            addWallWithId: jest.fn(),
            getWall: jest.fn().mockReturnValue({ id: 'wall-1' }),
            getWalls: jest.fn().mockReturnValue([{ id: 'wall-1' }]),
            removeWall: jest.fn(),
            subscribe: jest.fn(),
        } as unknown as jest.Mocked<ProjectStore>;

        eventManager = {
            emit: jest.fn().mockResolvedValue(undefined),
            on: jest.fn(),
            off: jest.fn(),
            id: 'event-manager',
            getListenerCount: jest.fn(),
            clearAllListeners: jest.fn(),
        } as unknown as jest.Mocked<IEventManager>;

        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            setPluginContext: jest.fn(),
            clearPluginContext: jest.fn(),
        } as unknown as jest.Mocked<ILogger>;

        configManager = {
            getPluginConfig: jest.fn().mockReturnValue({ settings: {} }),
            updatePluginConfig: jest.fn().mockResolvedValue(undefined),
        } as unknown as jest.Mocked<IConfigManager>;

        adapter = {
            convertToWall: jest.fn().mockReturnValue(mockWall),
            convertToStoreWall: jest.fn().mockReturnValue({
                start: { x: 0, y: 0 },
                end: { x: 100, y: 100 },
                height: 240,
                thickness: 15
            }),
            convertProperties: jest.fn(),
            convertPoint: jest.fn(),
        } as unknown as jest.Mocked<IWallStoreAdapter>;

        wallService = new WallService(
            store,
            adapter,
            configManager,
            eventManager,
            logger
        );

        // Inicializar el servicio antes de cada prueba
        await wallService.initialize();
    });

    afterEach(async () => {
        await wallService.dispose();
    });

    describe('CRUD Operations', () => {
        it('should create wall', async () => {
            const properties = {
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 100, y: 100 },
                height: 240,
                thickness: 15,
                material: 'default'
            };

            const wallId = await wallService.createWall(properties);

            expect(wallId).toBe('wall-1');
            expect(store.addWall).toHaveBeenCalledWith(
                properties.startPoint,
                properties.endPoint,
                properties.height,
                properties.thickness
            );
            expect(eventManager.emit).toHaveBeenCalledWith('wall:created', { wall: mockWall });
        });

        it('should update wall', async () => {
            const updateProps = {
                height: 300,
                thickness: 20
            };

            await wallService.updateWall('wall-1', updateProps);

            expect(store.addWallWithId).toHaveBeenCalled();
            expect(eventManager.emit).toHaveBeenCalledWith('wall:updated', {
                wallId: 'wall-1',
                properties: updateProps
            });
        });

        it('should delete wall', async () => {
            await wallService.deleteWall('wall-1');

            expect(store.removeWall).toHaveBeenCalledWith('wall-1');
            expect(eventManager.emit).toHaveBeenCalledWith('wall:deleted', { wallId: 'wall-1' });
        });

        it('should get wall', async () => {
            const wall = await wallService.getWall('wall-1');

            expect(wall).toEqual(mockWall);
            expect(store.getWall).toHaveBeenCalledWith('wall-1');
        });

        it('should get all walls', async () => {
            const walls = await wallService.getAllWalls();

            expect(walls).toEqual([mockWall]);
            expect(store.getWalls).toHaveBeenCalled();
        });
    });

    describe('Material Operations', () => {
        it('should get available materials', async () => {
            const materials = await wallService.getAvailableMaterials();

            expect(materials).toContain('default');
            expect(materials.length).toBeGreaterThan(0);
        });

        it('should get default material', async () => {
            const material = await wallService.getDefaultMaterial();

            expect(material).toBe('default');
        });
    });

    describe('Configuration', () => {
        it('should get wall defaults', async () => {
            const defaults = await wallService.getWallDefaults();

            expect(defaults).toHaveProperty('height');
            expect(defaults).toHaveProperty('thickness');
            expect(defaults).toHaveProperty('material');
        });

        it('should set wall defaults', async () => {
            const newDefaults = {
                height: 300,
                thickness: 20
            };

            await wallService.setWallDefaults(newDefaults);

            expect(configManager.updatePluginConfig).toHaveBeenCalled();
        });
    });

    describe('Validation', () => {
        it('should validate valid properties', async () => {
            const validProps = {
                height: 240,
                thickness: 15,
                material: 'default'
            };

            await expect(wallService.validateProperties(validProps)).resolves.toBe(true);
        });

        it('should reject invalid height', async () => {
            const invalidProps = {
                height: -1
            };

            await expect(wallService.validateProperties(invalidProps)).rejects.toThrow();
        });

        it('should reject invalid thickness', async () => {
            const invalidProps = {
                thickness: 0
            };

            await expect(wallService.validateProperties(invalidProps)).rejects.toThrow();
        });

        it('should reject invalid material', async () => {
            const invalidProps = {
                material: 'invalid-material'
            };

            await expect(wallService.validateProperties(invalidProps)).rejects.toThrow();
        });
    });
}); 