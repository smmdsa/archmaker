export interface IPluginConfig {
    enabled: boolean;
    settings: Record<string, unknown>;
}

export interface IConfigManager {
    getPluginConfig(pluginId: string): IPluginConfig;
    updatePluginConfig(pluginId: string, config: Partial<IPluginConfig>): void;
    saveConfig(): Promise<void>;
    loadConfig(): Promise<void>;
    subscribe(callback: (pluginId: string, config: IPluginConfig) => void): () => void;
}

export interface GlobalConfig {
    plugins: Record<string, IPluginConfig>;
    theme: 'light' | 'dark';
    language: string;
    debug: boolean;
} 