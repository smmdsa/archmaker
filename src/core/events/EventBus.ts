type EventCallback = (data: any) => void;

interface EventSubscription {
    eventName: string;
    callback: EventCallback;
    once: boolean;
}

export class EventBus {
    private static instance: EventBus;
    private subscribers: Map<string, EventSubscription[]>;
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

    subscribe(eventName: string, callback: EventCallback): () => void {
        this.addSubscriber(eventName, callback, false);
        return () => this.unsubscribeCallback(eventName, callback);
    }

    once(eventName: string, callback: EventCallback): () => void {
        this.addSubscriber(eventName, callback, true);
        return () => this.unsubscribeCallback(eventName, callback);
    }

    emit(eventName: string, data?: any): void {
        if (this.debugMode) {
            console.log(`[EventBus] Emitting event: ${eventName}`, data);
        }

        const subscribers = this.subscribers.get(eventName);
        if (!subscribers) return;

        // Crear una copia del array para evitar problemas si se modifican los suscriptores durante la emisión
        const subscribersCopy = [...subscribers];

        subscribersCopy.forEach(subscription => {
            try {
                subscription.callback(data);
                if (subscription.once) {
                    this.unsubscribeCallback(eventName, subscription.callback);
                }
            } catch (error) {
                console.error(`[EventBus] Error en el manejador de evento ${eventName}:`, error);
            }
        });
    }

    // Método público para cancelar todas las suscripciones de un evento
    unsubscribe(eventName: string): void {
        if (this.subscribers.has(eventName)) {
            this.subscribers.delete(eventName);
            if (this.debugMode) {
                console.log(`[EventBus] Todas las suscripciones eliminadas para: ${eventName}`);
            }
        }
    }

    // Método privado para cancelar una suscripción específica
    private unsubscribeCallback(eventName: string, callback: EventCallback): void {
        const subscribers = this.subscribers.get(eventName);
        if (!subscribers) return;

        const index = subscribers.findIndex(sub => sub.callback === callback);
        if (index !== -1) {
            subscribers.splice(index, 1);
            if (subscribers.length === 0) {
                this.subscribers.delete(eventName);
            }
            if (this.debugMode) {
                console.log(`[EventBus] Suscripción eliminada para: ${eventName}`);
            }
        }
    }

    private addSubscriber(eventName: string, callback: EventCallback, once: boolean): void {
        if (!this.subscribers.has(eventName)) {
            this.subscribers.set(eventName, []);
        }

        const subscription: EventSubscription = {
            eventName,
            callback,
            once
        };

        this.subscribers.get(eventName)!.push(subscription);

        if (this.debugMode) {
            console.log(`[EventBus] Nueva suscripción a: ${eventName}`, { once });
        }
    }

    clear(): void {
        this.subscribers.clear();
        if (this.debugMode) {
            console.log('[EventBus] Todas las suscripciones han sido eliminadas');
        }
    }

    getSubscriberCount(eventName: string): number {
        return this.subscribers.get(eventName)?.length || 0;
    }

    hasSubscribers(eventName: string): boolean {
        return this.getSubscriberCount(eventName) > 0;
    }
} 