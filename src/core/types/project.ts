import { Point } from './geometry';

export interface ProjectMetadata {
    id: string;
    name: string;
    version: string;
    created: Date;
    lastModified: Date;
    author?: string;
    description?: string;
}

export interface WallData {
    id: string;
    startPoint: Point;
    endPoint: Point;
    thickness: number;
    height: number;
    properties: {
        material?: string;
        color?: string;
        [key: string]: any;
    };
}

export interface RoomData {
    id: string;
    points: Point[];
    properties: {
        name: string;
        area: number;
        color?: string;
        [key: string]: any;
    };
}

export interface ProjectData {
    metadata: ProjectMetadata;
    walls: WallData[];
    rooms: RoomData[];
    settings: {
        gridSize: number;
        defaultWallThickness: number;
        defaultWallHeight: number;
        units: 'metric' | 'imperial';
        [key: string]: any;
    };
    plugins?: {
        [pluginId: string]: {
            enabled: boolean;
            config?: any;
        };
    };
} 