import { BaseStore } from '../core/store/BaseStore';
import { Wall } from '../core/events/types';
import { EventMap } from '../core/events/types';

export class WallStore extends BaseStore<Wall> {
    private static instance: WallStore;

    private constructor() {
        super();
    }

    static getInstance(): WallStore {
        if (!WallStore.instance) {
            WallStore.instance = new WallStore();
        }
        return WallStore.instance;
    }

    protected getCreatedEventName(): keyof EventMap {
        return 'wall:created';
    }

    protected getUpdatedEventName(): keyof EventMap {
        return 'wall:updated';
    }

    protected getDeletedEventName(): keyof EventMap {
        return 'wall:deleted';
    }

    protected getItemType(): string {
        return 'wall';
    }

    // Métodos específicos para paredes
    findWallsIntersectingPoint(point: { x: number; y: number }, tolerance: number = 5): Wall[] {
        return this.getAll().filter(wall => {
            // Implementar lógica de intersección
            return false; // TODO: Implementar
        });
    }

    findWallsInArea(
        topLeft: { x: number; y: number }, 
        bottomRight: { x: number; y: number }
    ): Wall[] {
        return this.getAll().filter(wall => {
            // Implementar lógica de área
            return false; // TODO: Implementar
        });
    }

    // Otros métodos específicos para paredes según se necesiten
} 