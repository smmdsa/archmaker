import { ILogger } from '../interfaces/ILogger';
import { IEventManager } from '../interfaces/IEventManager';
import { UIComponentManifest, UIRegionType } from '../interfaces/IUIRegion';

export class UIRegionManager {
    private regions: Map<UIRegionType, HTMLElement> = new Map();
    private components: Map<string, UIComponentManifest> = new Map();
    private initialized: boolean = false;

    constructor(
        private readonly logger: ILogger,
        private readonly eventManager: IEventManager
    ) {}

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logger.warn('UIRegionManager already initialized');
            return;
        }

        try {
            // Crear regiones principales
            this.createRegion('topbar', 'topbar');
            this.createRegion('toolbar', 'toolbar');
            this.createRegion('canvas', 'editor');
            this.createRegion('properties', 'properties-panel');

            this.initialized = true;
            this.logger.info('UIRegionManager initialized');
        } catch (error) {
            this.logger.error('Failed to initialize UIRegionManager', error as Error);
            throw error;
        }
    }

    private createRegion(type: UIRegionType, containerId: string): void {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container not found: ${containerId}`);
        }

        // Limpiar el contenedor
        container.innerHTML = '';
        
        // Agregar clases CSS
        container.classList.add('region', `region-${type}`);
        
        this.regions.set(type, container);
    }

    registerComponent(component: UIComponentManifest): void {
        if (!this.initialized) {
            throw new Error('UIRegionManager not initialized');
        }

        const region = this.regions.get(component.region);
        if (!region) {
            throw new Error(`Region not found: ${component.region}`);
        }

        // Crear elemento temporal para parsear el template
        const temp = document.createElement('div');
        temp.innerHTML = component.template;
        const element = temp.firstElementChild as HTMLElement;
        if (!element) {
            throw new Error('Invalid template: no root element found');
        }

        // Registrar eventos
        if (component.events) {
            Object.entries(component.events).forEach(([event, handler]) => {
                element.addEventListener(event, handler);
            });
        }

        // Insertar en orden
        let inserted = false;
        const children = Array.from(region.children) as HTMLElement[];
        for (const child of children) {
            const childComponent = this.components.get(child.dataset.componentId || '');
            if (childComponent && childComponent.order > (component.order || 0)) {
                region.insertBefore(element, child);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            region.appendChild(element);
        }

        // Guardar referencia
        element.dataset.componentId = component.id;
        this.components.set(component.id, component);
    }

    unregisterComponent(componentId: string): void {
        if (!this.initialized) {
            throw new Error('UIRegionManager not initialized');
        }

        const component = this.components.get(componentId);
        if (!component) return;

        const region = this.regions.get(component.region);
        if (!region) return;

        const element = region.querySelector(`[data-component-id="${componentId}"]`);
        if (element) {
            element.remove();
        }

        this.components.delete(componentId);
    }

    getRegion(type: UIRegionType): HTMLElement | undefined {
        return this.regions.get(type);
    }

    async dispose(): Promise<void> {
        if (!this.initialized) {
            this.logger.warn('UIRegionManager not initialized or already disposed');
            return;
        }

        try {
            // Limpiar todas las regiones
            this.regions.forEach(region => {
                region.innerHTML = '';
            });
            this.regions.clear();
            this.components.clear();

            this.initialized = false;
            this.logger.info('UIRegionManager disposed');
        } catch (error) {
            this.logger.error('Failed to dispose UIRegionManager', error as Error);
            throw error;
        }
    }
} 