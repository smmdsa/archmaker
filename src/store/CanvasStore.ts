import { BehaviorSubject, Subject } from 'rxjs';
import { Layer } from 'konva/lib/Layer';
import { WallGraph } from '../plugins/wall-tool/models/WallGraph';
import { WallRenderer } from '../plugins/wall-tool/renderers/WallRenderer';
import { NodeRenderer } from '../plugins/wall-tool/renderers/NodeRenderer';
import { ILogger } from '../core/interfaces/ILogger';
import { IEventManager } from '../core/interfaces/IEventManager';
import { IWall } from '../plugins/wall-tool/interfaces/IWall';

// Event interfaces
interface WallCreatedEvent {
    wall: IWall;
}

interface WallUpdatedEvent {
    wall: IWall;
}

interface WallDeletedEvent {
    wallId: string;
}

interface GraphChangedEvent {
    nodeCount: number;
    wallCount: number;
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
        // Wall events
        this.eventManager.on<WallCreatedEvent>('wall:created', (event) => {
            this.logger.info('Wall created in CanvasStore', { wall: event.wall });
            this.redraw$.next();
        });

        this.eventManager.on<WallUpdatedEvent>('wall:updated', (event) => {
            this.logger.info('Wall updated in CanvasStore', { wall: event.wall });
            this.redraw$.next();
        });

        this.eventManager.on<WallDeletedEvent>('wall:deleted', (event) => {
            this.logger.info('Wall deleted in CanvasStore', { wallId: event.wallId });
            this.redraw$.next();
        });

        // Graph change events
        this.eventManager.on<GraphChangedEvent>('graph:changed', (event) => {
            this.logger.info('Graph changed in CanvasStore', event);
            this.redraw$.next();
        });

        // Subscribe to redraw events
        this.redraw$.subscribe(() => {
            this.redrawCanvas();
        });
    }

    setLayers(layers: CanvasLayers): void {
        this.logger.info('Setting canvas layers', {
            mainLayerId: layers.mainLayer.id(),
            tempLayerId: layers.tempLayer.id()
        });
        this.layers$.next(layers);
        this.redrawCanvas();
    }

    getLayers(): CanvasLayers | null {
        return this.layers$.getValue();
    }

    private redrawCanvas(): void {
        const layers = this.layers$.getValue();
        if (!layers) {
            this.logger.warn('Cannot redraw canvas - layers not set');
            return;
        }

        const { mainLayer } = layers;

        // Clear main layer
        mainLayer.destroyChildren();

        // Render walls and nodes
        this.renderWalls(mainLayer);

        // Future rendering:
        // this.renderDoors(mainLayer);
        // this.renderWindows(mainLayer);

        // Batch draw
        mainLayer.batchDraw();
        this.logger.info('Canvas redrawn', { 
            wallCount: this.graphs.walls.getAllWalls().length,
            nodeCount: this.graphs.walls.getAllNodes().length
        });
    }

    private renderWalls(layer: Layer): void {
        // Render walls
        const walls = this.graphs.walls.getAllWalls();
        walls.forEach(wall => {
            WallRenderer.createWallLine(wall, layer);
        });

        // Render nodes
        const nodes = this.graphs.walls.getAllNodes();
        nodes.forEach(node => {
            NodeRenderer.createNodeCircle(node, 5, layer);
        });
    }

    // Future rendering methods:
    // private renderDoors(layer: Layer): void { ... }
    // private renderWindows(layer: Layer): void { ... }
} 