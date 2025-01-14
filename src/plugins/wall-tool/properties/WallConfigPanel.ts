import { Component } from '../../../core/ui/Component';
import { WallProperties } from '../types/wall';
import { IWallService } from '../services/IWallService';

export class WallConfigPanel extends Component {
    private defaults: WallProperties = {
        height: 240,
        thickness: 15,
        material: 'default',
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 0, y: 0 }
    };
    private materials: string[] = [];

    constructor(
        container: HTMLElement,
        private service: IWallService
    ) {
        super(container, 'wall-config-panel');
        this.initialize();
    }

    private async initialize(): Promise<void> {
        this.element.classList.add('base-panel');
        await this.loadConfig();
        this.render();

        // Suscribirse a eventos relevantes
        this.subscribe('wall-config:refresh', () => this.refresh());
        this.subscribe('theme:change', () => this.render());
    }

    private async loadConfig(): Promise<void> {
        try {
            const [defaults, materials] = await Promise.all([
                this.service.getWallDefaults(),
                this.service.getAvailableMaterials()
            ]);
            this.defaults = defaults;
            this.materials = materials;
            
            // Emitir evento de configuración cargada
            this.emit('wall-config:loaded', this.defaults);
        } catch (error) {
            console.error('Error loading wall configuration:', error);
            this.emit('wall-config:error', error);
        }
    }

    render(): void {
        this.element.innerHTML = '';

        // Título principal
        const title = this.createElement('h3', 'title-lg');
        title.textContent = 'Wall Tool Configuration';
        this.element.appendChild(title);

        // Grupo de configuración
        const configGroup = this.createElement('div', 'config-group');

        // Subtítulo
        const subtitle = this.createElement('h4', 'title-md');
        subtitle.textContent = 'Default Properties';
        configGroup.appendChild(subtitle);

        // Altura por defecto
        const heightGroup = this.createElement('div', 'property-group');
        const heightInput = this.createInput(
            'number',
            this.defaults.height,
            (value) => this.handleChange('height', parseFloat(value)),
            {
                className: 'input-base',
                min: 1,
                step: 1
            }
        );
        
        const heightLabel = this.createElement('label');
        heightLabel.textContent = 'Default Height (cm):';
        heightLabel.appendChild(heightInput);
        heightGroup.appendChild(heightLabel);
        configGroup.appendChild(heightGroup);

        // Grosor por defecto
        const thicknessGroup = this.createElement('div', 'property-group');
        const thicknessInput = this.createInput(
            'number',
            this.defaults.thickness,
            (value) => this.handleChange('thickness', parseFloat(value)),
            {
                className: 'input-base',
                min: 1,
                step: 0.1
            }
        );

        const thicknessLabel = this.createElement('label');
        thicknessLabel.textContent = 'Default Thickness (cm):';
        thicknessLabel.appendChild(thicknessInput);
        thicknessGroup.appendChild(thicknessLabel);
        configGroup.appendChild(thicknessGroup);

        // Material por defecto
        const materialGroup = this.createElement('div', 'property-group');
        const materialOptions = this.materials.map(material => ({
            value: material,
            label: material.charAt(0).toUpperCase() + material.slice(1)
        }));

        const materialSelect = this.createSelect(
            materialOptions,
            this.defaults.material,
            (value) => this.handleChange('material', value)
        );

        const materialLabel = this.createElement('label');
        materialLabel.textContent = 'Default Material:';
        materialLabel.appendChild(materialSelect);
        materialGroup.appendChild(materialLabel);
        configGroup.appendChild(materialGroup);

        this.element.appendChild(configGroup);
    }

    private async handleChange(property: keyof WallProperties, value: number | string): Promise<void> {
        if (property === 'startPoint' || property === 'endPoint') return;
        
        const oldValue = this.defaults[property];
        this.defaults = { ...this.defaults, [property]: value };
        
        try {
            await this.service.setWallDefaults({ [property]: value });
            this.emit('wall-config:updated', {
                property,
                value,
                defaults: this.defaults
            });
        } catch (error) {
            console.error('Error updating wall defaults:', error);
            // Revertir cambios si hay error
            this.defaults = { ...this.defaults, [property]: oldValue };
            this.emit('wall-config:error', error);
        }
        
        this.render();
    }

    async refresh(): Promise<void> {
        await this.loadConfig();
        this.render();
        this.emit('wall-config:refreshed', this.defaults);
    }

    // Override del método destroy para limpiar recursos
    destroy(): void {
        // Limpiar suscripciones y otros recursos
        this.cleanup();
        super.destroy();
    }
} 