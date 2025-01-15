import { Point } from '../types/geometry';

/**
 * Base interface for objects that can be serialized to/from JSON
 */
export interface ISerializable<T = any> {
    /**
     * Convert the object to a plain JSON object
     */
    toJSON(): T;

    /**
     * Restore object state from JSON data
     * @param data The JSON data to restore from
     */
    fromJSON(data: T): void;
}

/**
 * Interface for writing project data to a specific format
 */
export interface IDataWriter {
    /**
     * Write project data to string in the specific format
     */
    write(data: ProjectData): string;

    /**
     * Get the format this writer handles
     */
    getFormat(): 'json' | 'yaml';
}

/**
 * Interface for loading project data from a specific format
 */
export interface IDataLoader {
    /**
     * Load project data from string in the specific format
     */
    load(data: string): ProjectData;

    /**
     * Validate if the data string is in the correct format
     */
    validate(data: string): boolean;
}

/**
 * Project metadata information
 */
export interface ProjectMetadata {
    id: string;
    name: string;
    version: string;
    created: string;
    lastModified: string;
}

/**
 * Base data structure for node objects
 */
export interface NodeData {
    id: string;
    position: Point;
    connectedWallIds: string[];
    radius?: number;
    isMovable?: boolean;
    metadata?: Record<string, any>;
}

/**
 * Base data structure for wall objects
 */
export interface WallData {
    id: string;
    startNodeId: string;
    endNodeId: string;
    startPoint: Point;
    endPoint: Point;
    thickness: number;
    height: number;
    color?: string;
    texture?: string;
    metadata?: Record<string, any>;
}

/**
 * Base data structure for door objects
 */
export interface DoorData {
    id: string;
    wallId: string;
    position: number; // Position along the wall (0-1)
    width: number;
    height: number;
    style?: string;
    openDirection?: 'left' | 'right';
    metadata?: Record<string, any>;
}

/**
 * Base data structure for window objects
 */
export interface WindowData {
    id: string;
    wallId: string;
    position: number; // Position along the wall (0-1)
    width: number;
    height: number;
    sillHeight: number;
    style?: string;
    metadata?: Record<string, any>;
}

/**
 * Base data structure for room objects
 */
export interface RoomData {
    id: string;
    wallIds: string[];
    name?: string;
    area?: number;
    color?: string;
    texture?: string;
    metadata?: Record<string, any>;
}

/**
 * Project settings
 */
export interface ProjectSettings {
    units: string;
    gridSize: number;
    snapToGrid: boolean;
    defaultWallHeight: number;
    defaultWallThickness: number;
}

/**
 * Complete project data structure
 */
export interface ProjectData {
    metadata: ProjectMetadata;
    settings: ProjectSettings;
    scene: SceneData;
    viewer: ViewerSettings;
}

export interface SceneData {
    walls: Array<{
        id: string;
        startPoint: { x: number; y: number };
        endPoint: { x: number; y: number };
        height: number;
        thickness: number;
    }>;
    doors: Array<{
        id: string;
        wallId: string;
        position: { x: number; y: number };
        angle: number;
        isFlipped: boolean;
        properties: {
            width: number;
            color: string;
            isOpen: boolean;
            openDirection: 'left' | 'right';
        };
    }>;
    windows: Array<{
        id: string;
        wallId: string;
        position: { x: number; y: number };
        angle: number;
        isFlipped: boolean;
        properties: {
            width: number;
            height: number;
            color: string;
            isOpen: boolean;
            openDirection: 'left' | 'right';
        };
    }>;
    rooms: Array<{
        id: string;
        name: string;
        area: number;
        wallIds: string[];
    }>;
}

export interface CameraSettings {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    zoom: number;
}

export interface ViewerSettings {
    camera: CameraSettings;
    showGrid: boolean;
    showAxes: boolean;
    showGround: boolean;
} 