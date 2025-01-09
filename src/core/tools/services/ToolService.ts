import { ITool, IToolContext } from '../interfaces/ITool';
import { ToolRepository } from '../repositories/ToolRepository';
import { EventBus } from '../../events/EventBus';

export class ToolService {
    private static instance: ToolService;
    private repository: ToolRepository;
    private eventBus: EventBus;

    private constructor() {
        this.repository = ToolRepository.getInstance();
        this.eventBus = EventBus.getInstance();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }

    static getInstance(): ToolService {
        if (!ToolService.instance) {
            ToolService.instance = new ToolService();
        }
        return ToolService.instance;
    }

    private setupEventListeners(): void {
        // Suscribirse a eventos relevantes del sistema
        this.eventBus.subscribe('canvas:update', () => {
            const activeTool = this.repository.getActiveTool();
            if (activeTool?.onCanvasUpdate) {
                activeTool.onCanvasUpdate();
            }
        });

        this.eventBus.subscribe('properties:change', (data) => {
            const activeTool = this.repository.getActiveTool();
            if (activeTool?.onPropertiesChange) {
                activeTool.onPropertiesChange(data);
            }
        });
    }

    private setupKeyboardShortcuts(): void {
        window.addEventListener('keydown', (event) => {
            // Ignorar si hay algún elemento de entrada enfocado
            if (event.target instanceof HTMLInputElement || 
                event.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Obtener todas las herramientas
            const tools = this.repository.getAllTools();
            
            // Buscar una herramienta que coincida con la tecla presionada
            const tool = tools.find(t => 
                t.shortcut && 
                t.shortcut.toLowerCase() === event.key.toLowerCase() && 
                !event.ctrlKey && 
                !event.altKey && 
                !event.metaKey
            );

            if (tool) {
                console.log(`🎯 Keyboard shortcut pressed: ${event.key} for tool: ${tool.id}`);
                this.activateTool(tool.id);
                event.preventDefault();
            }
        });
    }

    registerTool(tool: ITool): void {
        this.repository.registerTool(tool);
        this.eventBus.emit('tools:updated', this.getAvailableTools());
    }

    unregisterTool(toolId: string): void {
        this.repository.unregisterTool(toolId);
        this.eventBus.emit('tools:updated', this.getAvailableTools());
    }

    activateTool(toolId: string): void {
        const tool = this.repository.getTool(toolId);
        if (!tool) {
            console.warn(`Tool with id ${toolId} not found`);
            return;
        }

        console.log('🔧 Attempting to activate tool:', toolId);

        const currentTool = this.repository.getActiveTool();
        if (currentTool && currentTool.id !== toolId) {
            console.log('🔄 Deactivating current tool:', currentTool.id);
            currentTool.deactivate();
        }

        if (!tool.isActive()) {
            console.log('✨ Activating tool:', toolId);
            tool.activate();
            this.repository.setActiveTool(toolId);
        } else {
            console.log('ℹ️ Tool already active:', toolId);
        }
    }

    getActiveTool(): ITool | null {
        return this.repository.getActiveTool();
    }

    getAvailableTools(): ITool[] {
        return this.repository.getAllTools();
    }

    // Métodos para manejar eventos del canvas
    handleMouseDown(context: IToolContext): void {
        const activeTool = this.repository.getActiveTool();
        if (activeTool?.onMouseDown) {
            activeTool.onMouseDown(context);
        }
    }

    handleMouseMove(context: IToolContext): void {
        const activeTool = this.repository.getActiveTool();
        if (activeTool?.onMouseMove) {
            activeTool.onMouseMove(context);
        }
    }

    handleMouseUp(context: IToolContext): void {
        const activeTool = this.repository.getActiveTool();
        if (activeTool?.onMouseUp) {
            activeTool.onMouseUp(context);
        }
    }

    handleKeyDown(event: KeyboardEvent): void {
        const activeTool = this.repository.getActiveTool();
        if (activeTool?.onKeyDown) {
            activeTool.onKeyDown(event);
        }
    }

    handleKeyUp(event: KeyboardEvent): void {
        const activeTool = this.repository.getActiveTool();
        if (activeTool?.onKeyUp) {
            activeTool.onKeyUp(event);
        }
    }

    // Cleanup
    dispose(): void {
        this.repository.clear();
        // Limpiar suscripciones de eventos si es necesario
    }
} 