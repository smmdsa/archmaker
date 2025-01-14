type EventCallback = (...args: any[]) => void;

export class EventEmitter {
    private events: Map<string, Set<EventCallback>>;

    constructor() {
        this.events = new Map();
    }

    on(eventName: string, callback: EventCallback): void {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, new Set());
        }
        this.events.get(eventName)!.add(callback);
    }

    off(eventName: string, callback?: EventCallback): void {
        const callbacks = this.events.get(eventName);
        if (callbacks) {
            if (callback) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.events.delete(eventName);
                }
            } else {
                this.events.delete(eventName);
            }
        }
    }

    emit(eventName: string, ...args: any[]): void {
        const callbacks = this.events.get(eventName);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in event listener for ${eventName}:`, error);
                }
            });
        }
    }

    clear(): void {
        this.events.clear();
    }

    getListenerCount(eventName: string): number {
        return this.events.get(eventName)?.size || 0;
    }

    getEventNames(): string[] {
        return Array.from(this.events.keys());
    }
} 