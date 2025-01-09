import { ITool } from '../interfaces/ITool';

export class ToolRepository {
    private static instance: ToolRepository;
    private tools: Map<string, ITool>;
    private activeToolId: string | null = null;

    private constructor() {
        this.tools = new Map();
    }

    static getInstance(): ToolRepository {
        if (!ToolRepository.instance) {
            ToolRepository.instance = new ToolRepository();
        }
        return ToolRepository.instance;
    }

    registerTool(tool: ITool): void {
        if (this.tools.has(tool.id)) {
            console.warn(`Tool with id ${tool.id} is already registered. Skipping registration.`);
            return;
        }
        this.tools.set(tool.id, tool);
    }

    unregisterTool(toolId: string): void {
        const tool = this.tools.get(toolId);
        if (tool) {
            if (tool.isActive) {
                tool.deactivate();
            }
            tool.dispose();
            this.tools.delete(toolId);
        }
    }

    getTool(toolId: string): ITool | undefined {
        return this.tools.get(toolId);
    }

    getAllTools(): ITool[] {
        return Array.from(this.tools.values());
    }

    activateTool(toolId: string): void {
        // Desactivar la herramienta actual si existe
        if (this.activeToolId) {
            const currentTool = this.tools.get(this.activeToolId);
            if (currentTool) {
                currentTool.deactivate();
            }
        }

        // Activar la nueva herramienta
        const newTool = this.tools.get(toolId);
        if (newTool) {
            newTool.activate();
            this.activeToolId = toolId;
        }
    }

    getActiveTool(): ITool | undefined {
        return this.activeToolId ? this.tools.get(this.activeToolId) : undefined;
    }

    clear(): void {
        this.tools.forEach(tool => {
            if (tool.isActive) {
                tool.deactivate();
            }
            tool.dispose();
        });
        this.tools.clear();
        this.activeToolId = null;
    }

    setActiveTool(toolId: string): void {
        if (!this.tools.has(toolId)) {
            throw new Error(`Tool with id ${toolId} not found`);
        }
        this.activeToolId = toolId;
    }
} 