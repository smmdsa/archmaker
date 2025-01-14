import { UIComponentManifest } from './IUIRegion';

export type PluginType = 'tool' | 'service' | 'ui';

export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    type: PluginType;
    description?: string;
    author?: string;
    dependencies?: string[];
    uiComponents?: UIComponentManifest[];
    shortcut?: string;
    icon?: string;
    tooltip?: string;
    section?: string;
    order?: number;
}

export interface IPlugin {
    /**
     * Plugin manifest
     */
    readonly manifest: PluginManifest;

    /**
     * Initialize plugin
     */
    initialize(): Promise<void>;

    /**
     * Dispose plugin resources
     */
    dispose(): Promise<void>;

    /**
     * Get plugin UI components
     */
    getUIComponents?(): UIComponentManifest[];
}