import { EventBus } from '../events/EventBus';
import { EventMap } from '../events/types';

export interface StoreState {
    id: string;
    [key: string]: any;
}

export abstract class BaseStore<T extends StoreState> {
    protected eventBus: EventBus;
    protected items: Map<string, T>;

    constructor() {
        this.eventBus = EventBus.getInstance();
        this.items = new Map();
    }

    protected abstract getCreatedEventName(): keyof EventMap;
    protected abstract getUpdatedEventName(): keyof EventMap;
    protected abstract getDeletedEventName(): keyof EventMap;

    async create(item: Omit<T, 'id'>): Promise<string> {
        const id = crypto.randomUUID();
        const newItem = { ...item, id } as T;
        this.items.set(id, newItem);
        
        this.eventBus.emit(this.getCreatedEventName(), { 
            [this.getItemType()]: newItem 
        } as any);
        
        return id;
    }

    async update(id: string, updates: Partial<T>): Promise<void> {
        const item = this.items.get(id);
        if (!item) throw new Error(`Item with id ${id} not found`);

        const updatedItem = { ...item, ...updates };
        this.items.set(id, updatedItem);

        this.eventBus.emit(this.getUpdatedEventName(), {
            [this.getItemType()]: updatedItem
        } as any);
    }

    async delete(id: string): Promise<void> {
        if (!this.items.has(id)) throw new Error(`Item with id ${id} not found`);
        
        this.items.delete(id);
        this.eventBus.emit(this.getDeletedEventName(), { id } as any);
    }

    get(id: string): T | undefined {
        return this.items.get(id);
    }

    getAll(): T[] {
        return Array.from(this.items.values());
    }

    protected abstract getItemType(): string;
} 