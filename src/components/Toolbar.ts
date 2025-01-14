import { ToolService } from '../core/tools/services/ToolService';
import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';

interface ToolInfo {
    id: string;
    name: string;
    icon: string;
    tooltip: string;
    section: string;
    order: number;
    shortcut?: string;
}

export class Toolbar {
    private container: HTMLElement;
    private buttons: Map<string, HTMLButtonElement> = new Map();

    constructor(
        containerId: string,
        private readonly toolService: ToolService,
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Toolbar container not found: ${containerId}`);
        }
        this.container = container;
        this.initialize();
    }

    private initialize(): void {
        this.logger.info('Initializing toolbar...');
        this.createToolbar();
        this.setupEventListeners();
    }

    private createToolbar(): void {
        this.container.innerHTML = '';
        this.container.className = 'toolbar';

        // Obtener todas las herramientas disponibles
        const tools = this.toolService.getTools().map(tool => ({
            id: tool.manifest.id,
            name: tool.manifest.name,
            icon: (tool.manifest as any).icon,
            tooltip: (tool.manifest as any).tooltip,
            section: (tool.manifest as any).section,
            order: (tool.manifest as any).order,
            shortcut: (tool.manifest as any).shortcut
        }));
        
        // Agrupar herramientas por sección
        const sections = new Map<string, ToolInfo[]>();
        tools.forEach(tool => {
            if (!sections.has(tool.section)) {
                sections.set(tool.section, []);
            }
            sections.get(tool.section)!.push(tool);
        });

        // Crear secciones y botones
        sections.forEach((sectionTools, sectionName) => {
            const section = this.createSection(sectionName);
            
            // Ordenar herramientas por orden
            sectionTools.sort((a, b) => a.order - b.order);
            
            // Crear botones para cada herramienta
            sectionTools.forEach(tool => {
                const button = this.createToolButton(tool);
                this.buttons.set(tool.id, button);
                section.appendChild(button);
            });

            this.container.appendChild(section);
        });
    }

    private createSection(name: string): HTMLDivElement {
        const section = document.createElement('div');
        section.className = 'toolbar-section';
        section.dataset.section = name;
        return section;
    }

    private setupEventListeners(): void {
        // Escuchar actualizaciones de herramientas
        this.eventManager.on<{ tools: ToolInfo[] }>('tools:updated', () => {
            this.updateToolbar();
        });

        // Escuchar cambios de herramienta activa
        this.eventManager.on<{ toolId: string }>('tool:activated', (data) => {
            this.updateActiveButton(data.toolId);
        });
    }

    private updateToolbar(): void {
        this.logger.debug('Updating toolbar...');
        // Limpiar botones existentes
        this.buttons.clear();
        this.container.innerHTML = '';
        this.createToolbar();
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

    private createToolButton(tool: ToolInfo): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'toolbar-button';
        button.innerHTML = tool.icon;
        button.title = tool.tooltip + (tool.shortcut ? ` (${tool.shortcut})` : '');
        button.dataset.toolId = tool.id;
        
        button.addEventListener('click', async () => {
            try {
                const toolInstance = this.toolService.getTool(tool.id);
                if (toolInstance) {
                    await toolInstance.activate();
                } else {
                    this.logger.error(`Tool not found: ${tool.id}`);
                }
            } catch (error) {
                this.logger.error(`Failed to activate tool: ${tool.id}`, error as Error);
            }
        });

        return button;
    }

    public dispose(): void {
        this.logger.info('Disposing toolbar...');
        // Limpiar botones
        this.buttons.clear();
        this.container.innerHTML = '';
    }
} 