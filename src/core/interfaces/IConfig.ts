import { IDrawingToolConfig } from '../tools/interfaces/IDrawingProperties';

export interface PluginConfig {
    id: string;
    version: string;
    enabled: boolean;
    drawing?: IDrawingToolConfig;
    [key: string]: any;
}

export interface IConfigManager {
    getPluginConfig(pluginId: string): PluginConfig | undefined;
    setPluginConfig(pluginId: string, config: Partial<PluginConfig>): void;
}

export interface GlobalConfig {
    plugins: Record<string, IPluginConfig>;
    theme: 'light' | 'dark';
    language: string;
    debug: boolean;
} 