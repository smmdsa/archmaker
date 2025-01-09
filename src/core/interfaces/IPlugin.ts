export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    dependencies: string[];
}

export interface IPlugin {
    readonly id: string;
    readonly manifest: PluginManifest;
    initialize(): Promise<void>;
    dispose(): Promise<void>;
    activate?(): Promise<void>;
    deactivate?(): Promise<void>;
}