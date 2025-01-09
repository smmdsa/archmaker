import { IEventManager } from '../managers/EventManager';

export type PluginStatus = 'inactive' | 'active' | 'error' | 'loading';

export interface PluginContext {
    eventManager: IEventManager;
    store: unknown; // TODO: Definir interfaz del store
    services: Record<string, unknown>;
}

export interface PluginMetadata {
    id: string;
    status: PluginStatus;
    error?: Error;
    activatedAt?: Date;
    deactivatedAt?: Date;
} 