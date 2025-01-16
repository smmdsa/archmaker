import { WallGraph } from '../plugins/wall-tool/models/WallGraph';
import { ILogger } from '../core/interfaces/ILogger';
import { IEventManager } from '../core/interfaces/IEventManager';
import { DoorStore } from './DoorStore';
import { WindowStore } from './WindowStore';
import { ProjectData, SceneData, ViewerSettings } from '../core/storage/interfaces';
import { WallObject } from '../plugins/wall-tool/objects/WallObject';
import { DoorObject } from '../plugins/door-tool/objects/DoorObject';
import { WindowObject } from '../plugins/window-tool/objects/WindowObject';
import { NodeObject } from '../plugins/wall-tool/objects/NodeObject';
import { Vector2 } from 'three';
import { v4 as uuidv4 } from 'uuid';

export class CanvasStore {
    private static instance: CanvasStore;
    private readonly wallGraph: WallGraph;
    private readonly doorStore: DoorStore;
    private readonly windowStore: WindowStore;
    private currentProjectId: string | null = null;
    private projectMetadata: {
        name: string;
        created: string;
        lastModified: string;
        version: string;
    } = {
        name: 'Untitled Project',
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '2.0.0'
    };
    private viewerSettings: ViewerSettings = {
        camera: {
            position: { x: 500, y: 500, z: 500 },
            target: { x: 0, y: 0, z: 0 },
            zoom: 1
        },
        showGrid: true,
        showAxes: true,
        showGround: true
    };

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        // Initialize stores
        this.wallGraph = new WallGraph(eventManager);
        this.doorStore = DoorStore.getInstance(eventManager, logger);
        this.windowStore = WindowStore.getInstance(eventManager, logger);

