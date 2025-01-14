import { Layer } from 'konva/lib/Layer';
import { IWall } from '../interfaces/IWall';
import { Point } from '../../../store/ProjectStore';

export interface WallRenderOptions {
    color?: string;
    thickness?: number;
    opacity?: number;
    dashEnabled?: boolean;
    showDimensions?: boolean;
}

export interface IWallRenderer {
    // Rendering methods
    renderWall(layer: Layer, wall: IWall, options?: WallRenderOptions): void;
    renderPreview(layer: Layer, startPoint: Point, endPoint: Point, options?: WallRenderOptions): void;
    
    // Snap points visualization
    renderSnapPoints(layer: Layer, points: Point[]): void;
    renderSnapIndicator(layer: Layer, point: Point): void;
    clearSnapIndicators(layer: Layer): void;

    // Grid integration
    enableGridSnapping(enabled: boolean): void;
    setGridSize(size: number): void;

    // Cleanup
    clear(layer: Layer): void;
} 