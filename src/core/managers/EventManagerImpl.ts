import { IEventManager } from './EventManager';
import { ILogger } from '../interfaces/ILogger';

type EventCallback = (data: any) => void | Promise<void>;

export class EventManagerImpl implements IEventManager {
    private eventMap: Map<string, Set<EventCallback>> = new Map();

    constructor(private logger: ILogger) {}

    public on(event: string, callback: EventCallback): void {
        if (!this.eventMap.has(event)) {
            this.eventMap.set(event, new Set());
        }
        this.eventMap.get(event)!.add(callback);
        this.logger.debug(`Registered listener for event: ${event}`);
    }

    public off(event: string, callback: EventCallback): void {
        const callbacks = this.eventMap.get(event);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.eventMap.delete(event);
            }
            this.logger.debug(`Removed listener for event: ${event}`);
        }
    }

    public async emit(event: string, data: any): Promise<void> {
        const callbacks = this.eventMap.get(event);
        if (!callbacks) return;

        this.logger.debug(`Emitting event: ${event}`, data);
        
        const promises: Promise<void>[] = [];
        
        for (const callback of callbacks) {
            try {
                const result = callback(data);
                if (result instanceof Promise) {
                    promises.push(result);
                }
            } catch (error) {
                this.logger.error(`Error in event listener for ${event}`, error as Error);
            }
        }

        if (promises.length > 0) {
            try {
                await Promise.all(promises);
            } catch (error) {
                this.logger.error(`Error in async event listener for ${event}`, error as Error);
            }
        }
    }

    public getListenerCount(event: string): number {
        return this.eventMap.get(event)?.size || 0;
    }

    public clearAllListeners(): void {
        this.eventMap.clear();
        this.logger.info('Cleared all event listeners');
    }
} 