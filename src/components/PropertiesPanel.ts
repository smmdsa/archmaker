import { EventBus } from '../core/events/EventBus';
import { ToolService } from '../core/tools/services/ToolService';

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
    private eventBus: EventBus;
    private toolService: ToolService;

    constructor(containerId: string, onPropertiesChange: (props: WallProperties) => void) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Properties panel container not found');
        this.container = container;
        
        this.eventBus = EventBus.getInstance();
        this.toolService = ToolService.getInstance();

        // Suscribirse a los eventos de cambio de propiedades
        this.eventBus.subscribe('wall:properties-updated', onPropertiesChange);
        
        this.createPanel();
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Escuchar cambios de herramienta activa a través del sistema de eventos
        this.eventBus.subscribe('tool:activated', (tool) => {
            if (!tool || !tool.id) {
                console.warn('Received invalid tool data in tool:activated event');
                this.container.style.display = 'none';
                return;
            }

            // Mostrar el panel solo si la herramienta activa es WallTool
            this.container.style.display = tool.id.startsWith('wall:') ? 'block' : 'none';
        });

        // Escuchar actualizaciones de propiedades
        this.eventBus.subscribe('wall:properties-changed', (properties: WallProperties) => {
            this.updateProperties(properties);
        });
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
            this.eventBus.emit('wall:properties-updated', this.currentProperties);
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

    private updateProperties(props: WallProperties): void {
        this.currentProperties = { ...props };
        
        // Actualizar inputs
        const heightInput = this.container.querySelector('input[type="number"]') as HTMLInputElement;
        const heightSlider = this.container.querySelector('input[type="range"]') as HTMLInputElement;
        const thicknessInput = this.container.querySelectorAll('input[type="number"]')[1] as HTMLInputElement;

        if (heightInput && heightSlider && thicknessInput) {
            heightInput.value = props.height.toString();
            heightSlider.value = props.height.toString();
            thicknessInput.value = props.thickness.toString();
        }
    }

    public getCurrentProperties(): WallProperties {
        return { ...this.currentProperties };
    }

    public dispose(): void {
        // Limpiar event listeners
        this.eventBus.unsubscribe('tool:activated');
        this.eventBus.unsubscribe('wall:properties-changed');
        this.eventBus.unsubscribe('wall:properties-updated');
    }
} 