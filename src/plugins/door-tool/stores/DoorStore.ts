import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { DoorObject } from '../objects/DoorObject';

export class DoorStore {
    private static instance: DoorStore | null = null;
    private doors: Map<string, DoorObject> = new Map();

    private constructor(private eventManager: IEventManager, private logger: ILogger) {}

    public static getInstance(eventManager: IEventManager, logger: ILogger): DoorStore {
        if (!DoorStore.instance) {
            DoorStore.instance = new DoorStore(eventManager, logger);
        }
        return DoorStore.instance;
    }

    public addDoor(door: DoorObject): void {
        this.doors.set(door.id, door);
        this.logger.info(`Door added: ${door.id}`);
    }

    public removeDoor(doorId: string): void {
        if (this.doors.delete(doorId)) {
            this.logger.info(`Door removed: ${doorId}`);
        }
    }

    public getAllDoors(): DoorObject[] {
        return Array.from(this.doors.values());
    }

    public clear(): void {
        const doorIds = Array.from(this.doors.keys());
        doorIds.forEach(id => this.removeDoor(id));
        this.doors.clear();
        this.logger.info('All doors cleared');
    }
} 