/**
 * @module core/plugins/registry
 * @description Plugin registry system for managing and instantiating application plugins
 */

import { IPlugin, PluginManifest } from '../interfaces/IPlugin';
import { IEventManager } from '../interfaces/IEventManager';
import { ILogger } from '../interfaces/ILogger';
import { IConfigManager } from '../interfaces/IConfig';
import { ProjectStore } from '../../store/ProjectStore';
import { Constructor } from '../types/Constructor';

export interface PluginRegistration {
    metadata: PluginManifest;
    implementation: Constructor<IPlugin>;
}

/**
 * Singleton registry class that manages plugin registration and instantiation
 */
class PluginRegistry {
    private static instance: PluginRegistry;
    private plugins: Map<string, PluginRegistration> = new Map();
    private logger?: ILogger;

    private constructor() {}

    static getInstance(): PluginRegistry {
        if (!PluginRegistry.instance) {
            PluginRegistry.instance = new PluginRegistry();
        }
        return PluginRegistry.instance;
    }

    register(registration: PluginRegistration): void {
        const { metadata } = registration;
        if (this.plugins.has(metadata.id)) {
            this.log('warn', `Plugin ${metadata.id} is already registered. Skipping registration.`);
            return;
        }
        this.plugins.set(metadata.id, registration);
        this.log('info', `Plugin registered: ${metadata.id}`, {
            type: metadata.type,
            name: metadata.name,
            version: metadata.version
        });
    }

    createPlugins(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager,
        store: ProjectStore
    ): IPlugin[] {
        this.logger = logger;
        const instances: IPlugin[] = [];

        this.log('info', `Creating plugins... Registry has ${this.plugins.size} plugins registered:`, 
            Array.from(this.plugins.entries()).map(([id, reg]) => ({
                id,
                type: reg.metadata.type,
                name: reg.metadata.name
            }))
        );

        for (const [id, registration] of this.plugins) {
            try {
                const { metadata, implementation: Constructor } = registration;
                this.log('info', `Creating plugin instance: ${id}`, {
                    type: metadata.type,
                    name: metadata.name,
                    dependencies: metadata.dependencies
                });

                const args = metadata.dependencies?.includes('store')
                    ? [eventManager, logger, configManager, store]
                    : [eventManager, logger, configManager];

                const instance = new Constructor(...args);
                instances.push(instance);
                
                this.log('info', `Plugin ${id} created successfully`, { type: metadata.type });
            } catch (error) {
                this.log('error', `Failed to create plugin ${id}`, error as Error);
            }
        }

        this.log('info', `Created ${instances.length} plugin instances`);
        return instances;
    }

    getPlugin(id: string): PluginRegistration | undefined {
        return this.plugins.get(id);
    }

    getAllPlugins(): PluginRegistration[] {
        return Array.from(this.plugins.values());
    }

    getPluginsByType(type: PluginManifest['type']): PluginRegistration[] {
        return Array.from(this.plugins.values()).filter(
            plugin => plugin.metadata.type === type
        );
    }

    clear(): void {
        this.plugins.clear();
        this.log('info', 'Plugin registry cleared');
    }

    private log(level: 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
        if (!this.logger) {
            console[level](message, ...args);
            return;
        }

        switch (level) {
            case 'info':
                this.logger.info(message, ...args);
                break;
            case 'warn':
                this.logger.warn(message, ...args);
                break;
            case 'error':
                this.logger.error(message, ...args);
                break;
        }
    }
}

export const pluginRegistry = PluginRegistry.getInstance();
