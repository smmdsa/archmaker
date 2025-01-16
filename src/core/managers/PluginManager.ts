import { IPlugin, PluginType } from '../interfaces/IPlugin';
import { ILogger } from '../interfaces/ILogger';
import { IEventManager } from '../interfaces/IEventManager';
import { UIRegionManager } from '../ui/UIRegionManager';
import { BaseTool } from '../tools/BaseTool';
import { IPluginManager } from '../interfaces/IPluginManager';

export class PluginManager implements IPluginManager {
    private plugins: Map<string, IPlugin> = new Map();

    constructor(
        private readonly logger: ILogger,
        private readonly eventManager: IEventManager,
        private readonly uiManager: UIRegionManager
    ) {}

    async initialize(): Promise<void> {
        try {
            this.logger.info('Initializing Plugin Manager');
            await this.uiManager.initialize();
        } catch (error) {
            this.logger.error('Failed to initialize Plugin Manager', error as Error);
            throw error;
        }
    }

    async registerPlugin(plugin: IPlugin): Promise<void> {
        try {
            if (this.plugins.has(plugin.manifest.id)) {
                throw new Error(`Plugin ${plugin.manifest.id} is already registered`);
            }

            await plugin.initialize();
            this.plugins.set(plugin.manifest.id, plugin);

            // Register UI components if they exist
            const uiComponents = plugin.getUIComponents?.();
            if (uiComponents) {
                for (const component of uiComponents) {
                    this.uiManager.registerComponent(component);
                }
            }

            // Log registration with plugin type
            const type = plugin instanceof BaseTool ? 'tool' : plugin.manifest.type;
            this.logger.info(`Plugin ${plugin.manifest.id} registered successfully`, { type });

            // Emit plugin registration event
            await this.eventManager.emit('plugin:registered', {
                pluginId: plugin.manifest.id,
                type
            });
        } catch (error) {
            this.logger.error(`Failed to register plugin ${plugin.manifest.id}`, error as Error);
            throw error;
        }
    }

    async unregisterPlugin(pluginId: string): Promise<void> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} is not registered`);
        }

        try {
            // Unregister UI components if they exist
            const uiComponents = plugin.getUIComponents?.();
            if (uiComponents) {
                for (const component of uiComponents) {
                    this.uiManager.unregisterComponent(component.id);
                }
            }

            await plugin.dispose();
            this.plugins.delete(pluginId);

            // Log unregistration
            this.logger.info(`Plugin ${pluginId} unregistered successfully`);

            // Emit plugin unregistration event
            await this.eventManager.emit('plugin:unregistered', {
                pluginId
            });
        } catch (error) {
            this.logger.error(`Failed to unregister plugin ${pluginId}`, error as Error);
            throw error;
        }
    }

    getPlugin(pluginId: string): IPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    getPluginsByType(type: PluginType): IPlugin[] {
        return Array.from(this.plugins.values())
            .filter(plugin => {
                if (type === 'tool') {
                    return plugin instanceof BaseTool;
                }
                return plugin.manifest.type === type;
            });
    }
}