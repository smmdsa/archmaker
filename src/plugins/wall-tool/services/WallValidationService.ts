import { Point } from '../../../core/types/geometry';
import { NodeObject } from '../objects/NodeObject';
import { WallObject } from '../objects/WallObject';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { WallGraph } from '../models/WallGraph';

export class WallValidationService {
    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly wallGraph: WallGraph
    ) {}

    // Node validation
    isValidNodePosition(position: Point, existingNodes: NodeObject[], threshold: number = 10): boolean {
        // Check if the position is too close to existing nodes
        return !existingNodes.some(node => 
            this.getDistance(node.position, position) < threshold
        );
    }

    findNearestNode(position: Point, nodes: NodeObject[], threshold: number): NodeObject | null {
        let nearest: NodeObject | null = null;
        let minDistance = threshold;

        for (const node of nodes) {
            const distance = this.getDistance(position, node.position);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = node;
            }
        }

        return nearest;
    }

    // Wall validation
    isValidWall(startNode: NodeObject, endNode: NodeObject, minLength: number = 10): boolean {
        // Check if start and end nodes are different
        if (startNode === endNode) {
            return false;
        }

        // Check if wall length is sufficient
        const length = this.getDistance(startNode.position, endNode.position);
        if (length < minLength) {
            return false;
        }

        // Check if wall doesn't already exist between these nodes
        const existingWall = this.findWallBetweenNodes(startNode, endNode);
        return !existingWall;
    }

    findWallBetweenNodes(node1: NodeObject, node2: NodeObject): WallObject | null {
        const walls1 = node1.getData().connectedWallIds;
        const walls2 = node2.getData().connectedWallIds;

        // Find common wall ID between nodes
        const commonWallId = walls1.find(wallId => walls2.includes(wallId));
        
        if (!commonWallId) return null;

        // Get wall from graph
        const wall = this.wallGraph.getWall(commonWallId);
        if (!wall) return null;

        // Verify the wall connects these specific nodes
        const wallData = wall.getData();
        if ((wallData.startNodeId === node1.id && wallData.endNodeId === node2.id) ||
            (wallData.startNodeId === node2.id && wallData.endNodeId === node1.id)) {
            return wall;
        }

        return null;
    }

    // Wall intersection validation
    isValidWallPlacement(startPoint: Point, endPoint: Point, existingWalls: WallObject[]): boolean {
        // Check if new wall would intersect with existing walls
        for (const wall of existingWalls) {
            const wallData = wall.getData();
            if (this.doLinesIntersect(
                startPoint,
                endPoint,
                wallData.startPoint,
                wallData.endPoint
            )) {
                return false;
            }
        }
        return true;
    }

    // Split point validation
    isValidSplitPoint(point: Point, wall: WallObject, threshold: number = 10): boolean {
        const wallData = wall.getData();
        
        // Check if point is on the wall
        if (!this.isPointOnLine(point, wallData.startPoint, wallData.endPoint, threshold)) {
            return false;
        }

        // Check if point is too close to wall endpoints
        const distanceToStart = this.getDistance(point, wallData.startPoint);
        const distanceToEnd = this.getDistance(point, wallData.endPoint);
        
        return distanceToStart > threshold && distanceToEnd > threshold;
    }

    // Utility functions (maintaining existing behavior)
    getDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateAngle(start: Point, end: Point): number {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        // Calculate angle in degrees (0 to 360)
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle < 0) angle += 360;
        return angle;
    }

    private isPointOnLine(point: Point, lineStart: Point, lineEnd: Point, threshold: number): boolean {
        const d1 = this.getDistance(point, lineStart);
        const d2 = this.getDistance(point, lineEnd);
        const lineLength = this.getDistance(lineStart, lineEnd);
        
        // Check if point is within threshold distance of the line
        const buffer = 0.1; // Small buffer for floating-point arithmetic
        return Math.abs(d1 + d2 - lineLength) <= threshold + buffer;
    }

    private doLinesIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
        // Calculate line intersection using cross product
        const denominator = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
        
        // Lines are parallel
        if (denominator === 0) return false;
        
        const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denominator;
        const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denominator;
        
        // Check if intersection point lies on both line segments
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }
} 