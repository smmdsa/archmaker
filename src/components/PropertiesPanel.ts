import { ToolType } from './Toolbar';

export interface WallProperties {
    height: number;  // altura en centímetros
    thickness: number;  // grosor en centímetros
}

export class PropertiesPanel {
    private container: HTMLElement;
    private currentProperties: WallProperties = {
        height: 240,  // 2.4 metros por defecto
        thickness: 15  // 15 cm por defecto
    };
    private onPropertiesChange: (props: WallProperties) => void;

    constructor(containerId: string, onPropertiesChange: (props: WallProperties) => void) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Properties panel container not found');
        this.container = container;
        this.onPropertiesChange = onPropertiesChange;
        this.createPanel();
    }

    public updateForTool(tool: ToolType): void {
        this.container.style.display = tool === ToolType.WALL ? 'block' : 'none';
    }

    private createPanel(): void {
        this.container.innerHTML = '';
        this.container.className = 'properties-panel';

        // Título
        const title = document.createElement('h3');
        title.textContent = 'Wall Properties';
        this.container.appendChild(title);

        // Altura
        const heightContainer = document.createElement('div');
        heightContainer.className = 'property-container';
        
        const heightLabel = document.createElement('label');
        heightLabel.textContent = 'Height (cm):';
        
        const heightInput = document.createElement('input');
        heightInput.type = 'number';
        heightInput.value = this.currentProperties.height.toString();
        heightInput.min = '1';
        heightInput.max = '1000';
        heightInput.step = '1';
        
        const heightSlider = document.createElement('input');
        heightSlider.type = 'range';
        heightSlider.min = '100';
        heightSlider.max = '400';
        heightSlider.value = this.currentProperties.height.toString();
        
        heightContainer.appendChild(heightLabel);
        heightContainer.appendChild(heightInput);
        heightContainer.appendChild(heightSlider);

        // Grosor
        const thicknessContainer = document.createElement('div');
        thicknessContainer.className = 'property-container';
        
        const thicknessLabel = document.createElement('label');
        thicknessLabel.textContent = 'Thickness (cm):';
        
        const thicknessInput = document.createElement('input');
        thicknessInput.type = 'number';
        thicknessInput.value = this.currentProperties.thickness.toString();
        thicknessInput.min = '1';
        thicknessInput.max = '100';
        thicknessInput.step = '1';

        thicknessContainer.appendChild(thicknessLabel);
        thicknessContainer.appendChild(thicknessInput);

        // Agregar contenedores al panel
        this.container.appendChild(heightContainer);
        this.container.appendChild(thicknessContainer);

        // Estilos
        const style = document.createElement('style');
        style.textContent = `
            .properties-panel {
                background: white;
                padding: 15px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .properties-panel h3 {
                margin: 0 0 15px 0;
                font-size: 16px;
                color: #2c3e50;
            }

            .property-container {
                margin-bottom: 15px;
            }

            .property-container label {
                display: block;
                margin-bottom: 5px;
                color: #666;
                font-size: 14px;
            }

            .property-container input[type="number"] {
                width: 80px;
                padding: 5px;
                border: 1px solid #ddd;
                border-radius: 4px;
                margin-right: 10px;
            }

            .property-container input[type="range"] {
                width: 100%;
                margin: 10px 0;
            }
        `;
        document.head.appendChild(style);

        // Event listeners
        const updateProperties = () => {
            this.currentProperties = {
                height: parseInt(heightInput.value),
                thickness: parseInt(thicknessInput.value)
            };
            this.onPropertiesChange(this.currentProperties);
        };

        heightInput.addEventListener('change', () => {
            heightSlider.value = heightInput.value;
            updateProperties();
        });

        heightSlider.addEventListener('input', () => {
            heightInput.value = heightSlider.value;
            updateProperties();
        });

        thicknessInput.addEventListener('change', updateProperties);
    }

    public getCurrentProperties(): WallProperties {
        return { ...this.currentProperties };
    }
} 