export interface IDrawingProperties {
    wallHeight: number;
    wallThickness: number;
    material?: string;
    color?: string;
    [key: string]: unknown;
}

export interface IDrawingToolConfig {
    defaultWallHeight: number;
    defaultWallThickness: number;
    defaultMaterial: string;
    defaultColor: string;
    snapThreshold: number;
} 