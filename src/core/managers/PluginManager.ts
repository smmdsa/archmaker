import { IPlugin } from '../interfaces/IPlugin';

export interface IPluginManager {
    register(plugin: IPlugin): void;
    unregister(pluginId: string): void;
    getPlugin(pluginId: string): IPlugin | undefined;
    activatePlugins(): Promise<void>;
    deactivatePlugins(): Promise<void>;
    activatePlugin(pluginId: string): Promise<void>;
    deactivatePlugin(pluginId: string): Promise<void>;
}