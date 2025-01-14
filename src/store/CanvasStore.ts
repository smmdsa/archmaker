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

export class CanvasStore {
    private static instance: CanvasStore | null = null;
    private readonly graphs: GraphRegistry;
    private readonly layers$ = new BehaviorSubject<CanvasLayers | null>(null);
    private readonly redraw$ = new Subject<void>();
    private projectMetadata: ProjectMetadata;
    private projectSettings: ProjectSettings;
    
    private constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        // Initialize all graphs
        this.graphs = {
            walls: new WallGraph(this.eventManager),
            doors: DoorStore.getInstance(this.eventManager, this.logger),
            windows: WindowStore.getInstance(this.eventManager, this.logger)
        };

        // Initialize project metadata
        this.projectMetadata = {
            id: uuidv4(),
            name: 'New Project',
            version: '1.0.0',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };

        // Initialize project settings
        this.projectSettings = {
            scale: 100, // 1px = 1cm
            units: 'cm',
            gridSize: 20,
            snapToGrid: true,
            defaultWallHeight: 280,
            defaultWallThickness: 10,
            defaultDoorHeight: 200,
            defaultDoorWidth: 90,
            defaultWindowHeight: 120,
            defaultWindowWidth: 100,
            defaultWindowSillHeight: 100
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

    getWindowStore(): WindowStore {
        return this.graphs.windows;
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

        // Window change events
        this.eventManager.on('window:changed', () => {
            this.logger.info('Window state changed, triggering redraw');
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
        const windowStore = this.graphs.windows;

        this.logger.info('Rendering objects:', {
            walls: wallGraph.getAllWalls().length,
            doors: doorStore.getAllDoors().length,
            windows: windowStore.getAllWindows().length,
            rooms: wallGraph.getAllRooms().length,
            nodes: wallGraph.getAllNodes().length
        });

        // Render walls first (bottom layer)
        wallGraph.getAllWalls().forEach(wall => {
            wall.render(layer);
        });

        // Render doors and windows next (middle layer)
        const doors = doorStore.getAllDoors();
        const windows = windowStore.getAllWindows();
        
        this.logger.info('Rendering doors and windows:', {
            doorCount: doors.length,
            doorIds: doors.map(d => d.id),
            windowCount: windows.length,
            windowIds: windows.map(w => w.id)
        });
        
        doors.forEach(door => {
            this.logger.info('Rendering door:', {
                id: door.id,
                wallId: door.getData().wallId,
                position: door.getData().position
            });
            door.render(layer);
        });

        windows.forEach(window => {
            this.logger.info('Rendering window:', {
                id: window.id,
                wallId: window.getData().wallId,
                position: window.getData().position
            });
            window.render(layer);
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

    /**
     * Serialize the current state to ProjectData format
     */
    serialize(): ProjectData {
        const wallGraph = this.graphs.walls;
        const doorStore = this.graphs.doors;
        const windowStore = this.graphs.windows;

        // Update last modified timestamp
        this.projectMetadata.lastModified = new Date().toISOString();

        return {
            metadata: { ...this.projectMetadata },
            settings: { ...this.projectSettings },
            canvas: {
                nodes: wallGraph.getAllNodes().map(node => node.toStorageData()),
                walls: wallGraph.getAllWalls().map(wall => wall.toStorageData()),
                doors: doorStore.getAllDoors().map(door => door.toStorageData()),
                windows: windowStore.getAllWindows().map(window => window.toStorageData()),
                rooms: wallGraph.getAllRooms().map(room => room.toStorageData())
            }
        };
    }

    /**
     * Restore state from ProjectData
     */
    deserialize(data: ProjectData): void {
        this.logger.info('Starting project deserialization');

        // Clear current state
        this.clear();

        // Restore metadata and settings
        this.projectMetadata = { ...data.metadata };
        this.projectSettings = { ...data.settings };

        const wallGraph = this.graphs.walls;

        // Restore nodes first (they are needed for walls)
        if (data.canvas.nodes) {
            data.canvas.nodes.forEach(nodeData => {
                const node = NodeObject.fromStorageData(nodeData);
                wallGraph.addNode(node);
            });
        }

        // Restore walls and connect them to nodes
        data.canvas.walls.forEach(wallData => {
            const wall = WallObject.fromStorageData(wallData);
            wallGraph.addWall(wall);
        });

        // Restore doors
        data.canvas.doors.forEach(doorData => {
            const door = DoorObject.fromStorageData(doorData, wallGraph);
            this.graphs.doors.addDoor(door);
        });

        // Restore windows
        data.canvas.windows.forEach(windowData => {
            const window = WindowObject.fromStorageData(windowData, wallGraph);
            this.graphs.windows.addWindow(window);
        });

        // Restore rooms
        data.canvas.rooms.forEach(roomData => {
            const room = RoomObject.fromStorageData(roomData, wallGraph);
            wallGraph.addRoom(room);
        });

        // Synchronize wall attachments after loading
        this.synchronizeWallAttachments();

        this.logger.info('Project deserialization completed', {
            nodeCount: data.canvas.nodes?.length || 0,
            wallCount: data.canvas.walls.length,
            doorCount: data.canvas.doors.length,
            windowCount: data.canvas.windows.length,
            roomCount: data.canvas.rooms.length
        });

        // Trigger redraw
        this.redraw$.next();
    }

    /**
     * Synchronize all objects attached to walls (doors, windows) to ensure proper positioning
     */
    private synchronizeWallAttachments(): void {
        const wallGraph = this.graphs.walls;
        const doors = this.graphs.doors.getAllDoors();
        const windows = this.graphs.windows.getAllWindows();

        // Update door positions
        doors.forEach(door => {
            const wall = wallGraph.getWall(door.getData().wallId);
            if (wall) {
                door.updateWallReference(wall);
            }
        });

        // Update window positions
        windows.forEach(window => {
            const wall = wallGraph.getWall(window.getData().wallId);
            if (wall) {
                window.updateWallReference(wall);
            }
        });

        // Emit change events to ensure UI updates
        this.eventManager.emit('door:changed', {});
        this.eventManager.emit('window:changed', {});
    }

    /**
     * Clear all objects from the canvas
     */
    clear(): void {
        this.graphs.walls.clear();
        this.graphs.doors.clear();
        this.graphs.windows.clear();
        this.redraw$.next();
    }

    /**
     * Get current project metadata
     */
    getProjectMetadata(): ProjectMetadata {
        return { ...this.projectMetadata };
    }

    /**
     * Get current project settings
     */
    getProjectSettings(): ProjectSettings {
        return { ...this.projectSettings };
    }

    /**
     * Update project metadata
     */
    updateProjectMetadata(metadata: Partial<ProjectMetadata>): void {
        this.projectMetadata = {
            ...this.projectMetadata,
            ...metadata,
            lastModified: new Date().toISOString()
        };
    }

    /**
     * Update project settings
     */
    updateProjectSettings(settings: Partial<ProjectSettings>): void {
        this.projectSettings = {
            ...this.projectSettings,
            ...settings
        };
        this.redraw$.next();
    }
} 