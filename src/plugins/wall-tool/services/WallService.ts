import { Point } from '../../../core/types/geometry';
import { NodeObject } from '../objects/NodeObject';
import { WallObject } from '../objects/WallObject';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { Line } from 'konva/lib/shapes/Line';

export class WallService {
    // Constants for snapping and constraints
    private readonly RECT_ANGLE_SNAP = 90; // For CTRL key
    private readonly ANGLE_SNAP = 15;      // For SHIFT key
    private readonly GRID_SNAP = 10;       // For ALT key

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {}

    // Wall calculations
    calculateAngle(start: Point, end: Point): number {
        return Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    }

    calculateDistance(start: Point, end: Point): number {
        return Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    }

    getDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Snapping and constraints
    snapToGrid(position: Point): Point {
        return {
            x: Math.round(position.x / this.GRID_SNAP) * this.GRID_SNAP,
            y: Math.round(position.y / this.GRID_SNAP) * this.GRID_SNAP
        };
    }

    snapDistanceToGrid(start: Point, end: Point): Point {
        const angle = this.calculateAngle(start, end);
        const distance = this.calculateDistance(start, end);
        const snappedDistance = Math.round(distance / this.GRID_SNAP) * this.GRID_SNAP;
        
        const radians = angle * Math.PI / 180;
        return {
            x: start.x + snappedDistance * Math.cos(radians),
            y: start.y + snappedDistance * Math.sin(radians)
        };
    }

    applyModifierConstraints(
        position: Point,
        referencePoint: Point | null,
        modifiers: { ctrl: boolean; shift: boolean; alt: boolean }
    ): Point {
        if (!referencePoint) return position;

        let result = { ...position };

        // Grid snapping (ALT key)
        if (modifiers.alt) {
            result = this.snapToGrid(result);
        }

        // Angle constraints
        if (modifiers.ctrl || modifiers.shift) {
            const angle = this.calculateAngle(referencePoint, result);
            const distance = this.calculateDistance(referencePoint, result);
            let snappedAngle = angle;

            if (modifiers.ctrl) {
                // Snap to 90-degree angles
                snappedAngle = Math.round(angle / this.RECT_ANGLE_SNAP) * this.RECT_ANGLE_SNAP;
            } else if (modifiers.shift) {
                // Snap to 15-degree angles
                snappedAngle = Math.round(angle / this.ANGLE_SNAP) * this.ANGLE_SNAP;
            }

            const radians = snappedAngle * Math.PI / 180;
            result = {
                x: referencePoint.x + distance * Math.cos(radians),
                y: referencePoint.y + distance * Math.sin(radians)
            };
        }

        return result;
    }

    // Node operations
    async mergeNodes(sourceNode: NodeObject, targetNode: NodeObject): Promise<void> {
        try {
            // Update all walls connected to source node to use target node
            const connectedWalls = sourceNode.getConnectedWalls();
            for (const wall of connectedWalls) {
                if (wall.startNode === sourceNode) {
                    wall.startNode = targetNode;
                }
                if (wall.endNode === sourceNode) {
                    wall.endNode = targetNode;
                }
                targetNode.addConnectedWall(wall);
            }

            // Remove the source node
            sourceNode.dispose();
            
            this.logger.info('Nodes merged successfully', {
                sourceId: sourceNode.id,
                targetId: targetNode.id
            });
        } catch (error) {
            this.logger.error('Failed to merge nodes', error as Error);
            throw error;
        }
    }

    // Wall preview
    createPreviewLine(startPoint: Point): Line {
        return new Line({
            points: [startPoint.x, startPoint.y, startPoint.x, startPoint.y],
            stroke: '#2563eb',
            strokeWidth: 2,
            dash: [5, 5],
            listening: false
        });
    }

    updatePreviewLine(line: Line, startPoint: Point, endPoint: Point): void {
        line.points([startPoint.x, startPoint.y, endPoint.x, endPoint.y]);
    }

    // Wall splitting
    async splitWall(wall: WallObject, splitPoint: Point): Promise<void> {
        try {
            // Create new node at split point
            const newNode = new NodeObject(splitPoint);
            
            // Create two new walls using the split point
            const wallStart = wall.startNode;
            const wallEnd = wall.endNode;
            
            const newWall1 = new WallObject(wallStart, newNode);
            const newWall2 = new WallObject(newNode, wallEnd);
            
            // Copy properties from original wall
            newWall1.copyPropertiesFrom(wall);
            newWall2.copyPropertiesFrom(wall);
            
            // Remove original wall
            wall.dispose();
            
            this.logger.info('Wall split successfully', {
                originalWallId: wall.id,
                newWall1Id: newWall1.id,
                newWall2Id: newWall2.id,
                newNodeId: newNode.id
            });
            
            // Emit wall split event
            this.eventManager.emit('wall:split', {
                originalWallId: wall.id,
                newWall1Id: newWall1.id,
                newWall2Id: newWall2.id,
                newNodeId: newNode.id
            });
        } catch (error) {
            this.logger.error('Failed to split wall', error as Error);
            throw error;
        }
    }
} 