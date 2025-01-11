import { Point } from '../../../core/types/geometry';
import { IWall, WallProperties } from '../interfaces/IWall';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { WallGraph } from '../models/WallGraph';
import { getDistance } from '../utils/geometry';
import { WallCreationParams, IWallService } from './IWallService';
import { Wall } from '../models/Wall';
import { IWallProperties } from '../models/interfaces';

export class WallService implements IWallService {
    private readonly graph: WallGraph;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.graph = new WallGraph();
    }

    private toIWall(wall: Wall): IWall {
        return {
            id: wall.getId(),
            startPoint: wall.getStartNode().getPosition(),
            endPoint: wall.getEndNode().getPosition(),
            thickness: wall.getProperties().thickness,
            height: wall.getProperties().height,
            properties: wall.getProperties()
        };
    }

    async createWall(params: WallCreationParams): Promise<IWall> {
        try {
            // Create nodes for start and end points
            const startNode = this.graph.addNode(params.startPoint.x, params.startPoint.y);
            const endNode = this.graph.addNode(params.endPoint.x, params.endPoint.y);

            // Create wall between nodes
            const wall = this.graph.createWall(startNode, endNode, {
                thickness: params.thickness || 10,
                height: params.height || 280,
                ...params.properties
            });

            const iwall = this.toIWall(wall);
            await this.eventManager.emit('wall:created', { wall: iwall });
            this.logger.info('Wall created', { wallId: wall.getId() });
            return iwall;
        } catch (error) {
            this.logger.error('Failed to create wall', error as Error);
            throw error;
        }
    }

    async updateWall(wallId: string, updates: Partial<IWall>): Promise<IWall> {
        const wall = this.graph.getWall(wallId);
        if (!wall) {
            throw new Error(`Wall with id ${wallId} not found`);
        }

        try {
            // Update wall properties
            const props: IWallProperties = { ...wall.getProperties() };
            if (updates.thickness) props.thickness = updates.thickness;
            if (updates.height) props.height = updates.height;
            if (updates.properties) Object.assign(props, updates.properties);
            wall.updateProperties(props);
            
            const iwall = this.toIWall(wall);
            await this.eventManager.emit('wall:updated', { wall: iwall });
            this.logger.info('Wall updated', { wallId });
            return iwall;
        } catch (error) {
            this.logger.error('Failed to update wall', error as Error);
            throw error;
        }
    }

    async deleteWall(wallId: string): Promise<void> {
        try {
            const wall = this.graph.getWall(wallId);
            if (!wall) {
                throw new Error(`Wall with id ${wallId} not found`);
            }
            
            this.graph.removeWall(wallId);
            await this.eventManager.emit('wall:deleted', { wallId });
            this.logger.info('Wall deleted', { wallId });
        } catch (error) {
            this.logger.error('Failed to delete wall', error as Error);
            throw error;
        }
    }

    getWall(wallId: string): IWall | undefined {
        const wall = this.graph.getWall(wallId);
        return wall ? this.toIWall(wall) : undefined;
    }

    getAllWalls(): IWall[] {
        return this.graph.getAllWalls().map(wall => this.toIWall(wall));
    }

    getSnapPoints(): Point[] {
        return this.graph.getAllNodes().map(node => node.getPosition());
    }

    getNearestSnapPoint(point: Point, threshold: number): Point | null {
        const nodes = this.graph.getAllNodes();
        let nearestPoint: Point | null = null;
        let minDistance = threshold;

        nodes.forEach(node => {
            const nodePos = node.getPosition();
            const distance = getDistance(point, nodePos);
            if (distance < minDistance) {
                minDistance = distance;
                nearestPoint = nodePos;
            }
        });

        return nearestPoint;
    }

    onWallCreated(callback: (wall: IWall) => void): () => void {
        const handler = ({ wall }: { wall: IWall }) => callback(wall);
        this.eventManager.on('wall:created', handler);
        return () => this.eventManager.off('wall:created', handler);
    }

    onWallUpdated(callback: (wall: IWall) => void): () => void {
        const handler = ({ wall }: { wall: IWall }) => callback(wall);
        this.eventManager.on('wall:updated', handler);
        return () => this.eventManager.off('wall:updated', handler);
    }

    onWallDeleted(callback: (wallId: string) => void): () => void {
        const handler = ({ wallId }: { wallId: string }) => callback(wallId);
        this.eventManager.on('wall:deleted', handler);
        return () => this.eventManager.off('wall:deleted', handler);
    }
} 