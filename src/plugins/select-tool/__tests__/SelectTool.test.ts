import { SelectTool } from '../SelectTool';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { IConfigManager } from '../../../core/interfaces/IConfig';
import { ProjectStore } from '../../../store/ProjectStore';
import { CanvasStore } from '../../../store/CanvasStore';
import { CanvasEvent } from '../../../core/tools/interfaces/ITool';
import Konva from 'konva';

// Mock dependencies
jest.mock('../../../store/CanvasStore');
jest.mock('../../../store/ProjectStore');

describe('SelectTool', () => {
    let selectTool: SelectTool;
    let eventManager: jest.Mocked<IEventManager>;
    let logger: jest.Mocked<ILogger>;
    let configManager: jest.Mocked<IConfigManager>;
    let store: jest.Mocked<ProjectStore>;
    let canvasStore: jest.Mocked<CanvasStore>;
    let mainLayer: Konva.Layer;
    let tempLayer: Konva.Layer;

    beforeEach(() => {
        // Create mocks
        eventManager = {
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn(),
        } as any;

        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as any;

        configManager = {
            getPluginConfig: jest.fn(),
        } as any;

        store = new ProjectStore(eventManager, logger, configManager);

        // Setup Konva layers
        mainLayer = new Konva.Layer();
        tempLayer = new Konva.Layer();

        // Mock CanvasStore
        canvasStore = {
            getWallGraph: jest.fn().mockReturnValue({
                findClosestNode: jest.fn(),
                getAllNodes: jest.fn().mockReturnValue([]),
            }),
        } as any;

        (CanvasStore.getInstance as jest.Mock).mockReturnValue(canvasStore);

        // Create SelectTool instance
        selectTool = new SelectTool(eventManager, logger, configManager, store);

        // Simulate canvas layers event
        const layersCallback = (eventManager.on as jest.Mock).mock.calls.find(
            call => call[0] === 'canvas:layers'
        )[1];
        layersCallback({ mainLayer, tempLayer });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize correctly', () => {
        expect(selectTool).toBeDefined();
        expect(eventManager.on).toHaveBeenCalledWith('canvas:layers', expect.any(Function));
        expect(eventManager.emit).toHaveBeenCalledWith('canvas:request-layers', null);
    });

    it('should handle single node selection', async () => {
        const mockNode = {
            getId: () => 'node1',
            getPosition: () => ({ x: 100, y: 100 }),
        };

        canvasStore.getWallGraph().findClosestNode.mockReturnValueOnce(mockNode);

        const event: CanvasEvent = {
            type: 'mousedown',
            position: { x: 100, y: 100 },
            originalEvent: new MouseEvent('mousedown'),
            canvas: {
                stage: new Konva.Stage({ container: document.createElement('div') }),
                previewLayer: tempLayer,
                mainLayer: mainLayer,
            },
        };

        await selectTool.onCanvasEvent(event);

        expect(selectTool.getSelectedNodes()).toContain('node1');
    });

    it('should handle multi-selection with Ctrl key', async () => {
        const mockNode1 = {
            getId: () => 'node1',
            getPosition: () => ({ x: 100, y: 100 }),
        };

        const mockNode2 = {
            getId: () => 'node2',
            getPosition: () => ({ x: 200, y: 200 }),
        };

        // First selection
        canvasStore.getWallGraph().findClosestNode.mockReturnValueOnce(mockNode1);

        const event1: CanvasEvent = {
            type: 'mousedown',
            position: { x: 100, y: 100 },
            originalEvent: new MouseEvent('mousedown', { ctrlKey: true }),
            canvas: {
                stage: new Konva.Stage({ container: document.createElement('div') }),
                previewLayer: tempLayer,
                mainLayer: mainLayer,
            },
        };

        await selectTool.onCanvasEvent(event1);

        // Second selection
        canvasStore.getWallGraph().findClosestNode.mockReturnValueOnce(mockNode2);

        const event2: CanvasEvent = {
            type: 'mousedown',
            position: { x: 200, y: 200 },
            originalEvent: new MouseEvent('mousedown', { ctrlKey: true }),
            canvas: {
                stage: new Konva.Stage({ container: document.createElement('div') }),
                previewLayer: tempLayer,
                mainLayer: mainLayer,
            },
        };

        await selectTool.onCanvasEvent(event2);

        const selectedNodes = selectTool.getSelectedNodes();
        expect(selectedNodes).toContain('node1');
        expect(selectedNodes).toContain('node2');
        expect(selectedNodes.length).toBe(2);
    });

    it('should clear selection when clicking empty space', async () => {
        // First select a node
        const mockNode = {
            getId: () => 'node1',
            getPosition: () => ({ x: 100, y: 100 }),
        };

        canvasStore.getWallGraph().findClosestNode.mockReturnValueOnce(mockNode);

        const selectEvent: CanvasEvent = {
            type: 'mousedown',
            position: { x: 100, y: 100 },
            originalEvent: new MouseEvent('mousedown'),
            canvas: {
                stage: new Konva.Stage({ container: document.createElement('div') }),
                previewLayer: tempLayer,
                mainLayer: mainLayer,
            },
        };

        await selectTool.onCanvasEvent(selectEvent);
        expect(selectTool.getSelectedNodes()).toContain('node1');

        // Then click empty space
        canvasStore.getWallGraph().findClosestNode.mockReturnValueOnce(null);

        const clearEvent: CanvasEvent = {
            type: 'mousedown',
            position: { x: 300, y: 300 },
            originalEvent: new MouseEvent('mousedown'),
            canvas: {
                stage: new Konva.Stage({ container: document.createElement('div') }),
                previewLayer: tempLayer,
                mainLayer: mainLayer,
            },
        };

        await selectTool.onCanvasEvent(clearEvent);
        expect(selectTool.getSelectedNodes()).toHaveLength(0);
    });

    it('should handle area selection', async () => {
        const mockNodes = [
            {
                getId: () => 'node1',
                getPosition: () => ({ x: 100, y: 100 }),
            },
            {
                getId: () => 'node2',
                getPosition: () => ({ x: 150, y: 150 }),
            },
        ];

        canvasStore.getWallGraph().getAllNodes.mockReturnValue(mockNodes);

        // Start drag
        const startEvent: CanvasEvent = {
            type: 'mousedown',
            position: { x: 50, y: 50 },
            originalEvent: new MouseEvent('mousedown'),
            canvas: {
                stage: new Konva.Stage({ container: document.createElement('div') }),
                previewLayer: tempLayer,
                mainLayer: mainLayer,
            },
        };

        await selectTool.onCanvasEvent(startEvent);

        // Drag
        const moveEvent: CanvasEvent = {
            type: 'mousemove',
            position: { x: 200, y: 200 },
            originalEvent: new MouseEvent('mousemove'),
            canvas: {
                stage: new Konva.Stage({ container: document.createElement('div') }),
                previewLayer: tempLayer,
                mainLayer: mainLayer,
            },
        };

        await selectTool.onCanvasEvent(moveEvent);

        // End drag
        const endEvent: CanvasEvent = {
            type: 'mouseup',
            position: { x: 200, y: 200 },
            originalEvent: new MouseEvent('mouseup'),
            canvas: {
                stage: new Konva.Stage({ container: document.createElement('div') }),
                previewLayer: tempLayer,
                mainLayer: mainLayer,
            },
        };

        await selectTool.onCanvasEvent(endEvent);

        const selectedNodes = selectTool.getSelectedNodes();
        expect(selectedNodes).toContain('node1');
        expect(selectedNodes).toContain('node2');
        expect(selectedNodes.length).toBe(2);
    });
}); 