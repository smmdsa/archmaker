import { v4 as uuidv4 } from 'uuid';
import { Point } from '../../../core/types/geometry';
import { IRoom } from '../interfaces/IRoom';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { IConfigManager } from '../../../core/interfaces/IConfig';
import { ProjectStore } from '../../../store/ProjectStore';
import { RoomStoreAdapter } from './RoomStoreAdapter';
import { IDrawingService, DrawingCreationParams } from '../../../core/services/IDrawingService';

export class RoomService implements IDrawingService<IRoom> {
    private rooms: Map<string, IRoom> = new Map();
    private initialized: boolean = false;

    constructor(
        private readonly store: ProjectStore,
        private readonly adapter: RoomStoreAdapter,
        private readonly configManager: IConfigManager,
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {}

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logger.warn('Room Service already initialized');
            return;
        }

        try {
            // Load existing rooms from store
            const rooms = this.store.getRooms();
            rooms.forEach(room => {
                const adaptedRoom = this.adapter.fromStore(room);
                this.rooms.set(adaptedRoom.id, adaptedRoom);
            });
            
            this.initialized = true;
            this.logger.info('Room Service initialized', { roomCount: rooms.length });
        } catch (error) {
            this.logger.error('Failed to initialize Room Service', error as Error);
            throw error;
        }
    }

    async dispose(): Promise<void> {
        if (!this.initialized) {
            this.logger.warn('Room Service not initialized or already disposed');
            return;
        }

        try {
            this.rooms.clear();
            this.initialized = false;
            this.logger.info('Room Service disposed');
        } catch (error) {
            this.logger.error('Failed to dispose Room Service', error as Error);
            throw error;
        }
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Room Service not initialized');
        }
    }

    async create(params: DrawingCreationParams): Promise<IRoom> {
        this.ensureInitialized();

        const room: IRoom = {
            id: uuidv4(),
            points: [params.startPoint],
            height: params.height,
            properties: {
                material: params.properties?.material || 'default',
                color: params.properties?.color || '#cccccc',
                ...params.properties
            }
        };

        try {
            this.rooms.set(room.id, room);
            const storeRoom = this.adapter.toStore(room);
            this.store.addRoom(storeRoom);
            await this.eventManager.emit('room:created', { room });
            this.logger.info('Room created', { roomId: room.id });
            return room;
        } catch (error) {
            this.logger.error('Failed to create room', error as Error);
            // Clean up on error
            this.rooms.delete(room.id);
            throw error;
        }
    }

    async update(roomId: string, updates: Partial<IRoom>): Promise<IRoom> {
        this.ensureInitialized();

        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`Room with id ${roomId} not found`);
        }

        try {
            const updatedRoom: IRoom = {
                ...room,
                ...updates,
                properties: {
                    ...room.properties,
                    ...updates.properties
                }
            };

            this.rooms.set(roomId, updatedRoom);
            const storeUpdates = this.adapter.updateToStore(updates);
            this.store.updateRoom(roomId, storeUpdates);
            await this.eventManager.emit('room:updated', { room: updatedRoom });
            this.logger.info('Room updated', { roomId });
            return updatedRoom;
        } catch (error) {
            this.logger.error('Failed to update room', error as Error);
            // Restore previous state on error
            this.rooms.set(roomId, room);
            throw error;
        }
    }

    async delete(roomId: string): Promise<void> {
        this.ensureInitialized();

        if (!this.rooms.has(roomId)) {
            throw new Error(`Room with id ${roomId} not found`);
        }

        try {
            this.rooms.delete(roomId);
            this.store.removeRoom(roomId);
            await this.eventManager.emit('room:deleted', { roomId });
            this.logger.info('Room deleted', { roomId });
        } catch (error) {
            this.logger.error('Failed to delete room', error as Error);
            throw error;
        }
    }

    get(roomId: string): IRoom | undefined {
        this.ensureInitialized();
        return this.rooms.get(roomId);
    }

    getAll(): IRoom[] {
        this.ensureInitialized();
        return Array.from(this.rooms.values());
    }

    getSnapPoints(): Point[] {
        this.ensureInitialized();
        const points: Point[] = [];
        this.rooms.forEach(room => {
            points.push(...room.points);
        });
        return points;
    }

    getNearestSnapPoint(point: Point, threshold: number): Point | null {
        this.ensureInitialized();
        const snapPoints = this.getSnapPoints();
        let nearestPoint: Point | null = null;
        let minDistance = threshold;

        snapPoints.forEach(snapPoint => {
            const distance = this.calculateDistance(point, snapPoint);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = snapPoint;
            }
        });

        return nearestPoint;
    }

    private calculateDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
} 