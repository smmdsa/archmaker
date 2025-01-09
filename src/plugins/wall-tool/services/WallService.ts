import { v4 as uuidv4 } from 'uuid';
import { Point } from '../../../store/ProjectStore';
import { IWall } from '../interfaces/IWall';
import { IWallService, WallCreationParams } from './IWallService';
import { EventBus } from '../../../core/events/EventBus';

export class WallService implements IWallService {
    private walls: Map<string, IWall> = new Map();
    private eventBus: EventBus;
    private static instance: WallService;

    private constructor() {
        this.eventBus = EventBus.getInstance();
    }

    static getInstance(): WallService {
        if (!WallService.instance) {
            WallService.instance = new WallService();
        }
        return WallService.instance;
    }

    // Wall management
    async createWall(params: WallCreationParams): Promise<IWall> {
        const wall: IWall = {
            id: uuidv4(),
            startPoint: params.startPoint,
            endPoint: params.endPoint,
            thickness: params.thickness || 20,
            height: params.height || 280,
            properties: {
                ...params.properties,
                material: params.properties?.material || 'default',
                color: params.properties?.color || '#cccccc'
            }
        };

        this.walls.set(wall.id, wall);
        this.eventBus.emit('wall:created', wall);
        return wall;
    }

    async updateWall(wallId: string, updates: Partial<IWall>): Promise<IWall> {
        const wall = this.walls.get(wallId);
        if (!wall) {
            throw new Error(`Wall with id ${wallId} not found`);
        }

        const updatedWall: IWall = {
            ...wall,
            ...updates,
            properties: {
                ...wall.properties,
                ...updates.properties
            }
        };

        this.walls.set(wallId, updatedWall);
        this.eventBus.emit('wall:updated', updatedWall);
        return updatedWall;
    }

    async deleteWall(wallId: string): Promise<void> {
        if (this.walls.delete(wallId)) {
            this.eventBus.emit('wall:deleted', wallId);
        }
    }

    getWall(wallId: string): IWall | undefined {
        return this.walls.get(wallId);
    }

    getAllWalls(): IWall[] {
        return Array.from(this.walls.values());
    }

    // Snapping
    getSnapPoints(): Point[] {
        const points: Point[] = [];
        this.walls.forEach(wall => {
            points.push(wall.startPoint, wall.endPoint);
        });
        return points;
    }

    getNearestSnapPoint(point: Point, threshold: number): Point | null {
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

    // Events
    onWallCreated(callback: (wall: IWall) => void): () => void {
        return this.eventBus.subscribe('wall:created', callback);
    }

    onWallUpdated(callback: (wall: IWall) => void): () => void {
        return this.eventBus.subscribe('wall:updated', callback);
    }

    onWallDeleted(callback: (wallId: string) => void): () => void {
        return this.eventBus.subscribe('wall:deleted', callback);
    }

    private calculateDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
} 