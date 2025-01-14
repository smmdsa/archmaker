import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { DoorObject } from '../objects/DoorObject';

export class DoorStore {
    private static instance: DoorStore | null = null;
    private doors: Map<string, DoorObject> = new Map();
    private nextDoorNumber: number = 1;

    private constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {}

    static getInstance(eventManager: IEventManager, logger: ILogger): DoorStore {
        if (!DoorStore.instance) {
            DoorStore.instance = new DoorStore(eventManager, logger);
        }
        return DoorStore.instance;
    }

    addDoor(door: DoorObject): void {
        door.setDoorNumber(this.nextDoorNumber++);
        this.doors.set(door.id, door);
        this.eventManager.emit('door:added', { door });
        this.eventManager.emit('door:changed', {});
    }

    removeDoor(id: string): void {
        const door = this.doors.get(id);
        if (door) {
            door.destroy();
            this.doors.delete(id);
            this.eventManager.emit('door:removed', { doorId: id });
            this.eventManager.emit('door:changed', {});
            this.reorderDoorNumbers();
        }
    }

    private reorderDoorNumbers(): void {
        const sortedDoors = Array.from(this.doors.values())
            .sort((a, b) => (a.getDoorNumber() || 0) - (b.getDoorNumber() || 0));
        
        this.nextDoorNumber = 1;
        sortedDoors.forEach(door => {
            door.setDoorNumber(this.nextDoorNumber++);
        });
    }

    getDoor(id: string): DoorObject | undefined {
        return this.doors.get(id);
    }

    getAllDoors(): DoorObject[] {
        return Array.from(this.doors.values());
    }

    getDoorsByWall(wallId: string): DoorObject[] {
        return this.getAllDoors().filter(door => door.getData().wallId === wallId);
    }

    clear(): void {
        this.doors.forEach(door => door.destroy());
        this.doors.clear();
        this.nextDoorNumber = 1;
        this.eventManager.emit('door:changed', {});
    }
} 