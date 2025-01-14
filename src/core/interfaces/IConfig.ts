import { IDrawingToolConfig } from '../tools/interfaces/IDrawingProperties';

export interface PluginConfig {
    id: string;
    version: string;
    enabled: boolean;
    settings: Record<string, any>;
}

export interface IConfigManager {
    getPluginConfig(pluginId: string): PluginConfig | undefined;
    setPluginConfig(pluginId: string, config: Partial<PluginConfig>): Promise<void>;
    updatePluginConfig(pluginId: string, config: Partial<PluginConfig>): Promise<void>;
    saveConfig(): Promise<void>;
    loadConfig(): Promise<void>;
    subscribe(callback: () => void): () => void;
}

export interface GlobalConfig {
    plugins: Record<string, PluginConfig>;
    theme: 'light' | 'dark';
    language: string;
} 