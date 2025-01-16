import { Point } from '../../../core/types/geometry';
import { Vector2 } from 'three';

// Basic wall properties
export interface WallProperties {
    thickness: number;
    height: number;
    material?: string;
    color?: string;
    layer?: string;
    style?: WallStyle;
    layerType?: WallLayerType;
    isStructural?: boolean;
    metadata?: Record<string, unknown>;
}

// Core wall interface
export interface IWall {
    id: string;
    startNodeId: string;
    endNodeId: string;
    startPoint: Point;
    endPoint: Point;
    thickness: number;
    height: number;
    properties: WallProperties;
}

// Node related interfaces
export interface IWallNodeMetadata {
    isCorner: boolean;
    isIntersection: boolean;
    isEndpoint: boolean;
    elevation?: number;
}

export interface IWallConnection {
    nodeId: string;        // ID of the connected node
    wallId: string;        // ID of the wall segment
    angle: number;         // Angle between nodes in radians
    constraints?: IWallConstraints;
}

export interface IWallConstraints {
    minAngle?: number;     // Minimum angle allowed for this connection
    maxAngle?: number;     // Maximum angle allowed for this connection
    fixedLength?: number;  // Fixed length constraint
    parallel?: string;     // ID of wall to remain parallel to
    perpendicular?: string; // ID of wall to remain perpendicular to
}

export interface IWallNode {
    id: string;
    position: Point;
    connectedNodes: Map<string, IWallConnection>;
    metadata: IWallNodeMetadata;
    
    // Methods from models/interfaces.ts
    getId(): string;
    getPosition(): Vector2;
    setPosition(x: number, y: number): void;
    addWall(wall: IWall): void;
    removeWall(wallId: string): void;
    getConnectedWalls(): IWall[];
}

// Drawing state interface
export interface WallDrawingState {
    isDrawing: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
    snapPoint: Point | null;
    previewWall?: Partial<IWall>;
}

// Enums
export enum WallStyle {
    SOLID = 'solid',
    DASHED = 'dashed',
    DOTTED = 'dotted'
}

export enum WallLayerType {
    INTERIOR = 'interior',
    EXTERIOR = 'exterior',
    PARTITION = 'partition'
}

// Type definitions
export type WallNodeMap = Map<string, IWallNode>;
export type WallMap = Map<string, IWall>;

// Graph operation types
export type NodeConnectionResult = {
    success: boolean;
    wallId?: string;
    error?: string;
};

export type NodeValidationResult = {
    isValid: boolean;
    errors: string[];
};

// Event types for graph changes
export interface IWallGraphEvent {
    type: WallGraphEventType;
    nodeIds: string[];
    wallIds: string[];
    metadata?: Record<string, unknown>;
}

export enum WallGraphEventType {
    NODE_ADDED = 'node_added',
    NODE_REMOVED = 'node_removed',
    NODE_MOVED = 'node_moved',
    WALL_ADDED = 'wall_added',
    WALL_REMOVED = 'wall_removed',
    WALL_MODIFIED = 'wall_modified',
    GRAPH_CLEARED = 'graph_cleared'
} 