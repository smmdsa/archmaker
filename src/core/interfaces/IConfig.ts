export interface PluginConfig {
    enabled: boolean;
    settings: Record<string, any>;
}

export interface IConfigManager {
    initialize(): Promise<void>;
    getPluginConfig(pluginId: string): PluginConfig;
    updatePluginConfig(pluginId: string, config: Partial<PluginConfig>): Promise<void>;
    saveConfig(): Promise<void>;
    loadConfig(): Promise<void>;
    subscribe(callback: () => void): () => void;
}

export interface GlobalConfig {
    plugins: Record<string, IPluginConfig>;
    theme: 'light' | 'dark';
    language: string;
    debug: boolean;
} 