        // Subscribe to storage events
        this.eventManager.on('project:loaded', this.handleProjectLoaded.bind(this));
        this.eventManager.on('project:saved', this.handleProjectSaved.bind(this));
    }

    // Add static getInstance method
    public static getInstance(eventManager: IEventManager, logger: ILogger): CanvasStore {
        if (!CanvasStore.instance) {
            CanvasStore.instance = new CanvasStore(eventManager, logger);
        }
        return CanvasStore.instance;
    }

    // Project metadata methods
    public updateProjectMetadata(metadata: Partial<typeof this.projectMetadata>): void {
        this.projectMetadata = {
            ...this.projectMetadata,
            ...metadata,
            lastModified: new Date().toISOString()
        };
        
        this.eventManager.emit('project:metadata:updated', { metadata: this.projectMetadata });
    }

    public getProjectMetadata(): typeof this.projectMetadata {
        return { ...this.projectMetadata };
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

    // Add methods to handle project data
    private async handleProjectLoaded(event: { projectId: string }): Promise<void> {
        this.currentProjectId = event.projectId;
        this.logger.info('Project loaded in CanvasStore', { projectId: event.projectId });
    }

    private async handleProjectSaved(event: { projectId: string }): Promise<void> {
        this.logger.info('Project saved in CanvasStore', { projectId: event.projectId });
    }

    // Add serialization methods
    public serialize(): ProjectData {
        return {
            metadata: {
                id: this.currentProjectId || uuidv4(),
                name: this.projectMetadata.name,
                version: this.projectMetadata.version,
                created: this.projectMetadata.created,
                lastModified: new Date().toISOString()
            },
            settings: {
                units: 'cm',
                gridSize: 20,
                snapToGrid: true,
                defaultWallHeight: 280,
                defaultWallThickness: 10
            },
            scene: this.getSceneData(),
            viewer: this.viewerSettings
        };
    }

    public deserialize(data: ProjectData): void {
        try {
            this.currentProjectId = data.metadata.id;
            
            // Handle old format where scene data might be under 'canvas'
            const sceneData = (data as any).canvas 
                ? this.migrateOldFormat(data)
                : (data.scene || { walls: [], doors: [], windows: [], rooms: [] });
            
            // Load scene data
            this.loadSceneData(sceneData);
            
            // Load viewer settings with defaults if not present
            this.viewerSettings = data.viewer || {
                camera: {
                    position: { x: 500, y: 500, z: 500 },
                    target: { x: 0, y: 0, z: 0 },
                    zoom: 1
                },
                showGrid: true,
                showAxes: true,
                showGround: true
            };
            
            // Emit settings updated event
            this.eventManager.emit('viewer:settings:updated', { settings: this.viewerSettings });
        } catch (error) {
            this.logger.error('Failed to deserialize project data', error as Error);
            throw new Error(`Failed to load project: ${(error as Error).message}`);
        }
    }

    private migrateOldFormat(oldData: any): SceneData {
        try {
            const canvas = oldData.canvas || {};
            
            // Convert walls
            const walls = (canvas.walls || []).map((wall: any) => ({
                id: wall.id,
                startPoint: wall.startPoint || { x: 0, y: 0 },
                endPoint: wall.endPoint || { x: 0, y: 0 },
                height: wall.height || 280,
                thickness: wall.thickness || 10
            }));

            // Convert doors
            const doors = (canvas.doors || []).map((door: any) => ({
                id: door.id,
                wallId: door.wallId,
                position: door.position || { x: 0, y: 0 },
                angle: door.angle || 0,
                isFlipped: door.isFlipped || false,
                properties: {
                    width: door.width || 100,
                    color: door.color || '#ff8c00',
                    isOpen: door.isOpen || false,
                    openDirection: door.openDirection || 'left'
                }
            }));

            // Convert windows
            const windows = (canvas.windows || []).map((window: any) => ({
                id: window.id,
                wallId: window.wallId,
                position: window.position || { x: 0, y: 0 },
                angle: window.angle || 0,
                isFlipped: window.isFlipped || false,
                properties: {
                    width: window.width || 100,
                    height: window.height || 150,
                    color: window.color || '#FF69B4',
                    isOpen: window.isOpen || false,
                    openDirection: window.openDirection || 'left'
                }
            }));

            // Convert rooms
            const rooms = (canvas.rooms || []).map((room: any) => ({
                id: room.id,
                name: room.name || 'Room',
                area: room.area || 0,
                wallIds: room.wallIds || []
            }));

            return { walls, doors, windows, rooms };
        } catch (error) {
            this.logger.error('Failed to migrate old project format', error as Error);
            // Return empty scene data if migration fails
            return {
                walls: [],
                doors: [],
                windows: [],
                rooms: []
            };
        }
    }

    // Add method to get current scene data
    public getSceneData(): SceneData {
        return {
            walls: this.wallGraph.getAllWalls().map(wall => {
                const data = wall.getData();
                return {
                    id: wall.id,
                    startPoint: data.startPoint,
                    endPoint: data.endPoint,
                    height: data.height || 280,
                    thickness: data.thickness || 10
                };
            }),
            doors: this.doorStore.getAllDoors().map(door => {
                const data = door.getData();
                return {
                    id: door.id,
                    wallId: data.wallId,
                    position: data.position,
                    angle: data.angle,
                    isFlipped: data.isFlipped,
                    properties: {
                        width: data.properties.width,
                        color: data.properties.color,
                        isOpen: data.properties.isOpen,
                        openDirection: data.properties.openDirection
                    }
                };
            }),
            windows: this.windowStore.getAllWindows().map(window => {
                const data = window.getData();
                return {
                    id: window.id,
                    wallId: data.wallId,
                    position: data.position,
                    angle: data.angle,
                    isFlipped: data.isFlipped,
                    properties: {
                        width: data.properties.width,
                        height: data.properties.height,
                        color: data.properties.color,
                        isOpen: data.properties.isOpen,
                        openDirection: data.properties.openDirection
                    }
                };
            }),
            rooms: [] // TODO: Implement room detection and storage
        };
    }

    // Add method to load scene data
    public loadSceneData(sceneData: SceneData): void {
        try {
            // Ensure sceneData exists and has required properties
            const validatedData: SceneData = {
                walls: Array.isArray(sceneData.walls) ? sceneData.walls : [],
                doors: Array.isArray(sceneData.doors) ? sceneData.doors : [],
                windows: Array.isArray(sceneData.windows) ? sceneData.windows : [],
                rooms: Array.isArray(sceneData.rooms) ? sceneData.rooms : []
            };

            // Clear existing data
            this.clear();

            // Create a map to store nodes by position
            const nodeMap = new Map<string, NodeObject>();
            const getOrCreateNode = (point: { x: number; y: number }): NodeObject => {
                const key = `${point.x},${point.y}`;
                if (!nodeMap.has(key)) {
                    const node = new NodeObject(uuidv4(), point);
                    nodeMap.set(key, node);
                }
                return nodeMap.get(key)!;
            };

            // First pass: Create all nodes and walls
            validatedData.walls.forEach(wallData => {
                if (!wallData.id || !wallData.startPoint || !wallData.endPoint) {
                    this.logger.warn('Skipping invalid wall data', wallData);
                    return;
                }

                // Get or create nodes for start and end points
                const startNode = getOrCreateNode(wallData.startPoint);
                const endNode = getOrCreateNode(wallData.endPoint);

                // Create wall with the nodes
                const wall = new WallObject(
                    wallData.id,
                    startNode.id,
                    endNode.id,
                    wallData.startPoint,
                    wallData.endPoint,
                    this.eventManager,
                    wallData.thickness || 10,
                    wallData.height || 280
                );

                // Add wall to graph
                this.wallGraph.addWall(wall);

                // Connect nodes to wall
                startNode.addConnectedWall(wall.id);
                endNode.addConnectedWall(wall.id);
            });

            // Second pass: Add nodes to the graph
            nodeMap.forEach(node => {
                this.wallGraph.addNode(node);
            });

            // Emit wall graph updated event
            this.eventManager.emit('graph:changed', {
                nodeCount: nodeMap.size,
                wallCount: validatedData.walls.length,
                roomCount: 0
            });

            // Load doors
            validatedData.doors.forEach(doorData => {
                if (!doorData.id || !doorData.wallId || !doorData.position) {
                    this.logger.warn('Skipping invalid door data', doorData);
                    return;
                }

                const door = new DoorObject({
                    id: doorData.id,
                    wallId: doorData.wallId,
                    position: doorData.position,
                    angle: doorData.angle,
                    isFlipped: doorData.isFlipped,
                    properties: {
                        width: doorData.properties.width,
                        color: doorData.properties.color,
                        isOpen: doorData.properties.isOpen,
                        openDirection: doorData.properties.openDirection
                    },
                    doorNumber: null
                });
                this.doorStore.addDoor(door);
                // Emit door added event
                this.eventManager.emit('door:created', { door });
            });

            // Emit doors changed event
            this.eventManager.emit('door:changed', {});

            // Load windows
            validatedData.windows.forEach(windowData => {
                if (!windowData.id || !windowData.wallId || !windowData.position) {
                    this.logger.warn('Skipping invalid window data', windowData);
                    return;
                }

                const window = new WindowObject({
                    id: windowData.id,
                    wallId: windowData.wallId,
                    position: windowData.position,
                    angle: windowData.angle,
                    isFlipped: windowData.isFlipped,
                    properties: {
                        width: windowData.properties.width,
                        height: windowData.properties.height,
                        color: windowData.properties.color,
                        isOpen: windowData.properties.isOpen,
                        openDirection: windowData.properties.openDirection
                    },
                    windowNumber: null
                });
                this.windowStore.addWindow(window);
                // Emit window added event
                this.eventManager.emit('window:created', { window });
            });

            // Emit windows changed event
            this.eventManager.emit('window:changed', {});

            // Emit scene loaded event
            this.eventManager.emit('scene:loaded', { sceneData: validatedData });
        } catch (error) {
            this.logger.error('Failed to load scene data', error as Error);
            throw new Error(`Failed to load scene: ${(error as Error).message}`);
        }
    }

    // Add method to update viewer settings
    public updateViewerSettings(settings: Partial<ViewerSettings>): void {
        this.viewerSettings = {
            ...this.viewerSettings,
            ...settings
        };
        this.eventManager.emit('viewer:settings:updated', { settings: this.viewerSettings });
    }

    // Add method to get viewer settings
    public getViewerSettings(): ViewerSettings {
        return { ...this.viewerSettings };
    }

    // Add method to clear all data
    public clear(): void {
        // Clear all nodes and walls first to prevent dangling references
        this.wallGraph.clear();
        
        // Clear doors and windows using their store's clear methods
        this.doorStore.clear();
        this.windowStore.clear();
        
        this.currentProjectId = null;
        
        // Reset viewer settings to defaults
        this.viewerSettings = {
            camera: {
                position: { x: 500, y: 500, z: 500 },
                target: { x: 0, y: 0, z: 0 },
                zoom: 1
            },
            showGrid: true,
            showAxes: true,
            showGround: true
        };

        // Reset project metadata
        this.projectMetadata = {
            name: 'Untitled Project',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            version: '2.0.0'
        };

        // Emit events to notify of cleared state
        this.eventManager.emit('scene:loaded', { sceneData: { walls: [], doors: [], windows: [], rooms: [] } });
        this.eventManager.emit('viewer:settings:updated', { settings: this.viewerSettings });
        this.eventManager.emit('project:metadata:updated', { metadata: this.projectMetadata });
    }
} 