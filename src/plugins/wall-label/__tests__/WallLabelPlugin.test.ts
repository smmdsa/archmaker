import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WallLabelPlugin } from '../WallLabelPlugin';
import { WallObject } from '../../wall-tool/objects/WallObject';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { IConfigManager } from '../../../core/interfaces/IConfig';
import { CanvasStore } from '../../../store/CanvasStore';
import { WallLabelService } from '../WallLabelService';
import * as THREE from 'three';

// Mock WallLabelService
vi.mock('../WallLabelService', () => {
    return {
        WallLabelService: vi.fn().mockImplementation(() => ({
            createLabel: vi.fn(),
            updateLabel: vi.fn(),
            removeLabel: vi.fn(),
            setLabelsVisible: vi.fn(),
            dispose: vi.fn(),
            initialize: vi.fn()
        }))
    };
});

// Mock THREE.js
vi.mock('three', () => {
    return {
        Scene: vi.fn(() => ({
            add: vi.fn(),
            remove: vi.fn()
        })),
        Group: vi.fn(),
        Sprite: vi.fn(),
        SpriteMaterial: vi.fn(),
        CanvasTexture: vi.fn()
    };
});

describe('WallLabelPlugin', () => {
    let plugin: WallLabelPlugin;
    let mockEventManager: IEventManager;
    let mockLogger: ILogger;
    let mockConfigManager: IConfigManager;
    let mockScene: THREE.Scene;
    let mockWalls: WallObject[];
    let mockLabelService: WallLabelService;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Create mock objects
        mockEventManager = {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn()
        };

        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };

        mockConfigManager = {
            get: vi.fn(),
            set: vi.fn(),
            getAll: vi.fn(),
            load: vi.fn(),
            save: vi.fn()
        };

        mockScene = new THREE.Scene();

        // Create mock walls
        mockWalls = [
            {
                id: 'wall1',
                getData: () => ({
                    startPoint: { x: 0, y: 0 },
                    endPoint: { x: 100, y: 0 }
                })
            },
            {
                id: 'wall2',
                getData: () => ({
                    startPoint: { x: 100, y: 0 },
                    endPoint: { x: 100, y: 100 }
                })
            }
        ] as unknown as WallObject[];

        // Mock CanvasStore
        vi.spyOn(CanvasStore, 'getInstance').mockImplementation(() => ({
            getWallGraph: () => ({
                getAllWalls: () => mockWalls,
                getWall: (id: string) => mockWalls.find(w => w.id === id) || null
            })
        } as unknown as CanvasStore));

        // Create plugin instance
        plugin = new WallLabelPlugin(mockEventManager, mockLogger, mockConfigManager, mockScene);
        mockLabelService = (plugin as any).labelService;
    });

    it('should register wall event handlers on construction', () => {
        expect(mockEventManager.on).toHaveBeenCalledWith('wall:created', expect.any(Function));
        expect(mockEventManager.on).toHaveBeenCalledWith('wall:updated', expect.any(Function));
        expect(mockEventManager.on).toHaveBeenCalledWith('wall:deleted', expect.any(Function));
        expect(mockEventManager.on).toHaveBeenCalledWith('wall-label:toggle', expect.any(Function));
    });

    it('should create label when wall is created', () => {
        // Create a wall
        const wall = mockWalls[0];
        plugin['handleWallCreated']({ wall });

        // Verify label was created
        expect(mockLabelService.createLabel).toHaveBeenCalledWith(wall);
    });

    it('should update label when wall is updated', () => {
        // Create initial wall and label
        const wall = mockWalls[0];
        plugin['handleWallCreated']({ wall });

        // Update the wall
        plugin['handleWallUpdated']({ wallId: wall.id });

        // Verify label was updated
        expect(mockLabelService.updateLabel).toHaveBeenCalledWith(wall);
    });

    it('should remove label when wall is deleted', () => {
        // Create initial wall and label
        const wall = mockWalls[0];
        plugin['handleWallCreated']({ wall });

        // Delete the wall
        plugin['handleWallDeleted']({ wallId: wall.id });

        // Verify label was removed
        expect(mockLabelService.removeLabel).toHaveBeenCalledWith(wall.id);
    });

    it('should toggle labels visibility', () => {
        // Toggle visibility
        plugin['handleVisibilityToggle']();
        expect(mockLabelService.setLabelsVisible).toHaveBeenCalledWith(false);

        // Toggle back
        plugin['handleVisibilityToggle']();
        expect(mockLabelService.setLabelsVisible).toHaveBeenCalledWith(true);
    });

    it('should initialize with existing walls', () => {
        // Initialize plugin
        plugin.initialize();

        // Verify labels were created for existing walls
        mockWalls.forEach(wall => {
            expect(mockLabelService.createLabel).toHaveBeenCalledWith(wall);
        });
    });
}); 