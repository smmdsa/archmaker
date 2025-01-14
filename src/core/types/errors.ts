export interface PluginError extends Error {
    pluginId: string;
    code: string;
}

export enum PluginErrorCode {
    PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
    SERVICE_NOT_FOUND = 'SERVICE_NOT_FOUND',
    ACTIVATION_FAILED = 'ACTIVATION_FAILED',
    DEACTIVATION_FAILED = 'DEACTIVATION_FAILED',
    INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
    INVALID_MANIFEST = 'INVALID_MANIFEST',
    DEPENDENCY_NOT_FOUND = 'DEPENDENCY_NOT_FOUND',
    PLUGIN_ALREADY_REGISTERED = 'PLUGIN_ALREADY_REGISTERED'
}

export class PluginErrorImpl extends Error implements PluginError {
    constructor(
        public pluginId: string,
        public code: string,
        message: string
    ) {
        super(message);
        this.name = 'PluginError';
    }
} 