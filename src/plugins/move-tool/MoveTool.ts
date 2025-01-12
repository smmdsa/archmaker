import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { ProjectStore } from '../../store/ProjectStore';
import { SelectionStore } from '../../store/SelectionStore';
import { CanvasStore } from '../../store/CanvasStore';
import { Point } from '../../core/types/geometry';
import { Vector2 } from 'three';

interface MoveState {
    isMoving: boolean;
    startPoint: Point | null;
    lastPoint: Point | null;
}

const toolManifest = {
    id: 'move-tool',
    name: 'Move Tool',
    version: '1.0.0',
    icon: '✋',
    tooltip: 'Move selected nodes (M)',
    section: 'edit',
    order: 2,
    shortcut: 'm'
};

@ToolPlugin({
    id: 'move-tool',
    name: 'Move Tool',
    version: '1.0.0',
    description: 'Tool for moving selected nodes',
    icon: '✋',
    tooltip: 'Move selected nodes (M)',
    section: 'edit',
    order: 2,
    shortcut: 'm'
})
export class MoveTool extends BaseTool {
    private readonly selectionStore: SelectionStore;
    private readonly canvasStore: CanvasStore;
    private state: MoveState = {
        isMoving: false,
        startPoint: null,
        lastPoint: null
    };

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager,
        private readonly store: ProjectStore
    ) {
        super(eventManager, logger, 'move-tool', toolManifest);
        this.selectionStore = SelectionStore.getInstance(eventManager, logger);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        switch (event.type) {
            case 'mousedown':
                await this.handleMouseDown(event);
                break;
            case 'mousemove':
                if (this.state.isMoving) {
                    await this.handleMouseMove(event);
                }
                break;
            case 'mouseup':
                await this.handleMouseUp(event);
                break;
        }
    }

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.selectionStore.hasSelectedNodes()) return;

        this.state = {
            isMoving: true,
            startPoint: event.position,
            lastPoint: event.position
        };

        this.logger.info('Starting move operation', {
            selectedNodes: Array.from(this.selectionStore.getSelectedNodes())
        });
    }

    private async handleMouseMove(event: CanvasEvent): Promise<void> {
        if (!event.position || !this.state.lastPoint) return;

        const dx = event.position.x - this.state.lastPoint.x;
        const dy = event.position.y - this.state.lastPoint.y;

        // Move all selected nodes
        const graph = this.canvasStore.getWallGraph();
        const selectedNodes = this.selectionStore.getSelectedNodes();

        selectedNodes.forEach(nodeId => {
            const node = graph.getNode(nodeId);
            if (node) {
                const currentPos = node.getPosition();
                node.setPosition(
                    currentPos.x + dx,
                    currentPos.y + dy
                );
            }
        });

        // Notify canvas about graph changes
        this.eventManager.emit('graph:changed', {
            nodeCount: graph.getAllNodes().length,
            wallCount: graph.getAllWalls().length
        });

        // Update last point for next move
        this.state.lastPoint = event.position;
    }

    private async handleMouseUp(event: CanvasEvent): Promise<void> {
        if (this.state.isMoving) {
            this.logger.info('Ending move operation', {
                selectedNodes: Array.from(this.selectionStore.getSelectedNodes())
            });

            // Reset move state
            this.state = {
                isMoving: false,
                startPoint: null,
                lastPoint: null
            };
        }
    }
} 