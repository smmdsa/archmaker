import { DrawingTool } from '../../core/tools/DrawingTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { UIComponentManifest } from '../../core/interfaces/IUIRegion';
import { RoomService } from './services/RoomService';
import { RoomStoreAdapter } from './services/RoomStoreAdapter';
import { Point } from '../../core/types/geometry';
import { ProjectStore } from '../../store/ProjectStore';

const toolManifest = {
    id: 'room-tool',
    name: 'Room Tool',
    version: '1.0.0',
    icon: '🏠',
    tooltip: 'Draw rooms',
    section: 'draw',
    order: 2,
    shortcut: 'r'
};

@ToolPlugin({
    id: 'room-tool',
    name: 'Room Tool',
    version: '1.0.0',
    description: 'Tool for drawing rooms',
    icon: '🏠',
    tooltip: 'Draw rooms',
    section: 'draw',
    order: 2,
    shortcut: 'r'
})
export class RoomTool extends DrawingTool {
    private readonly roomService: RoomService;
    protected readonly store: ProjectStore;
    private points: Point[] = [];

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager,
        store: ProjectStore
    ) {
        super(eventManager, logger, configManager, store, 'room-tool', toolManifest);
        
        this.store = store;
        this.roomService = new RoomService(store, new RoomStoreAdapter(), configManager, eventManager, logger);
    }

    protected async onDrawingStart(point: Point): Promise<void> {
        this.points = [point];
        await this.roomService.create({
            points: this.points,
            height: this.properties.roomHeight,
            properties: {
                material: this.properties.material,
                color: this.properties.color
            }
        });
    }

    protected async onDrawingUpdate(point: Point): Promise<void> {
        const rooms = this.roomService.getAll();
        if (rooms.length > 0) {
            const lastRoom = rooms[rooms.length - 1];
            this.points.push(point);
            await this.roomService.update(lastRoom.id, {
                points: [...this.points]
            });
        }
    }

    protected async onDrawingFinish(point: Point): Promise<void> {
        const rooms = this.roomService.getAll();
        if (rooms.length > 0) {
            const lastRoom = rooms[rooms.length - 1];
            this.points.push(point);
            await this.roomService.update(lastRoom.id, {
                points: [...this.points]
            });
            this.points = [];
        }
    }

    protected clearPreview(): void {
        if (this.currentLayer) {
            this.currentLayer.batchDraw();
        }
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (event.type === 'mousemove' && !event.position) return;

        switch (event.type) {
            case 'mousedown':
                if (event.position) {
                    await this.startDrawing(event.position);
                }
                break;
            case 'mousemove':
                if (event.position) {
                    await this.updateDrawing(event.position);
                }
                break;
            case 'mouseup':
                if (event.position) {
                    await this.finishDrawing(event.position);
                }
                break;
        }
    }

    getUIComponents(): UIComponentManifest[] {
        return [{
            id: 'room-tool-button',
            region: 'toolbar',
            order: 2,
            template: `
                <button class="toolbar-button" title="${toolManifest.tooltip} (${toolManifest.shortcut?.toUpperCase()})">${toolManifest.icon}</button>
            `,
            events: {
                click: () => this.activate()
            }
        }];
    }
} 