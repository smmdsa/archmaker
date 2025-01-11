import { PluginManifest } from '../../interfaces/IPlugin';
import { pluginRegistry } from '../registry';
import { IPlugin } from '../../interfaces/IPlugin';
import { Constructor } from '../../types/Constructor';

export function Plugin<T extends Constructor<IPlugin>>(metadata: PluginManifest) {
    console.info('Plugin decorator called:', metadata);
    return function (constructor: T): T {
        console.info('Registering plugin:', metadata.id, metadata);
        pluginRegistry.register({
            metadata,
            implementation: constructor
        });
        return constructor;
    };
}

export function ToolPlugin<T extends Constructor<IPlugin>>(metadata: Omit<PluginManifest, 'type'> & {
    icon?: string;
    tooltip?: string;
    section?: string;
    order?: number;
    shortcut?: string;
}) {
    console.info('ToolPlugin decorator called:', metadata);
    return Plugin<T>({
        ...metadata,
        type: 'tool',
        dependencies: ['store'],
        icon: metadata.icon,
        tooltip: metadata.tooltip,
        section: metadata.section,
        order: metadata.order,
        shortcut: metadata.shortcut
    });
}

export function ServicePlugin<T extends Constructor<IPlugin>>(metadata: Omit<PluginManifest, 'type'>) {
    console.info('ServicePlugin decorator called:', metadata);
    return Plugin<T>({
        ...metadata,
        type: 'service'
    });
}

export function UIPlugin<T extends Constructor<IPlugin>>(metadata: Omit<PluginManifest, 'type'>) {
    console.info('UIPlugin decorator called:', metadata);
    return Plugin<T>({
        ...metadata,
        type: 'ui'
    });
} 