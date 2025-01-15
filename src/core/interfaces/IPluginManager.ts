import { IPlugin, PluginType } from './IPlugin';

export interface IPluginManager {
    initialize(): Promise<void>;
    registerPlugin(plugin: IPlugin): Promise<void>;
    unregisterPlugin(pluginId: string): Promise<void>;
    getPlugin(pluginId: string): IPlugin | undefined;
    getPluginsByType(type: PluginType): IPlugin[];
} 