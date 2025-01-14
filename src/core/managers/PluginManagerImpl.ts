import { IPlugin, PluginManifest } from '../interfaces/IPlugin';
import { IPluginManager } from './PluginManager';
import { IEventManager } from './EventManager';
import { ILogger } from '../interfaces/ILogger';
import { IConfigManager } from '../interfaces/IConfig';
import { PluginErrorCode, PluginErrorImpl } from '../types/errors';
import { PluginMetadata } from '../types/plugin';
import { IService, IServiceProvider } from '../interfaces/IService';

export class PluginManagerImpl implements IPluginManager, IServiceProvider {
    private plugins: Map<string, IPlugin> = new Map();
    private metadata: Map<string, PluginMetadata> = new Map();
    private services: Map<string, IService> = new Map();

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager
    ) {}

    public register(plugin: IPlugin): void {
        if (this.plugins.has(plugin.manifest.id)) {
            throw new PluginErrorImpl(
                plugin.manifest.id,
                PluginErrorCode.PLUGIN_ALREADY_REGISTERED,
                `Plugin ${plugin.manifest.id} is already registered`
            );
        }

        // Verificar si el plugin está habilitado en la configuración
        const config = this.configManager.getPluginConfig(plugin.manifest.id);
        if (!config.enabled) {
            this.logger.warn(`Plugin ${plugin.manifest.id} is disabled in configuration`);
            return;
        }

        this.validateManifest(plugin.manifest);
        this.plugins.set(plugin.manifest.id, plugin);
        this.metadata.set(plugin.manifest.id, {
            id: plugin.manifest.id,
            status: 'inactive'
        });

        // Emitir evento de registro
        this.eventManager.emit('plugin:registered', {
            pluginId: plugin.manifest.id,
            manifest: plugin.manifest
        });

        this.logger.info(`Plugin ${plugin.manifest.id} registered`);
    }

    public unregister(pluginId: string): void {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new PluginErrorImpl(
                pluginId,
                PluginErrorCode.SERVICE_NOT_FOUND,
                `Plugin ${pluginId} not found`
            );
        }

        this.plugins.delete(pluginId);
        this.metadata.delete(pluginId);
        this.logger.info(`Plugin ${pluginId} unregistered`);
    }

    public getPlugin(pluginId: string): IPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    public async activatePlugins(): Promise<void> {
        for (const [id, plugin] of this.plugins) {
            try {
                await plugin.initialize();
                if (plugin.activate) {
                    await plugin.activate();
                }
                this.logger.info(`Plugin activated: ${id}`);
            } catch (error) {
                this.logger.error(`Failed to activate plugin: ${id}`, error instanceof Error ? error : new Error(String(error)));
            }
        }
    }

    public async deactivatePlugins(): Promise<void> {
        for (const [id, plugin] of this.plugins) {
            try {
                if (plugin.deactivate) {
                    await plugin.deactivate();
                }
                this.logger.info(`Plugin deactivated: ${id}`);
            } catch (error) {
                this.logger.error(`Failed to deactivate plugin: ${id}`, error instanceof Error ? error : new Error(String(error)));
            }
        }
    }

    public async activatePlugin(pluginId: string): Promise<void> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new PluginErrorImpl(
                pluginId,
                PluginErrorCode.PLUGIN_NOT_FOUND,
                `Plugin not found: ${pluginId}`
            );
        }
        if (plugin.activate) {
            await plugin.activate();
        }
        this.logger.info(`Plugin activated: ${pluginId}`);
    }

    public async deactivatePlugin(pluginId: string): Promise<void> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new PluginErrorImpl(
                pluginId,
                PluginErrorCode.PLUGIN_NOT_FOUND,
                `Plugin not found: ${pluginId}`
            );
        }
        if (plugin.deactivate) {
            await plugin.deactivate();
        }
        this.logger.info(`Plugin deactivated: ${pluginId}`);
    }

    private validateManifest(manifest: PluginManifest): void {
        if (!manifest.id || !manifest.name || !manifest.version) {
            throw new PluginErrorImpl(
                manifest.id || 'unknown',
                PluginErrorCode.INVALID_MANIFEST,
                'Invalid manifest: missing required fields'
            );
        }

        // Validar dependencias si existen
        if (manifest.dependencies && manifest.dependencies.length > 0) {
            for (const depId of manifest.dependencies) {
                if (!this.plugins.has(depId)) {
                    throw new PluginErrorImpl(
                        manifest.id,
                        PluginErrorCode.DEPENDENCY_NOT_FOUND,
                        `Dependency ${depId} not found`
                    );
                }
            }
        }
    }

    // Implementación de IServiceProvider
    public getService<T extends IService>(serviceId: string): T | undefined {
        return this.services.get(serviceId) as T;
    }

    public registerService(service: IService): void {
        if (this.services.has(service.id)) {
            throw new Error(`Service ${service.id} is already registered`);
        }
        this.services.set(service.id, service);
    }

    public unregisterService(serviceId: string): void {
        this.services.delete(serviceId);
    }
} 