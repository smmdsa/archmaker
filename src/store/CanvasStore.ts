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
import { WindowStore } from '../plugins/window-tool/stores/WindowStore';
import { WindowObject } from '../plugins/window-tool/objects/WindowObject';
import { ProjectData, ProjectMetadata, ProjectSettings } from '../core/storage/interfaces';
import { v4 as uuidv4 } from 'uuid';
import { Canvas2D } from '../components/Canvas2D';

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
    windowCount: number;
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
    windows: WindowStore;
}

// Compatibility layer class that extends Konva.Layer
class CompatibilityLayer extends Layer {
    constructor(private canvasStore: CanvasStore) {
        super();
    }

    batchDraw(): this {
        // Trigger a render in the next animation frame
        const canvas = this.canvasStore.getCanvas();
        if (canvas) {
            requestAnimationFrame(() => {
                canvas.updatePreview(null);
            });
        }
        return this;
    }

    add(shape: any): this {
        // For now, we'll just trigger a render since we're not actually adding shapes
        this.batchDraw();
        return this;
    }

    draw(): this {
        // Same as batchDraw for our purposes
        return this.batchDraw();
    }
}

export class CanvasStore {
    private static instance: CanvasStore;
    private canvas: Canvas2D | null = null;
    private readonly wallGraph: WallGraph;
    private readonly doorStore: DoorStore;
    private readonly windowStore: WindowStore;
    private compatibilityLayers: CanvasLayers | null = null;

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
            if (this.canvas) {
                this.canvas.updatePreview(event.data);
            }
        });

        // Initialize compatibility layers
        this.initializeCompatibilityLayers();
    }

    private initializeCompatibilityLayers(): void {
        // Create compatibility layers that mimic Konva layers but use Three.js for rendering
        const mainLayer = new CompatibilityLayer(this);
        const tempLayer = new CompatibilityLayer(this);
        const gridLayer = new CompatibilityLayer(this);

        this.compatibilityLayers = {
            mainLayer,
            tempLayer,
            gridLayer
        };
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

    public setCanvas(canvas: Canvas2D): void {
        this.canvas = canvas;
        this.logger.info('Canvas instance set in CanvasStore');
    }

    public getCanvas(): Canvas2D | null {
        return this.canvas;
    }

    public getLayers(): CanvasLayers | null {
        return this.compatibilityLayers;
    }
} 