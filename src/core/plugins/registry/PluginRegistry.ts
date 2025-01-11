import { IPlugin } from '../../interfaces/IPlugin';
import { IEventManager } from '../../interfaces/IEventManager';
import { ILogger } from '../../interfaces/ILogger';
import { IConfigManager } from '../../interfaces/IConfig';
import { ProjectStore } from '../../../store/ProjectStore';
import { PluginMetadata } from '../interfaces/PluginMetadata';
import { Constructor } from '../../types/Constructor';

export interface PluginRegistration {
    metadata: PluginMetadata;
    implementation: Constructor<IPlugin>;
}

export class PluginRegistry {
    private static instance: PluginRegistry;
    private plugins: Map<string, PluginRegistration> = new Map();
    private pluginInstances: Map<string, IPlugin> = new Map();

    private constructor() {}

    static getInstance(): PluginRegistry {
        if (!PluginRegistry.instance) {
            PluginRegistry.instance = new PluginRegistry();
        }
        return PluginRegistry.instance;
    }

    register(registration: PluginRegistration): void {
        const { metadata } = registration;
        if (this.plugins.has(metadata.id)) {
            throw new Error(`Plugin ${metadata.id} already registered`);
        }
        this.plugins.set(metadata.id, registration);
    }

    createPlugins(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager,
        store: ProjectStore
    ): IPlugin[] {
        const instances: IPlugin[] = [];

        for (const [id, registration] of this.plugins) {
            try {
                const { metadata, implementation: Constructor } = registration;
                const args = metadata.dependencies?.includes('store')
                    ? [eventManager, logger, configManager, store]
                    : [eventManager, logger, configManager];

                const instance = new Constructor(...args);
                this.pluginInstances.set(id, instance);
                instances.push(instance);
                
                logger.info(`Plugin ${id} created successfully`, { type: metadata.type });
            } catch (error) {
                logger.error(`Failed to create plugin ${id}`, error as Error);
            }
        }

        return instances;
    }

    getPluginsByType(type: string): IPlugin[] {
        return Array.from(this.pluginInstances.values())
            .filter(plugin => {
                const registration = this.plugins.get(plugin.id);
                return registration?.metadata.type === type;
            });
    }

    getPlugin(id: string): IPlugin | undefined {
        return this.pluginInstances.get(id);
    }

    getAllPlugins(): IPlugin[] {
        return Array.from(this.pluginInstances.values());
    }
}

// Export singleton instance
export const pluginRegistry = PluginRegistry.getInstance(); 