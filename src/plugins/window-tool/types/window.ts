import { Point } from '../../../core/types/geometry';

export interface WindowProperties {
    color: string;
    width: number;
    height: number;
    isOpen: boolean;
    openDirection: 'left' | 'right';
    label?: string;
}

export interface WindowData {
    id: string;
    wallId: string;
    position: Point;
    angle: number;
    startNodeId: string;
    endNodeId: string;
    properties: WindowProperties;
    isFlipped: boolean;
    connectedNodes: {
        startWallNodeId?: string;
        endWallNodeId?: string;
    };
}

export interface WindowStyle {
    stroke: string;
    strokeWidth: number;
    fill: string;
}

export interface WindowEvents {
    'window:created': { window: WindowData };
    'window:updated': { windowId: string; properties: Partial<WindowProperties> };
    'window:deleted': { windowId: string };
    'window:moved': { windowId: string; newPosition: Point };
    'window:flipped': { windowId: string };
} 