export type EventCallback = (data: any) => void | Promise<void>;

export interface IEventManager {
    on(event: string, callback: EventCallback): void;
    off(event: string, callback: EventCallback): void;
    emit(event: string, data: any): Promise<void>;
    getListenerCount(event: string): number;
    clearAllListeners(): void;
}