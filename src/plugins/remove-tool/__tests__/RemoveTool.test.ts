import { RemoveTool } from '../RemoveTool';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { IConfigManager } from '../../../core/interfaces/IConfig';
import { SelectionStore } from '../../../store/SelectionStore';
import { CanvasStore } from '../../../store/CanvasStore';
import { WallGraph } from '../../../plugins/wall-tool/models/WallGraph';
import { NodeObject } from '../../../plugins/wall-tool/objects/NodeObject';
import { WallObject } from '../../../plugins/wall-tool/objects/WallObject';
import { Point } from '../../../core/types/geometry';
import { ToolService } from '../../../core/tools/services/ToolService';
import { BaseTool } from '../../../core/tools/BaseTool';

// Mock dependencies
jest.mock('../../../store/SelectionStore');
jest.mock('../../../store/CanvasStore');
jest.mock('../../../plugins/wall-tool/models/WallGraph');
jest.mock('../../../core/tools/services/ToolService');

describe('RemoveTool', () => {
    let removeTool: RemoveTool;
    let eventManager: jest.Mocked<IEventManager>;
    let logger: jest.Mocked<ILogger>;
    let configManager: jest.Mocked<IConfigManager>;
    let selectionStore: jest.Mocked<SelectionStore>;
    let canvasStore: jest.Mocked<CanvasStore>;
    let wallGraph: jest.Mocked<WallGraph>;
    let toolService: jest.Mocked<ToolService>;

    beforeEach(() => {
        // Create mock implementations
        eventManager = {
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn(),
        };

        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        configManager = {
            get: jest.fn(),
            set: jest.fn(),
        };

        // Setup SelectionStore mock
        selectionStore = {
            getInstance: jest.fn(),
            getSelectedNodes: jest.fn(),
            getSelectedWalls: jest.fn(),
            clearSelection: jest.fn(),
        } as unknown as jest.Mocked<SelectionStore>;

        // Setup CanvasStore mock
        wallGraph = {
            getNode: jest.fn(),
            getWall: jest.fn(),
            removeNode: jest.fn(),
            removeWall: jest.fn(),
            getAllNodes: jest.fn(),
            getAllWalls: jest.fn(),
            getAllRooms: jest.fn(),
        } as unknown as jest.Mocked<WallGraph>;

        canvasStore = {
            getInstance: jest.fn(),
            getWallGraph: jest.fn().mockReturnValue(wallGraph),
        } as unknown as jest.Mocked<CanvasStore>;

        // Setup ToolService mock
        toolService = {
            getActiveTool: jest.fn(),
            activateTool: jest.fn(),
        } as unknown as jest.Mocked<ToolService>;

        // Initialize tool
        removeTool = new RemoveTool(eventManager, logger, configManager, toolService);
    });

    describe('removeSelectedObjects', () => {
        it('should do nothing when no objects are selected', async () => {
            // Setup
            selectionStore.getSelectedNodes.mockReturnValue(new Set());
            selectionStore.getSelectedWalls.mockReturnValue(new Set());

            // Execute
            await removeTool.activate();

            // Verify
            expect(wallGraph.removeNode).not.toHaveBeenCalled();
            expect(wallGraph.removeWall).not.toHaveBeenCalled();
            expect(eventManager.emit).not.toHaveBeenCalled();
        });

        it('should remove selected walls and update connected nodes', async () => {
            // Setup
            const wallId = 'wall1';
            const startNodeId = 'node1';
            const endNodeId = 'node2';
            
            const startNode = new NodeObject(eventManager, logger, { id: startNodeId, position: { x: 0, y: 0 } });
            const endNode = new NodeObject(eventManager, logger, { id: endNodeId, position: { x: 100, y: 100 } });
            const wall = new WallObject(eventManager, logger, { 
                id: wallId,
                startNodeId,
                endNodeId,
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 100, y: 100 }
            });

            selectionStore.getSelectedNodes.mockReturnValue(new Set());
            selectionStore.getSelectedWalls.mockReturnValue(new Set([wallId]));
            wallGraph.getWall.mockReturnValue(wall);
            wallGraph.getNode.mockImplementation((id) => {
                if (id === startNodeId) return startNode;
                if (id === endNodeId) return endNode;
                return undefined;
            });

            // Execute
            await removeTool.activate();

            // Verify
            expect(wallGraph.removeWall).toHaveBeenCalledWith(wallId);
            expect(eventManager.emit).toHaveBeenCalledWith('graph:changed', expect.any(Object));
            expect(selectionStore.clearSelection).toHaveBeenCalled();
        });

        it('should remove selected nodes and their connected walls', async () => {
            // Setup
            const nodeId = 'node1';
            const connectedWallId = 'wall1';
            
            const node = new NodeObject(eventManager, logger, { id: nodeId, position: { x: 0, y: 0 } });
            jest.spyOn(node, 'getConnectedWalls').mockReturnValue([connectedWallId]);

            selectionStore.getSelectedNodes.mockReturnValue(new Set([nodeId]));
            selectionStore.getSelectedWalls.mockReturnValue(new Set());
            wallGraph.getNode.mockReturnValue(node);

            // Execute
            await removeTool.activate();

            // Verify
            expect(wallGraph.removeNode).toHaveBeenCalledWith(nodeId);
            expect(eventManager.emit).toHaveBeenCalledWith('graph:changed', expect.any(Object));
            expect(selectionStore.clearSelection).toHaveBeenCalled();
        });

        it('should handle Delete key press and restore previous tool', async () => {
            // Setup
            const event = {
                type: 'keydown',
                originalEvent: new KeyboardEvent('keydown', { key: 'Delete' }),
            };

            const previousTool = {
                manifest: { id: 'previous-tool' }
            } as BaseTool;

            toolService.getActiveTool.mockReturnValue(previousTool);
            selectionStore.getSelectedNodes.mockReturnValue(new Set(['node1']));
            selectionStore.getSelectedWalls.mockReturnValue(new Set());
            wallGraph.getNode.mockReturnValue(new NodeObject(eventManager, logger, { id: 'node1', position: { x: 0, y: 0 } }));

            // Execute
            await removeTool.onCanvasEvent(event as any);

            // Verify
            expect(wallGraph.removeNode).toHaveBeenCalledWith('node1');
            expect(eventManager.emit).toHaveBeenCalledWith('graph:changed', expect.any(Object));
            expect(selectionStore.clearSelection).toHaveBeenCalled();
            expect(toolService.activateTool).toHaveBeenCalledWith('previous-tool');
        });

        it('should not restore tool if current tool is remove-tool', async () => {
            // Setup
            const event = {
                type: 'keydown',
                originalEvent: new KeyboardEvent('keydown', { key: 'Delete' }),
            };

            const currentTool = {
                manifest: { id: 'remove-tool' }
            } as BaseTool;

            toolService.getActiveTool.mockReturnValue(currentTool);
            selectionStore.getSelectedNodes.mockReturnValue(new Set(['node1']));
            selectionStore.getSelectedWalls.mockReturnValue(new Set());
            wallGraph.getNode.mockReturnValue(new NodeObject(eventManager, logger, { id: 'node1', position: { x: 0, y: 0 } }));

            // Execute
            await removeTool.onCanvasEvent(event as any);

            // Verify
            expect(wallGraph.removeNode).toHaveBeenCalledWith('node1');
            expect(eventManager.emit).toHaveBeenCalledWith('graph:changed', expect.any(Object));
            expect(selectionStore.clearSelection).toHaveBeenCalled();
            expect(toolService.activateTool).not.toHaveBeenCalled();
        });
    });
}); 