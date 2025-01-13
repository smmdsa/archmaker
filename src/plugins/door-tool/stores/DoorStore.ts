import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { DoorObject } from '../objects/DoorObject';
import { BehaviorSubject } from 'rxjs';

export interface DoorStoreState {
    doors: Map<string, DoorObject>;
    doorCount: number;
    doorNumbers: Map<string, number>;
}

export class DoorStore {
    private static instance: DoorStore | null = null;
    private state$ = new BehaviorSubject<DoorStoreState>({
        doors: new Map(),
        doorCount: 0,
        doorNumbers: new Map()
    });

    private constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.logger.info('DoorStore initialized');
    }

    static getInstance(eventManager: IEventManager, logger: ILogger): DoorStore {
        if (!DoorStore.instance) {
            DoorStore.instance = new DoorStore(eventManager, logger);
        }
        return DoorStore.instance;
    }

    private updateState(newState: Partial<DoorStoreState>): void {
        const currentState = this.state$.getValue();
        const updatedState = {
            ...currentState,
            ...newState
        };
        this.state$.next(updatedState);
        
        // Emit door:changed event with current state
        this.eventManager.emit('door:changed', {
            doorCount: updatedState.doors.size,
            doorIds: Array.from(updatedState.doors.keys()),
            doorNumbers: Object.fromEntries(updatedState.doorNumbers)
        });
    }

    addDoor(door: DoorObject): void {
        const currentState = this.state$.getValue();
        const newDoors = new Map(currentState.doors);
        const newDoorNumbers = new Map(currentState.doorNumbers);
        
        newDoors.set(door.id, door);
        newDoorNumbers.set(door.id, currentState.doorCount + 1);
        
        this.updateState({
            doors: newDoors,
            doorCount: currentState.doorCount + 1,
            doorNumbers: newDoorNumbers
        });
        
        door.setDoorNumber(currentState.doorCount + 1);
        
        this.eventManager.emit('door:added', { 
            door, 
            doorNumber: currentState.doorCount + 1 
        });
        
        this.logger.info('Door added to store', {
            doorId: door.id,
            wallId: door.getData().wallId,
            doorNumber: currentState.doorCount + 1
        });
    }

    removeDoor(doorId: string): void {
        const currentState = this.state$.getValue();
        const door = currentState.doors.get(doorId);
        
        if (door) {
            const newDoors = new Map(currentState.doors);
            const newDoorNumbers = new Map(currentState.doorNumbers);
            
            door.destroy();
            newDoors.delete(doorId);
            newDoorNumbers.delete(doorId);
            
            this.updateState({
                doors: newDoors,
                doorNumbers: newDoorNumbers
            });
            
            this.eventManager.emit('door:removed', { doorId });
            this.logger.info('Door removed from store', { doorId });
        }
    }

    getDoor(doorId: string): DoorObject | undefined {
        return this.state$.getValue().doors.get(doorId);
    }

    getAllDoors(): DoorObject[] {
        const state = this.state$.getValue();
        const doors = Array.from(state.doors.values());
        
        this.logger.info('DoorStore state:', {
            totalDoors: doors.length,
            doorCount: state.doorCount,
            storedDoorIds: Array.from(state.doors.keys()),
            doorNumbers: Object.fromEntries(state.doorNumbers),
            doorsWithLabels: doors.map(door => ({
                id: door.id,
                number: state.doorNumbers.get(door.id),
                wallId: door.getData().wallId
            }))
        });
        
        doors.forEach(door => {
            const number = state.doorNumbers.get(door.id);
            if (number) {
                door.setDoorNumber(number);
                this.logger.info('Restoring door number:', { doorId: door.id, number });
            } else {
                this.logger.warn('Door missing number:', { doorId: door.id });
            }
        });
        
        return doors;
    }

    getDoorsByWall(wallId: string): DoorObject[] {
        return this.getAllDoors().filter(door => door.getData().wallId === wallId);
    }

    getDoorNumber(doorId: string): number | undefined {
        return this.state$.getValue().doorNumbers.get(doorId);
    }

    clear(): void {
        const currentState = this.state$.getValue();
        currentState.doors.forEach(door => door.destroy());
        
        this.updateState({
            doors: new Map(),
            doorCount: 0,
            doorNumbers: new Map()
        });
        
        this.eventManager.emit('door:cleared');
        this.logger.info('DoorStore cleared');
    }
    
    getState$() {
        return this.state$.asObservable();
    }
} 