export interface IEventManager {
    on<T = void>(event: string, callback: (data: T) => void): void;
    off<T = void>(event: string, callback?: (data: T) => void): void;
    emit<T = void>(event: string, data: any): Promise<T>;
} 