import { IConfigManager } from '../interfaces/IConfig';
import { ILogger } from '../interfaces/ILogger';

interface PluginConfig {
    id: string;
    version: string;
    enabled: boolean;
    settings: Record<string, any>;
}
//TODO: Implementar la configuración de los plugins
export class ConfigManagerImpl implements IConfigManager {
    private config: Map<string, PluginConfig> = new Map();

    constructor(private readonly logger: ILogger) {}

    async initialize(): Promise<void> {
        this.logger.info('Config Manager initialized');
    }

    getPluginConfig(pluginId: string): PluginConfig | undefined {
        return this.config.get(pluginId);
    }

    async setPluginConfig(pluginId: string, config: Partial<PluginConfig>): Promise<void> {
        const currentConfig = this.getPluginConfig(pluginId);
        this.logger.info(`Setting config for plugin: ${pluginId}`, config);
        if (!currentConfig) return;

        this.config.set(pluginId, {
            ...currentConfig,
            ...config,
            settings: {
                ...currentConfig.settings,
                ...config.settings
            }
        });
        this.logger.info(`Updated config for plugin: ${pluginId}`, config);
    }

    async updatePluginConfig(pluginId: string, config: Partial<PluginConfig>): Promise<void> {
        const currentConfig = this.getPluginConfig(pluginId);
        if (!currentConfig) return;

        await this.setPluginConfig(pluginId, config);
    }

    async saveConfig(): Promise<void> {
        // En una implementación real, aquí guardaríamos la configuración en localStorage o en el servidor
        this.logger.info('Config saved');
    }

    async loadConfig(): Promise<void> {
        // En una implementación real, aquí cargaríamos la configuración desde localStorage o el servidor
        this.logger.info('Config loaded');
    }

    subscribe(callback: () => void): () => void {
        // En una implementación real, aquí manejaríamos las suscripciones a cambios en la configuración
        return () => {};
    }
} 