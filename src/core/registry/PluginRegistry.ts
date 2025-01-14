import { IPlugin } from '../interfaces/IPlugin';
import { PluginMetadata } from '../interfaces/PluginMetadata';
import { Constructor } from '../types/Constructor';

interface PluginRegistration {
    metadata: PluginMetadata;
    implementation: Constructor<IPlugin>;
}

export class PluginRegistry {
    private static instance: PluginRegistry;
    private plugins: Map<string, PluginRegistration>;

    private constructor() {
        this.plugins = new Map();
    }

    static getInstance(): PluginRegistry {
        if (!PluginRegistry.instance) {
            PluginRegistry.instance = new PluginRegistry();
        }
        return PluginRegistry.instance;
    }

    register(registration: { metadata: PluginMetadata; implementation: Constructor<IPlugin> }): void {
        const { metadata } = registration;
        if (this.plugins.has(metadata.id)) {
            console.warn(`Plugin ${metadata.id} is already registered. Skipping registration.`);
            return;
        }
        this.plugins.set(metadata.id, registration);
    }

    getPlugin(id: string): PluginRegistration | undefined {
        return this.plugins.get(id);
    }

    getAllPlugins(): PluginRegistration[] {
        return Array.from(this.plugins.values());
    }

    getPluginsByType(type: PluginMetadata['type']): PluginRegistration[] {
        return Array.from(this.plugins.values()).filter(
            plugin => plugin.metadata.type === type
        );
    }

    clear(): void {
        this.plugins.clear();
    }
}

// Export singleton instance
export const pluginRegistry = PluginRegistry.getInstance(); 