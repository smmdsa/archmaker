import { Component } from '../../../core/ui/Component';
import { Wall, WallUpdateProperties } from '../types/wall';
import { IWallService } from '../services/IWallService';

export class WallPropertiesPanel extends Component {
    private wall: Wall;
    private materials: string[] = [];
    private properties: WallUpdateProperties;

    constructor(
        container: HTMLElement,
        wall: Wall,
        private service: IWallService,
        private onUpdate: (wallId: string, properties: WallUpdateProperties) => void
    ) {
        super(container, 'wall-properties-panel');
        this.wall = wall;
        this.properties = {
            height: wall.height,
            thickness: wall.thickness,
            material: wall.material
        };
        this.initialize();
    }

    private async initialize(): Promise<void> {
        this.element.classList.add('base-panel');
        await this.loadMaterials();
        this.render();

        // Suscribirse a eventos relevantes
        this.subscribe('theme:change', () => this.render());
    }

    private async loadMaterials(): Promise<void> {
        try {
            this.materials = await this.service.getAvailableMaterials();
            this.emit('wall-properties:materials-loaded', this.materials);
        } catch (error) {
            console.error('Error loading materials:', error);
            this.emit('wall-properties:error', error);
        }
    }

    render(): void {
        this.element.innerHTML = '';

        // Título
        const title = this.createElement('h3', 'title-lg');
        title.textContent = 'Wall Properties';
        this.element.appendChild(title);

        // Altura
        const heightGroup = this.createElement('div', 'property-group');
        const heightInput = this.createInput(
            'number',
            this.properties.height,
            (value) => this.handleChange('height', parseFloat(value)),
            {
                className: 'input-base',
                min: 1,
                step: 1
            }
        );

        const heightLabel = this.createElement('label');
        heightLabel.textContent = 'Height (cm):';
        heightLabel.appendChild(heightInput);
        heightGroup.appendChild(heightLabel);
        this.element.appendChild(heightGroup);

        // Grosor
        const thicknessGroup = this.createElement('div', 'property-group');
        const thicknessInput = this.createInput(
            'number',
            this.properties.thickness,
            (value) => this.handleChange('thickness', parseFloat(value)),
            {
                className: 'input-base',
                min: 1,
                step: 0.1
            }
        );

        const thicknessLabel = this.createElement('label');
        thicknessLabel.textContent = 'Thickness (cm):';
        thicknessLabel.appendChild(thicknessInput);
        thicknessGroup.appendChild(thicknessLabel);
        this.element.appendChild(thicknessGroup);

        // Material
        const materialGroup = this.createElement('div', 'property-group');
        const materialOptions = this.materials.map(material => ({
            value: material,
            label: material.charAt(0).toUpperCase() + material.slice(1)
        }));

        const materialSelect = this.createSelect(
            materialOptions,
            this.properties.material,
            (value) => this.handleChange('material', value)
        );

        const materialLabel = this.createElement('label');
        materialLabel.textContent = 'Material:';
        materialLabel.appendChild(materialSelect);
        materialGroup.appendChild(materialLabel);
        this.element.appendChild(materialGroup);

        // Emitir evento de renderizado completado
        this.emit('wall-properties:rendered', {
            wallId: this.wall.id,
            properties: this.properties
        });
    }

    private handleChange(property: keyof WallUpdateProperties, value: number | string): void {
        this.properties = { ...this.properties, [property]: value };
        this.onUpdate(this.wall.id, { [property]: value });
        
        // Emitir evento de cambio de propiedad
        this.emit('wall-properties:changed', {
            wallId: this.wall.id,
            property,
            value,
            properties: this.properties
        });
    }

    updateWall(wall: Wall): void {
        this.wall = wall;
        this.properties = {
            height: wall.height,
            thickness: wall.thickness,
            material: wall.material
        };
        this.render();

        // Emitir evento de actualización de muro
        this.emit('wall-properties:wall-updated', {
            wallId: wall.id,
            properties: this.properties
        });
    }

    // Override del método destroy para limpiar recursos
    destroy(): void {
        // Limpiar suscripciones y otros recursos
        this.cleanup();
        super.destroy();
    }
} 