export interface Point {
    x: number;
    y: number;
}

export interface Wall {
    id: string;
    startPoint: Point;
    endPoint: Point;
    thickness: number;
    height: number;
    properties?: Record<string, any>;
}

export interface Room {
    id: string;
    points: Point[];
    properties?: Record<string, any>;
}

export interface ViewportState {
    zoom: number;
    pan: Point;
    selectedElements: string[];
}

export interface EventMap {
    // Wall events
    'wall:created': { wall: Wall };
    'wall:updated': { wall: Wall };
    'wall:deleted': { id: string };
    'wall:selected': { id: string };

    // Room events
    'room:created': { room: Room };
    'room:updated': { room: Room };
    'room:deleted': { id: string };
    'room:selected': { id: string };

    // Tool events
    'tool:activated': { toolId: string };
    'tool:deactivated': { toolId: string };

    // Viewport events
    'viewport:updated': ViewportState;
    'viewport:elementSelected': { id: string; type: 'wall' | 'room' };

    // Project events
    'project:saved': { timestamp: number };
    'project:loaded': { timestamp: number };
    'project:modified': { timestamp: number };
} 