import { ToolService } from '../core/tools/services/ToolService';
import { ITool } from '../core/tools/interfaces/ITool';
import { EventBus } from '../core/events/EventBus';

export class Toolbar {
    private container: HTMLElement;
    private toolService: ToolService;
    private eventBus: EventBus;
    private buttons: Map<string, HTMLButtonElement> = new Map();
    private unsubscribeFunctions: (() => void)[] = [];

    constructor(containerId: string) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Toolbar container not found');
        this.container = container;
        
        this.toolService = ToolService.getInstance();
        this.eventBus = EventBus.getInstance();
        this.createToolbar();
        this.setupEventListeners();
    }

    private createToolbar(): void {
        this.container.innerHTML = '';
        this.container.className = 'toolbar';

        // Obtener todas las herramientas disponibles
        const tools = this.toolService.getAvailableTools();
        
        // Crear botones para cada herramienta
        tools.forEach(tool => {
            const button = this.createToolButton(tool);
            this.buttons.set(tool.id, button);
            this.container.appendChild(button);
        });
    }

    private setupEventListeners(): void {
        // Escuchar actualizaciones de herramientas
        const unsubTools = this.eventBus.subscribe('tools:updated', (tools: ITool[]) => {
            this.updateToolbar(tools);
        });
        this.unsubscribeFunctions.push(unsubTools);

        // Escuchar cambios de herramienta activa
        const unsubActiveTool = this.eventBus.subscribe('tool:activated', (tool: ITool) => {
            this.updateActiveButton(tool.id);
        });
        this.unsubscribeFunctions.push(unsubActiveTool);
    }

    private updateToolbar(tools: ITool[]): void {
        // Limpiar botones existentes
        this.buttons.clear();
        this.container.innerHTML = '';

        // Crear nuevos botones
        tools.forEach(tool => {
            const button = this.createToolButton(tool);
            this.buttons.set(tool.id, button);
            this.container.appendChild(button);
        });
    }

    private updateActiveButton(activeToolId: string): void {
        // Desactivar todos los botones
        this.buttons.forEach(button => {
            button.classList.remove('active');
        });

        // Activar el botón de la herramienta actual
        const activeButton = this.buttons.get(activeToolId);
        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    private createToolButton(tool: ITool): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'toolbar-button';
        button.innerHTML = tool.icon || '';
        button.title = `${tool.name}${tool.shortcut ? ` (${tool.shortcut})` : ''}`;
        
        button.addEventListener('click', () => {
            this.toolService.activateTool(tool.id);
        });

        return button;
    }

    public dispose(): void {
        // Limpiar event listeners
        this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
        this.unsubscribeFunctions = [];
        
        // Limpiar botones
        this.buttons.clear();
        this.container.innerHTML = '';
    }
} 