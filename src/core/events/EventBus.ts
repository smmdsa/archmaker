import { EventMap } from './types';

type EventCallback<T> = (data: T) => void;

interface EventSubscription<T> {
    eventName: string;
    callback: EventCallback<T>;
    once: boolean;
}

export class EventBus {
    private static instance: EventBus;
    private subscribers: Map<string, EventSubscription<any>[]>;
    private debugMode: boolean;

    private constructor() {
        this.subscribers = new Map();
        this.debugMode = false;
    }

    static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    subscribe<K extends keyof EventMap>(
        eventName: K, 
        callback: EventCallback<EventMap[K]>
    ): () => void {
        this.addSubscriber(eventName, callback, false);
        return () => this.unsubscribeCallback(eventName, callback);
    }

    once<K extends keyof EventMap>(
        eventName: K, 
        callback: EventCallback<EventMap[K]>
    ): () => void {
        this.addSubscriber(eventName, callback, true);
        return () => this.unsubscribeCallback(eventName, callback);
    }

    emit<K extends keyof EventMap>(eventName: K, data: EventMap[K]): void {
        if (this.debugMode) {
            console.log(`[EventBus] Emitting event: ${eventName}`, data);
        }

        const subscribers = this.subscribers.get(eventName as string);
        if (!subscribers) return;

        const subscribersCopy = [...subscribers];

        subscribersCopy.forEach(subscription => {
            try {
                subscription.callback(data);
                if (subscription.once) {
                    this.unsubscribeCallback(eventName, subscription.callback);
                }
            } catch (error) {
                console.error(`[EventBus] Error in event handler ${eventName}:`, error);
            }
        });
    }

    unsubscribe(eventName: keyof EventMap): void {
        if (this.subscribers.has(eventName as string)) {
            this.subscribers.delete(eventName as string);
            if (this.debugMode) {
                console.log(`[EventBus] All subscriptions removed for: ${eventName}`);
            }
        }
    }

    private unsubscribeCallback<K extends keyof EventMap>(
        eventName: K, 
        callback: EventCallback<EventMap[K]>
    ): void {
        const subscribers = this.subscribers.get(eventName as string);
        if (!subscribers) return;

        const index = subscribers.findIndex(sub => sub.callback === callback);
        if (index !== -1) {
            subscribers.splice(index, 1);
            if (subscribers.length === 0) {
                this.subscribers.delete(eventName as string);
            }
            if (this.debugMode) {
                console.log(`[EventBus] Subscription removed for: ${eventName}`);
            }
        }
    }

    private addSubscriber<K extends keyof EventMap>(
        eventName: K, 
        callback: EventCallback<EventMap[K]>, 
        once: boolean
    ): void {
        if (!this.subscribers.has(eventName as string)) {
            this.subscribers.set(eventName as string, []);
        }

        const subscription: EventSubscription<EventMap[K]> = {
            eventName: eventName as string,
            callback,
            once
        };

        this.subscribers.get(eventName as string)!.push(subscription);

        if (this.debugMode) {
            console.log(`[EventBus] New subscription to: ${eventName}`, { once });
        }
    }

    clear(): void {
        this.subscribers.clear();
        if (this.debugMode) {
            console.log('[EventBus] All subscriptions have been cleared');
        }
    }

    getSubscriberCount(eventName: keyof EventMap): number {
        return this.subscribers.get(eventName as string)?.length || 0;
    }

    hasSubscribers(eventName: keyof EventMap): boolean {
        return this.getSubscriberCount(eventName) > 0;
    }
} 