import { v4 as uuidv4 } from 'uuid';
import { Point } from '../../../core/types/geometry';
import { IWall } from '../interfaces/IWall';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { IConfigManager } from '../../../core/interfaces/IConfig';
import { ProjectStore } from '../../../store/ProjectStore';
import { WallStoreAdapter } from './WallStoreAdapter';
import { IDrawingService, DrawingCreationParams } from '../../../core/services/IDrawingService';

export class WallService implements IDrawingService<IWall> {
    private walls: Map<string, IWall> = new Map();
    private initialized: boolean = false;

    constructor(
        private readonly store: ProjectStore,
        private readonly adapter: WallStoreAdapter,
        private readonly configManager: IConfigManager,
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {}

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logger.warn('Wall Service already initialized');
            return;
        }

        try {
            // Load existing walls from store
            const walls = this.store.getWalls();
            walls.forEach(wall => {
                const adaptedWall = this.adapter.fromStore(wall);
                this.walls.set(adaptedWall.id, adaptedWall);
            });
            
            this.initialized = true;
            this.logger.info('Wall Service initialized', { wallCount: walls.length });
        } catch (error) {
            this.logger.error('Failed to initialize Wall Service', error as Error);
            throw error;
        }
    }

    async dispose(): Promise<void> {
        if (!this.initialized) {
            this.logger.warn('Wall Service not initialized or already disposed');
            return;
        }

        try {
            this.walls.clear();
            this.initialized = false;
            this.logger.info('Wall Service disposed');
        } catch (error) {
            this.logger.error('Failed to dispose Wall Service', error as Error);
            throw error;
        }
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Wall Service not initialized');
        }
    }

    async create(params: DrawingCreationParams): Promise<IWall> {
        this.ensureInitialized();

        const wall: IWall = {
            id: uuidv4(),
            startPoint: params.startPoint,
            endPoint: params.endPoint,
            thickness: params.thickness,
            height: params.height,
            properties: {
                material: params.properties?.material || 'default',
                color: params.properties?.color || '#cccccc',
                ...params.properties
            }
        };

        try {
            this.walls.set(wall.id, wall);
            const storeWall = this.adapter.toStore(wall);
            this.store.addWall(storeWall);
            await this.eventManager.emit('wall:created', { wall });
            this.logger.info('Wall created', { wallId: wall.id });
            return wall;
        } catch (error) {
            this.logger.error('Failed to create wall', error as Error);
            // Clean up on error
            this.walls.delete(wall.id);
            throw error;
        }
    }

    async update(wallId: string, updates: Partial<IWall>): Promise<IWall> {
        this.ensureInitialized();

        const wall = this.walls.get(wallId);
        if (!wall) {
            throw new Error(`Wall with id ${wallId} not found`);
        }

        try {
            const updatedWall: IWall = {
                ...wall,
                ...updates,
                properties: {
                    ...wall.properties,
                    ...updates.properties
                }
            };

            this.walls.set(wallId, updatedWall);
            const storeUpdates = this.adapter.updateToStore(updates);
            this.store.updateWall(wallId, storeUpdates);
            await this.eventManager.emit('wall:updated', { wall: updatedWall });
            this.logger.info('Wall updated', { wallId });
            return updatedWall;
        } catch (error) {
            this.logger.error('Failed to update wall', error as Error);
            // Restore previous state on error
            this.walls.set(wallId, wall);
            throw error;
        }
    }

    async delete(wallId: string): Promise<void> {
        this.ensureInitialized();

        if (!this.walls.has(wallId)) {
            throw new Error(`Wall with id ${wallId} not found`);
        }

        try {
            this.walls.delete(wallId);
            this.store.removeWall(wallId);
            await this.eventManager.emit('wall:deleted', { wallId });
            this.logger.info('Wall deleted', { wallId });
        } catch (error) {
            this.logger.error('Failed to delete wall', error as Error);
            throw error;
        }
    }

    get(wallId: string): IWall | undefined {
        this.ensureInitialized();
        return this.walls.get(wallId);
    }

    getAll(): IWall[] {
        this.ensureInitialized();
        return Array.from(this.walls.values());
    }

    getSnapPoints(): Point[] {
        this.ensureInitialized();
        const points: Point[] = [];
        this.walls.forEach(wall => {
            points.push(wall.startPoint, wall.endPoint);
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