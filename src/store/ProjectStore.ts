/**
 * @module store/ProjectStore
 * @description Central store for managing project data and state, including walls and subscriptions
 */

import { IWall } from '../plugins/wall-tool/interfaces/IWall';
import { IRoom } from '../plugins/room-tool/interfaces/IRoom';
import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';
import { IConfigManager } from '../core/interfaces/IConfig';

/**
 * Store class that manages project data and state
 * Provides methods for CRUD operations on walls and handles subscriptions
 */
export class ProjectStore {
    private walls: Map<string, IWall> = new Map();
    private rooms: Map<string, IRoom> = new Map();
    private subscribers: Set<() => void> = new Set();

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager
    ) {}

    /**
     * Subscribes to store changes
     * @param callback Function to call when store changes
     * @returns Unsubscribe function
     */
    subscribe(callback: () => void): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    /**
     * Unsubscribes from store changes
     * @param callback Function to stop calling when store changes
     */
    unsubscribe(callback: () => void): void {
        this.subscribers.delete(callback);
    }

    /**
     * Notifies all subscribers of store changes
     */
    private notifySubscribers(): void {
        this.subscribers.forEach(callback => callback());
    }

    /**
     * Adds a new wall to the project
     * @param wall Wall data without ID
     * @returns Generated wall ID
     */
    addWall(wall: IWall): void {
        this.walls.set(wall.id, wall);
        this.notifySubscribers();
        this.eventManager.emit('store:wall:added', { wall });
    }

    /**
     * Retrieves a wall by its ID
     * @param id Wall identifier
     * @returns Wall object if found, undefined otherwise
     */
    getWall(wallId: string): IWall | undefined {
        return this.walls.get(wallId);
    }

    /**
     * Gets all walls in the project
     * @returns Array of all walls
     */
    getWalls(): IWall[] {
        return Array.from(this.walls.values());
    }

    /**
     * Removes a wall from the project
     * @param id Wall identifier to remove
     */
    removeWall(wallId: string): void {
        if (!this.walls.has(wallId)) {
            throw new Error(`Wall with id ${wallId} not found`);
        }

        this.walls.delete(wallId);
        this.notifySubscribers();
        this.eventManager.emit('store:wall:removed', { wallId });
    }

    /**
     * Updates properties of an existing wall
     * @param id Wall identifier
     * @param updates Partial wall properties to update
     */
    updateWall(wallId: string, updates: Partial<IWall>): void {
        const wall = this.walls.get(wallId);
        if (!wall) {
            throw new Error(`Wall with id ${wallId} not found`);
        }

        const updatedWall = { ...wall, ...updates };
        this.walls.set(wallId, updatedWall);
        this.notifySubscribers();
        this.eventManager.emit('store:wall:updated', { wall: updatedWall });
    }

    /**
     * Adds a new room to the project
     * @param room Room data without ID
     * @returns Generated room ID
     */
    addRoom(room: IRoom): void {
        this.rooms.set(room.id, room);
        this.notifySubscribers();
        this.eventManager.emit('store:room:added', { room });
    }

    /**
     * Retrieves a room by its ID
     * @param id Room identifier
     * @returns Room object if found, undefined otherwise
     */
    getRoom(roomId: string): IRoom | undefined {
        return this.rooms.get(roomId);
    }

    /**
     * Gets all rooms in the project
     * @returns Array of all rooms
     */
    getRooms(): IRoom[] {
        return Array.from(this.rooms.values());
    }

    /**
     * Removes a room from the project
     * @param id Room identifier to remove
     */
    removeRoom(roomId: string): void {
        if (!this.rooms.has(roomId)) {
            throw new Error(`Room with id ${roomId} not found`);
        }

        this.rooms.delete(roomId);
        this.notifySubscribers();
        this.eventManager.emit('store:room:removed', { roomId });
    }

    /**
     * Updates properties of an existing room
     * @param id Room identifier
     * @param updates Partial room properties to update
     */
    updateRoom(roomId: string, updates: Partial<IRoom>): void {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error(`Room with id ${roomId} not found`);
        }

        const updatedRoom = { ...room, ...updates };
        this.rooms.set(roomId, updatedRoom);
        this.notifySubscribers();
        this.eventManager.emit('store:room:updated', { room: updatedRoom });
    }

    /**
     * Cleans up subscriptions when store is disposed
     */
    dispose(): void {
        this.walls.clear();
        this.rooms.clear();
        this.subscribers.clear();
        this.eventManager.emit('store:disposed', { store: this });
    }
}