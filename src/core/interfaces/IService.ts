export interface IService {
    id: string;
    initialize(): Promise<void>;
    dispose(): Promise<void>;
}

export interface IServiceProvider {
    getService<T extends IService>(serviceId: string): T | undefined;
    registerService(service: IService): void;
    unregisterService(serviceId: string): void;
}

export interface ServiceMetadata {
    id: string;
    type: string;
    provider: string;
    dependencies?: string[];
} 