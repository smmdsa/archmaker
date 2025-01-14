export type UIRegionType = 'topbar' | 'toolbar' | 'canvas' | 'properties';

export interface UIComponentManifest {
    id: string;
    region: UIRegionType;
    order?: number;
    template: string;
    events?: Record<string, (event: Event) => void>;
}

export interface IUIRegion {
    /**
     * Identificador único de la región
     */
    id: UIRegionType;

    /**
     * Registra un componente en la región
     */
    registerComponent(component: UIComponentManifest): void;

    /**
     * Elimina un componente de la región
     */
    unregisterComponent(componentId: string): void;

    /**
     * Renderiza la región y sus componentes
     */
    render(): void;

    /**
     * Actualiza un componente específico
     */
    updateComponent(componentId: string, updates: Partial<UIComponentManifest>): void;

    /**
     * Limpia la región
     */
    clear(): void;
} 