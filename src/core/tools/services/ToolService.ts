import { ILogger } from '../../interfaces/ILogger';
import { IEventManager } from '../../interfaces/IEventManager';
import { IPlugin } from '../../interfaces/IPlugin';
import { CanvasEvent } from '../interfaces/ITool';
import { BaseTool } from '../BaseTool';

export class ToolService {
    private tools: Map<string, BaseTool> = new Map();
    private activeTool: BaseTool | null = null;
    private initialized: boolean = false;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {}

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logger.warn('ToolService already initialized');
            return;
        }

        try {
            // Subscribe to canvas events
            this.eventManager.on<CanvasEvent>('canvas:event', async (event) => {
                if (this.activeTool) {
                    try {
                        await this.activeTool.onCanvasEvent(event);
                    } catch (error) {
                        this.logger.error('Error in canvas event handler', error as Error);
                    }
                }
            });

            // Subscribe to tool activation events
            this.eventManager.on<{ toolId: string }>('tool:activate', async ({ toolId }) => {
                await this.activateTool(toolId);
            });

            // Subscribe to keyboard shortcuts
            window.addEventListener('keydown', (e) => {
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                    return;
                }

                const tool = Array.from(this.tools.values()).find(t => 
                    t.manifest.shortcut && t.manifest.shortcut.toLowerCase() === e.key.toLowerCase()
                );

                if (tool) {
                    this.activateTool(tool.manifest.id);
                    e.preventDefault();
                }
            });

            this.initialized = true;
            this.logger.info('ToolService initialized');
        } catch (error) {
            this.logger.error('Failed to initialize ToolService', error as Error);
            throw error;
        }
    }

    registerPlugin(plugin: IPlugin): void {
        if (!this.initialized) {
            throw new Error('ToolService not initialized');
        }

        if (!(plugin instanceof BaseTool)) {
            return;
        }

        const tool = plugin as BaseTool;
        this.tools.set(tool.manifest.id, tool);

        // Log registration with tool details
        this.logger.info(`Tool registered: ${tool.manifest.id}`, {
            name: tool.manifest.name,
            shortcut: tool.manifest.shortcut,
            section: tool.manifest.section,
            order: tool.manifest.order
        });

        // Emit tool registration event
        this.eventManager.emit('tool:registered', {
            toolId: tool.manifest.id,
            metadata: tool.manifest
        });
    }

    unregisterPlugin(pluginId: string): void {
        if (!this.initialized) {
            throw new Error('ToolService not initialized');
        }

        const tool = this.tools.get(pluginId);
        if (!tool) return;

        if (this.activeTool?.manifest.id === pluginId) {
            this.activeTool.deactivate().catch(error => {
                this.logger.error(`Failed to deactivate tool ${pluginId}`, error as Error);
            });
            this.activeTool = null;
        }

        this.tools.delete(pluginId);
        this.logger.info(`Tool unregistered: ${pluginId}`);

        // Emit tool unregistration event
        this.eventManager.emit('tool:unregistered', { toolId: pluginId });
    }

    async activateTool(toolId: string): Promise<void> {
        if (!this.initialized) {
            throw new Error('ToolService not initialized');
        }

        try {
            // Deactivate current tool if different
            if (this.activeTool && this.activeTool.manifest.id !== toolId) {
                await this.activeTool.deactivate();
                this.activeTool = null;
            }

            // Activate new tool
            const tool = this.tools.get(toolId);
            if (tool && (!this.activeTool || this.activeTool.manifest.id !== toolId)) {
                await tool.activate();
                this.activeTool = tool;
                
                // Emit tool activation event
                await this.eventManager.emit('tool:activated', {
                    toolId,
                    metadata: tool.manifest
                });

                this.logger.info(`Tool activated: ${toolId}`);
            }
        } catch (error) {
            this.logger.error(`Failed to activate tool ${toolId}`, error as Error);
            throw error;
        }
    }

    getActiveTool(): BaseTool | null {
        if (!this.initialized) {
            throw new Error('ToolService not initialized');
        }
        return this.activeTool;
    }

    getTool(toolId: string): BaseTool | undefined {
        if (!this.initialized) {
            throw new Error('ToolService not initialized');
        }
        return this.tools.get(toolId);
    }

    getTools(): BaseTool[] {
        if (!this.initialized) {
            throw new Error('ToolService not initialized');
        }
        return Array.from(this.tools.values())
            .sort((a, b) => (a.manifest.order || 0) - (b.manifest.order || 0));
    }

    getToolsBySection(section: string): BaseTool[] {
        return this.getTools().filter(tool => tool.manifest.section === section);
    }

    async dispose(): Promise<void> {
        if (!this.initialized) {
            this.logger.warn('ToolService not initialized or already disposed');
            return;
        }

        try {
            // Deactivate current tool
            if (this.activeTool) {
                await this.activeTool.deactivate();
                this.activeTool = null;
            }

            // Clear all tools
            this.tools.clear();

            // Remove event listeners
            window.removeEventListener('keydown', this.handleKeyDown);

            this.initialized = false;
            this.logger.info('ToolService disposed');
        } catch (error) {
            this.logger.error('Failed to dispose ToolService', error as Error);
            throw error;
        }
    }

    private handleKeyDown = (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        const tool = Array.from(this.tools.values()).find(t => 
            t.manifest.shortcut && t.manifest.shortcut.toLowerCase() === e.key.toLowerCase()
        );

        if (tool) {
            this.activateTool(tool.manifest.id);
            e.preventDefault();
        }
    };
} 