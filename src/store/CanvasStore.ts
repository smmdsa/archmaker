import { WallGraph } from '../plugins/wall-tool/models/WallGraph';
import { ILogger } from '../core/interfaces/ILogger';
import { IEventManager } from '../core/interfaces/IEventManager';
import { DoorStore } from '../plugins/door-tool/stores/DoorStore';
import { WindowStore } from '../plugins/window-tool/stores/WindowStore';


export class CanvasStore {
    private static instance: CanvasStore;
    private readonly wallGraph: WallGraph;
    private readonly doorStore: DoorStore;
    private readonly windowStore: WindowStore;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        // Initialize stores
        this.wallGraph = new WallGraph(eventManager);
        this.doorStore = DoorStore.getInstance(eventManager, logger);
        this.windowStore = WindowStore.getInstance(eventManager, logger);

        // Subscribe to preview events
        this.eventManager.on('canvas:preview', (event: { data: any }) => {
        });
    }

    // Add static getInstance method
    public static getInstance(eventManager: IEventManager, logger: ILogger): CanvasStore {
        if (!CanvasStore.instance) {
            CanvasStore.instance = new CanvasStore(eventManager, logger);
        }
        return CanvasStore.instance;
    }

    // Add getters for stores
    public getWallGraph(): WallGraph {
        return this.wallGraph;
    }

    public getDoorStore(): DoorStore {
        return this.doorStore;
    }

    public getWindowStore(): WindowStore {
        return this.windowStore;
    }

} 