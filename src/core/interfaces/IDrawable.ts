export interface IDrawableMetadata {
    type: string;
    [key: string]: any;
}

export interface IDrawable {
    id: string;
    type: string;
    metadata: IDrawableMetadata;
    render(layer: any): void;  // El tipo 'any' será reemplazado por Konva.Layer
    update(metadata: IDrawableMetadata): void;
    destroy(): void;
} 