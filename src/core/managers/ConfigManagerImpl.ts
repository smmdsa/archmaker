import { IConfigManager } from '../interfaces/IConfig';
import { ILogger } from '../interfaces/ILogger';

interface PluginConfig {
    enabled: boolean;
    settings: Record<string, any>;
}

export class ConfigManagerImpl implements IConfigManager {
    private config: Map<string, PluginConfig> = new Map();

    constructor(private readonly logger: ILogger) {}

    async initialize(): Promise<void> {
        // Cargar configuración por defecto
        this.config.set('wall-tool', {
            enabled: true,
            settings: {
                defaultHeight: 280,
                defaultThickness: 20,
                defaultMaterial: 'default'
            }
        });

        this.config.set('room-tool', {
            enabled: true,
            settings: {
                defaultHeight: 280,
                defaultThickness: 20,
                defaultMaterial: 'default'
            }
        });

        this.logger.info('Config Manager initialized');
    }

    getPluginConfig(pluginId: string): PluginConfig {
        return this.config.get(pluginId) || {
            enabled: true,
            settings: {}
        };
    }

    async updatePluginConfig(pluginId: string, config: Partial<PluginConfig>): Promise<void> {
        const currentConfig = this.getPluginConfig(pluginId);
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