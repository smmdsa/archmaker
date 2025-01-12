import { BehaviorSubject, Subject, debounceTime } from 'rxjs';
import { Layer } from 'konva/lib/Layer';
import { WallGraph } from '../plugins/wall-tool/models/WallGraph';
import { ILogger } from '../core/interfaces/ILogger';
import { IEventManager } from '../core/interfaces/IEventManager';
import { ISelectableObject } from '../core/interfaces/ISelectableObject';
import { WallObject } from '../plugins/wall-tool/objects/WallObject';
import { NodeObject } from '../plugins/wall-tool/objects/NodeObject';
import { RoomObject } from '../plugins/room-tool/objects/RoomObject';

// Event interfaces
interface ObjectCreatedEvent {
    object: ISelectableObject;
}

interface ObjectUpdatedEvent {
    object: ISelectableObject;
}

interface ObjectDeletedEvent {
    objectId: string;
    type: string;
}

interface GraphChangedEvent {
    nodeCount: number;
    wallCount: number;
    roomCount: number;
}

export interface CanvasLayers {
    mainLayer: Layer;
    tempLayer: Layer;
    gridLayer: Layer;
}

// Graph registry interface
interface GraphRegistry {
    walls: WallGraph;
    // Future graphs will be added here:
    // doors: DoorGraph;
    // windows: WindowGraph;
}

export class CanvasStore {
    private static instance: CanvasStore | null = null;
    private readonly graphs: GraphRegistry;
    private readonly layers$ = new BehaviorSubject<CanvasLayers | null>(null);
    private readonly redraw$ = new Subject<void>();
    
    private constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        // Initialize all graphs
        this.graphs = {
            walls: new WallGraph(this.eventManager),
            // Future initialization:
            // doors: new DoorGraph(),
            // windows: new WindowGraph()
        };
        
        this.setupSubscriptions();
        this.logger.info('CanvasStore singleton initialized with graphs', {
            availableGraphs: Object.keys(this.graphs)
        });
    }

    static getInstance(eventManager: IEventManager, logger: ILogger): CanvasStore {
        if (!CanvasStore.instance) {
            CanvasStore.instance = new CanvasStore(eventManager, logger);
        }
        return CanvasStore.instance;
    }

    // Graph access methods
    getWallGraph(): WallGraph {
        return this.graphs.walls;
    }

    // Future graph access methods:
    // getDoorGraph(): DoorGraph {
    //     return this.graphs.doors;
    // }
    // 
    // getWindowGraph(): WindowGraph {
    //     return this.graphs.windows;
    // }

    private setupSubscriptions(): void {
        // Object events
        this.eventManager.on<ObjectCreatedEvent>('object:created', () => {
            this.redraw$.next();
        });

        this.eventManager.on<ObjectUpdatedEvent>('object:updated', () => {
            this.redraw$.next();
        });

        this.eventManager.on<ObjectDeletedEvent>('object:deleted', () => {
            this.redraw$.next();
        });

        // Graph change events
        this.eventManager.on<GraphChangedEvent>('graph:changed', () => {
            this.redraw$.next();
        });

        // Subscribe to redraw events with debounce to prevent too frequent redraws
        this.redraw$.pipe(
            debounceTime(16) // ~60fps
        ).subscribe(() => {
            this.redrawCanvas();
        });
    }

    private redrawCanvas(): void {
        const layers = this.layers$.getValue();
        if (!layers) return;

        // Clear main layer
        layers.mainLayer.destroyChildren();

        // Render all objects in the correct order
        this.renderObjects(layers.mainLayer);

        // Batch draw for performance
        layers.mainLayer.batchDraw();
    }

    private renderObjects(layer: Layer): void {
        const graph = this.graphs.walls;

        // Render walls first (bottom layer)
        graph.getAllWalls().forEach(wall => {
            wall.render(layer);
        });

        // Render rooms next (middle layer)
        graph.getAllRooms().forEach(room => {
            room.render(layer);
        });

        // Render nodes last (top layer)
        graph.getAllNodes().forEach(node => {
            node.render(layer);
        });
    }

    setLayers(layers: CanvasLayers): void {
        this.layers$.next(layers);
        this.redrawCanvas();
    }

    getLayers(): CanvasLayers | null {
        return this.layers$.getValue();
    }
} 