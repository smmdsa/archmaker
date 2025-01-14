import { IEventManager } from '../interfaces/IEventManager';
import { ILogger } from '../interfaces/ILogger';

type EventCallback<T = any> = (data: T) => void | Promise<void> | T;

export class EventManagerImpl implements IEventManager {
    readonly id = 'event-manager';
    private eventMap: Map<string, Set<EventCallback>> = new Map();

    constructor(private readonly logger: ILogger) {}

    public on<T = void>(event: string, callback: (data: T) => void): void {
        if (!this.eventMap.has(event)) {
            this.eventMap.set(event, new Set());
        }
        this.eventMap.get(event)!.add(callback as EventCallback);
        this.logger.debug(`Registered listener for event: ${event}`);
    }

    public off<T = void>(event: string, callback?: (data: T) => void): void {
        if (!callback) {
            this.eventMap.delete(event);
            this.logger.debug(`Removed all listeners for event: ${event}`);
            return;
        }

        const callbacks = this.eventMap.get(event);
        if (callbacks) {
            callbacks.delete(callback as EventCallback);
            if (callbacks.size === 0) {
                this.eventMap.delete(event);
            }
            this.logger.debug(`Removed listener for event: ${event}`);
        }
    }

    public async emit<T = void>(event: string, data: any): Promise<T> {
        const callbacks = this.eventMap.get(event);
        if (!callbacks) return undefined as T;

        this.logger.debug(`Emitting event: ${event}`, data);
        
        let lastResult: any = undefined;
        const promises: Promise<any>[] = [];
        
        for (const callback of callbacks) {
            try {
                const result = callback(data);
                if (result instanceof Promise) {
                    promises.push(result);
                } else if (result !== undefined) {
                    lastResult = result;
                }
            } catch (error) {
                this.logger.error(`Error in event listener for ${event}`, error as Error);
            }
        }

        if (promises.length > 0) {
            try {
                const results = await Promise.all(promises);
                // Use the last non-undefined result from promises
                const lastPromiseResult = results.reverse().find(r => r !== undefined);
                if (lastPromiseResult !== undefined) {
                    lastResult = lastPromiseResult;
                }
            } catch (error) {
                this.logger.error(`Error in async event listener for ${event}`, error as Error);
            }
        }

        return lastResult as T;
    }

    public getListenerCount(event: string): number {
        return this.eventMap.get(event)?.size || 0;
    }

    public clearAllListeners(): void {
        this.eventMap.clear();
        this.logger.debug('All event listeners cleared');
    }
} 