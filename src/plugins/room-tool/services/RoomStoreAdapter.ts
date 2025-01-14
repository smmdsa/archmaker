import { ProjectStore } from '../../../store/ProjectStore';
import { IRoom } from '../interfaces/IRoom';

export class RoomStoreAdapter {
    constructor(private readonly store: ProjectStore) {}

    fromStore(room: any): IRoom {
        return {
            id: room.id,
            points: room.points,
            height: room.height,
            properties: {
                material: room.properties?.material || 'default',
                color: room.properties?.color || '#cccccc',
                ...room.properties
            }
        };
    }

    toStore(room: IRoom): any {
        return {
            id: room.id,
            points: room.points,
            height: room.height,
            properties: room.properties
        };
    }

    updateToStore(updates: Partial<IRoom>): any {
        return {
            points: updates.points,
            height: updates.height,
            properties: updates.properties
        };
    }
} 