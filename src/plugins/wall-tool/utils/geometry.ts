import { Point } from '../../../core/types/geometry';

export function calculateAngle(start: Point, end: Point): number {
    return Math.atan2(end.y - start.y, end.x - start.x);
}

export function getDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function normalizeAngle(angle: number): number {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
}

export function getPointAtDistance(start: Point, angle: number, distance: number): Point {
    return {
        x: start.x + Math.cos(angle) * distance,
        y: start.y + Math.sin(angle) * distance
    };
}

export function findIntersection(
    line1Start: Point,
    line1End: Point,
    line2Start: Point,
    line2End: Point
): Point | null {
    const denominator = ((line2End.y - line2Start.y) * (line1End.x - line1Start.x)) -
                       ((line2End.x - line2Start.x) * (line1End.y - line1Start.y));

    if (denominator === 0) return null;

    const ua = (((line2End.x - line2Start.x) * (line1Start.y - line2Start.y)) -
                ((line2End.y - line2Start.y) * (line1Start.x - line2Start.x))) / denominator;

    const ub = (((line1End.x - line1Start.x) * (line1Start.y - line2Start.y)) -
                ((line1End.y - line1Start.y) * (line1Start.x - line2Start.x))) / denominator;

    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;

    return {
        x: line1Start.x + (ua * (line1End.x - line1Start.x)),
        y: line1Start.y + (ua * (line1End.y - line1Start.y))
    };
}

export function isPointOnLine(point: Point, lineStart: Point, lineEnd: Point, tolerance: number = 0.1): boolean {
    const d1 = getDistance(point, lineStart);
    const d2 = getDistance(point, lineEnd);
    const lineLength = getDistance(lineStart, lineEnd);
    
    return Math.abs(d1 + d2 - lineLength) <= tolerance;
}

export function getPerpendicularPoint(point: Point, lineStart: Point, lineEnd: Point): Point {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    
    const k = ((point.y - lineStart.y) * dy + (point.x - lineStart.x) * dx) / (dx * dx + dy * dy);
    
    return {
        x: lineStart.x + k * dx,
        y: lineStart.y + k * dy
    };
}

export function snapToAngle(angle: number, snapAngle: number = Math.PI / 4): number {
    return Math.round(angle / snapAngle) * snapAngle;
}

export function snapToGrid(point: Point, gridSize: number): Point {
    return {
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize
    };
} 