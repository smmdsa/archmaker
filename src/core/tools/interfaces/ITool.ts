import { IPlugin } from '../../interfaces/IPlugin';
import { Point } from '../../types/geometry';
import Konva from 'konva';

export interface CanvasEvent {
    type: 'mousedown' | 'mousemove' | 'mouseup' | 'keydown' | 'keyup';
    position?: Point;
    originalEvent: Event;
    canvas: {
        stage: Konva.Stage;
        previewLayer: Konva.Layer;
        mainLayer: Konva.Layer;
    };
}

export interface ToolMetadata {
    name: string;
    icon: string;
    tooltip: string;
    section: string;
    order: number;
    shortcut?: string;
}

export interface ITool extends IPlugin {
    // Metadata
    readonly metadata: ToolMetadata;

    // Canvas interaction
    onCanvasEvent(event: CanvasEvent): Promise<void>;
    
    // Tool state
    isActive(): boolean;
    
    // Properties
    getProperties(): Record<string, unknown>;
    setProperties(props: Record<string, unknown>): void;
} 