import { BehaviorSubject, Subject, debounceTime } from 'rxjs';
import { Layer } from 'konva/lib/Layer';
import { WallGraph } from '../plugins/wall-tool/models/WallGraph';
import { ILogger } from '../core/interfaces/ILogger';
import { IEventManager } from '../core/interfaces/IEventManager';
import { ISelectableObject } from '../core/interfaces/ISelectableObject';
import { WallObject } from '../plugins/wall-tool/objects/WallObject';
import { NodeObject } from '../plugins/wall-tool/objects/NodeObject';
import { RoomObject } from '../plugins/room-tool/objects/RoomObject';
import { DoorObject } from '../plugins/door-tool/objects/DoorObject';
import { DoorStore } from '../plugins/door-tool/stores/DoorStore';

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
    doorCount: number;
}

export interface CanvasLayers {
    mainLayer: Layer;
    tempLayer: Layer;
    gridLayer: Layer;
}

// Graph registry interface
interface GraphRegistry {
    walls: WallGraph;
    doors: DoorStore;
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
            doors: DoorStore.getInstance(this.eventManager, this.logger)
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

    getDoorStore(): DoorStore {
        return this.graphs.doors;
    }

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

        // Door change events
        this.eventManager.on('door:changed', () => {
            this.logger.info('Door state changed, triggering redraw');
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

        this.logger.info('Starting canvas redraw');

        // Clear main layer
        layers.mainLayer.destroyChildren();

        // Render all objects in the correct order
        this.renderObjects(layers.mainLayer);

        // Batch draw for performance
        layers.mainLayer.batchDraw();
        
        this.logger.info('Canvas redraw completed');
    }

    private renderObjects(layer: Layer): void {
        const wallGraph = this.graphs.walls;
        const doorStore = this.graphs.doors;

        this.logger.info('Rendering objects:', {
            walls: wallGraph.getAllWalls().length,
            doors: doorStore.getAllDoors().length,
            rooms: wallGraph.getAllRooms().length,
            nodes: wallGraph.getAllNodes().length
        });

        // Render walls first (bottom layer)
        wallGraph.getAllWalls().forEach(wall => {
            wall.render(layer);
        });

        // Render doors next (middle layer)
        const doors = doorStore.getAllDoors();
        this.logger.info('Rendering doors:', {
            count: doors.length,
            doorIds: doors.map(d => d.id)
        });
        
        doors.forEach(door => {
            this.logger.info('Rendering door:', {
                id: door.id,
                wallId: door.getData().wallId,
                position: door.getData().position
            });
            door.render(layer);
        });

        // Render rooms next (upper middle layer)
        wallGraph.getAllRooms().forEach(room => {
            room.render(layer);
        });

        // Render nodes last (top layer)
        wallGraph.getAllNodes().forEach(node => {
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