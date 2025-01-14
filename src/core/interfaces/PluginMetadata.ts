/**
 * Metadata for plugin registration
 */
export interface PluginMetadata {
    id: string;
    name: string;
    version: string;
    description?: string;
    type: 'tool' | 'topbar' | 'viewport';
    dependencies?: string[];
} 