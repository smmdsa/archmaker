import { v4 as uuidv4 } from 'uuid';
import { Point } from '../../../core/types/geometry';
import {
    IWall,
    IWallNode,
    WallNodeMap,
    WallMap,
    NodeConnectionResult,
    NodeValidationResult,
    IWallConnection,
    WallGraphEventType,
    IWallGraphEvent,
    IWallNodeMetadata
} from '../types/WallTypes';
import { calculateAngle, getDistance, pointToLineDistance, isPointOnSegment, findIntersection } from '../utils/geometry';
import { EventEmitter } from '../../../core/events/EventEmitter';

export class WallGraphService {
    private nodes: WallNodeMap;
    private walls: WallMap;
    private eventEmitter: EventEmitter;

    constructor() {
        this.nodes = new Map();
        this.walls = new Map();
        this.eventEmitter = new EventEmitter();
    }

    // Node Operations
    public createNode(position: Point): IWallNode {
        // Verificar si ya existe un nodo en esta posición
        const existingNode = this.findNodeAtPosition(position);
        if (existingNode) {
            console.info('Using existing node at position:', {
                nodeId: existingNode.id,
                position
            });
            return existingNode;
        }

        const node: IWallNode = {
            id: uuidv4(),
            position,
            connectedNodes: new Map(),
            metadata: {
                isCorner: false,
                isIntersection: false,
                isEndpoint: true
            }
        };

        this.nodes.set(node.id, node);
        this.emitGraphEvent(WallGraphEventType.NODE_ADDED, [node.id], []);
        console.info('Created new graph node:', {
            nodeId: node.id,
            position: node.position,
            metadata: node.metadata
        });
        return node;
    }

    public moveNode(nodeId: string, newPosition: Point): boolean {
        const node = this.nodes.get(nodeId);
        if (!node) {
            console.warn('Attempted to move non-existent node:', nodeId);
            return false;
        }

        // Verificar si ya existe un nodo en la nueva posición
        const existingNode = this.findNodeAtPosition(newPosition);
        if (existingNode && existingNode.id !== nodeId) {
            console.warn('Node already exists at target position:', {
                existingNodeId: existingNode.id,
                targetNodeId: nodeId
            });
            return false;
        }

        // Obtener todos los nodos conectados que deberían moverse juntos
        const connectedNodes = this.getConnectedNodesInGraph(node);
        
        // Calcular el delta del movimiento
        const deltaX = newPosition.x - node.position.x;
        const deltaY = newPosition.y - node.position.y;
        
        // Verificar todas las nuevas posiciones antes de mover
        const newPositions = new Map<string, Point>();
        for (const connectedNode of connectedNodes) {
            const newNodePosition = {
                x: connectedNode.position.x + deltaX,
                y: connectedNode.position.y + deltaY
            };

            // Verificar si hay un nodo existente en la nueva posición
            const existingAtNewPos = this.findNodeAtPosition(newNodePosition);
            if (existingAtNewPos && !connectedNodes.includes(existingAtNewPos)) {
                console.warn('Cannot move due to existing node at target position:', {
                    movingNodeId: connectedNode.id,
                    existingNodeId: existingAtNewPos.id
                });
                return false;
            }

            newPositions.set(connectedNode.id, newNodePosition);
        }

        // Si todas las posiciones están libres, realizar el movimiento
        for (const connectedNode of connectedNodes) {
            const newPos = newPositions.get(connectedNode.id);
            if (newPos) {
                connectedNode.position = newPos;
                this.updateNodeConnections(connectedNode);
            }
        }

        // Emitir eventos de movimiento para todos los nodos
        this.emitGraphEvent(
            WallGraphEventType.NODE_MOVED,
            connectedNodes.map(n => n.id),
            this.getAffectedWalls(connectedNodes)
        );

        return true;
    }

    private findNodeAtPosition(position: Point, threshold: number = 1): IWallNode | null {
        for (const node of this.nodes.values()) {
            if (getDistance(node.position, position) < threshold) {
                console.debug('Found existing node at position:', {
                    nodeId: node.id,
                    position,
                    distance: getDistance(node.position, position)
                });
                return node;
            }
        }
        return null;
    }

    private findNodeOnWall(point: Point, wallId: string): IWallNode | null {
        const wall = this.walls.get(wallId);
        if (!wall) return null;

        const startNode = this.nodes.get(wall.startNodeId);
        const endNode = this.nodes.get(wall.endNodeId);
        if (!startNode || !endNode) return null;

        // Check if point is near existing nodes
        const existingNode = this.findNodeAtPosition(point);
        if (existingNode) return existingNode;

        // Check if point is on wall line
        if (pointToLineDistance(point, startNode.position, endNode.position) < 0.1 &&
            isPointOnSegment(point, startNode.position, endNode.position)) {
            return this.createNode(point);
        }

        return null;
    }

    private getConnectedNodesInGraph(startNode: IWallNode): IWallNode[] {
        const visited = new Set<string>();
        const result: IWallNode[] = [];
        
        const traverse = (node: IWallNode) => {
            if (visited.has(node.id)) return;
            visited.add(node.id);
            result.push(node);
            
            node.connectedNodes.forEach((conn, nodeId) => {
                const connectedNode = this.nodes.get(nodeId);
                if (connectedNode) {
                    traverse(connectedNode);
                }
            });
        };
        
        traverse(startNode);
        return result;
    }

    private getAffectedWalls(nodes: IWallNode[]): string[] {
        const wallIds = new Set<string>();
        nodes.forEach(node => {
            node.connectedNodes.forEach(conn => {
                wallIds.add(conn.wallId);
            });
        });
        return Array.from(wallIds);
    }

    public removeNode(nodeId: string): boolean {
        const node = this.nodes.get(nodeId);
        if (!node) return false;

        // Remove all connected walls first
        const wallsToRemove = Array.from(node.connectedNodes.values()).map(conn => conn.wallId);
        wallsToRemove.forEach(wallId => this.removeWall(wallId));

        // Remove the node
        this.nodes.delete(nodeId);
        this.emitGraphEvent(WallGraphEventType.NODE_REMOVED, [nodeId], wallsToRemove);
        return true;
    }

    // Wall Operations
    public connectNodes(startNodeId: string, endNodeId: string, thickness: number = 10, height: number = 280): NodeConnectionResult {
        const startNode = this.nodes.get(startNodeId);
        const endNode = this.nodes.get(endNodeId);

        if (!startNode || !endNode) {
            return { success: false, error: 'Invalid node IDs' };
        }

        // Validate connection
        const validationResult = this.validateConnection(startNode, endNode);
        if (!validationResult.isValid) {
            return { success: false, error: validationResult.errors.join(', ') };
        }

        // Verificar si hay paredes existentes en el camino
        const existingNodes = new Set<IWallNode>();
        this.walls.forEach((wall, wallId) => {
            const intersection = this.lineIntersection(
                startNode.position,
                endNode.position,
                this.nodes.get(wall.startNodeId)?.position || { x: 0, y: 0 },
                this.nodes.get(wall.endNodeId)?.position || { x: 0, y: 0 }
            );

            if (intersection) {
                const nodeOnWall = this.findNodeOnWall(intersection, wallId);
                if (nodeOnWall) {
                    existingNodes.add(nodeOnWall);
                }
            }
        });

        // Si encontramos nodos existentes, crear conexiones a través de ellos
        if (existingNodes.size > 0) {
            const orderedNodes = Array.from(existingNodes).sort((a, b) => {
                const distA = this.getDistance(startNode.position, a.position);
                const distB = this.getDistance(startNode.position, b.position);
                return distA - distB;
            });

            let currentStartId = startNodeId;
            for (const node of orderedNodes) {
                if (currentStartId !== node.id) {
                    this._createDirectConnection(currentStartId, node.id, thickness, height);
                }
                currentStartId = node.id;
            }

            if (currentStartId !== endNodeId) {
                this._createDirectConnection(currentStartId, endNodeId, thickness, height);
            }

            // Actualizar metadata de todos los nodos afectados
            const allNodes = new Set([startNode, endNode, ...orderedNodes]);
            allNodes.forEach(node => this.updateNodeMetadata(node));

            return { success: true };
        }

        // Si no hay intersecciones, crear una conexión directa
        return this._createDirectConnection(startNodeId, endNodeId, thickness, height);
    }

    private _createDirectConnection(startNodeId: string, endNodeId: string, thickness: number, height: number): NodeConnectionResult {
        const startNode = this.nodes.get(startNodeId);
        const endNode = this.nodes.get(endNodeId);

        if (!startNode || !endNode) {
            return { success: false, error: 'Invalid node IDs' };
        }

        // Create wall
        const wall: IWall = {
            id: uuidv4(),
            startNodeId,
            endNodeId,
            thickness,
            height,
            properties: {}
        };

        // Calculate angle between nodes
        const angle = calculateAngle(startNode.position, endNode.position);

        // Create connections
        const startConnection: IWallConnection = {
            nodeId: endNodeId,
            wallId: wall.id,
            angle
        };

        const endConnection: IWallConnection = {
            nodeId: startNodeId,
            wallId: wall.id,
            angle: angle + Math.PI
        };

        // Update nodes
        startNode.connectedNodes.set(endNodeId, startConnection);
        endNode.connectedNodes.set(startNodeId, endConnection);

        // Update metadata
        this.updateNodeMetadata(startNode);
        this.updateNodeMetadata(endNode);

        // Save wall
        this.walls.set(wall.id, wall);
        this.emitGraphEvent(WallGraphEventType.WALL_ADDED, [startNodeId, endNodeId], [wall.id]);

        return { success: true, wallId: wall.id };
    }

    private findWallIntersections(start: Point, end: Point): Array<{ point: Point, wallId: string }> {
        const intersections: Array<{ point: Point, wallId: string }> = [];
        
        this.walls.forEach((wall, wallId) => {
            const wallStart = this.nodes.get(wall.startNodeId);
            const wallEnd = this.nodes.get(wall.endNodeId);
            
            if (wallStart && wallEnd) {
                const intersection = findIntersection(
                    start,
                    end,
                    wallStart.position,
                    wallEnd.position
                );
                
                if (intersection) {
                    intersections.push({
                        point: intersection,
                        wallId
                    });
                }
            }
        });
        
        return intersections;
    }

    public removeWall(wallId: string): boolean {
        const wall = this.walls.get(wallId);
        if (!wall) return false;

        // Remove connections from nodes
        const startNode = this.nodes.get(wall.startNodeId);
        const endNode = this.nodes.get(wall.endNodeId);

        if (startNode) {
            startNode.connectedNodes.delete(wall.endNodeId);
            this.updateNodeMetadata(startNode);
        }

        if (endNode) {
            endNode.connectedNodes.delete(wall.startNodeId);
            this.updateNodeMetadata(endNode);
        }

        // Remove wall
        this.walls.delete(wallId);
        this.emitGraphEvent(WallGraphEventType.WALL_REMOVED, [wall.startNodeId, wall.endNodeId], [wallId]);
        return true;
    }

    // Helper methods
    private validateConnection(startNode: IWallNode, endNode: IWallNode): NodeValidationResult {
        const errors: string[] = [];

        // Check if nodes are already connected
        if (startNode.connectedNodes.has(endNode.id)) {
            errors.push('Nodes are already connected');
        }

        // Check if nodes are at the same position
        if (getDistance(startNode.position, endNode.position) < 0.1) {
            errors.push('Nodes are too close');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private updateNodeConnections(node: IWallNode): void {
        // Update angles for all connections
        node.connectedNodes.forEach((connection, connectedNodeId) => {
            const connectedNode = this.nodes.get(connectedNodeId);
            if (connectedNode) {
                const newAngle = calculateAngle(node.position, connectedNode.position);
                connection.angle = newAngle;
                
                // Update the connected node's angle back to this node
                const reverseConnection = connectedNode.connectedNodes.get(node.id);
                if (reverseConnection) {
                    reverseConnection.angle = newAngle + Math.PI;
                }
            }
        });
    }

    private updateNodeMetadata(node: IWallNode): void {
        const connectionCount = node.connectedNodes.size;
        
        // Calcular los ángulos únicos de las conexiones
        const uniqueAngles = new Set<number>();
        node.connectedNodes.forEach(conn => {
            // Redondear el ángulo a 2 decimales para evitar problemas de precisión
            const roundedAngle = Math.round(conn.angle * 100) / 100;
            uniqueAngles.add(roundedAngle);
        });

        const metadata: IWallNodeMetadata = {
            isCorner: uniqueAngles.size === 2,
            isIntersection: connectionCount > 2 || uniqueAngles.size > 2,
            isEndpoint: connectionCount === 1
        };

        node.metadata = metadata;
        
        // Emitir evento de cambio para actualizar la visualización
        this.emitGraphEvent(WallGraphEventType.NODE_MOVED, [node.id], 
            Array.from(node.connectedNodes.values()).map(conn => conn.wallId)
        );
    }

    private emitGraphEvent(type: WallGraphEventType, nodeIds: string[], wallIds: string[]): void {
        const event: IWallGraphEvent = {
            type,
            nodeIds,
            wallIds
        };
        this.eventEmitter.emit('wallGraphChanged', event);
    }

    // Graph query methods
    public getNode(nodeId: string): IWallNode | undefined {
        return this.nodes.get(nodeId);
    }

    public getWall(wallId: string): IWall | undefined {
        return this.walls.get(wallId);
    }

    public getAllNodes(): IWallNode[] {
        return Array.from(this.nodes.values());
    }

    public getAllWalls(): IWall[] {
        return Array.from(this.walls.values());
    }

    public getConnectedNodes(nodeId: string): IWallNode[] {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        return Array.from(node.connectedNodes.keys())
            .map(id => this.nodes.get(id))
            .filter((n): n is IWallNode => n !== undefined);
    }

    public getNodeWalls(nodeId: string): IWall[] {
        const node = this.nodes.get(nodeId);
        if (!node) return [];

        return Array.from(node.connectedNodes.values())
            .map(conn => this.walls.get(conn.wallId))
            .filter((w): w is IWall => w !== undefined);
    }

    public getWallStartNodeId(wallId: string): string | null {
        const wall = this.walls.get(wallId);
        return wall ? wall.startNodeId : null;
    }

    public getWallEndNodeId(wallId: string): string | null {
        const wall = this.walls.get(wallId);
        return wall ? wall.endNodeId : null;
    }

    // Event handling
    public onGraphChanged(callback: (event: IWallGraphEvent) => void): void {
        this.eventEmitter.on('wallGraphChanged', callback);
    }

    public offGraphChanged(callback: (event: IWallGraphEvent) => void): void {
        this.eventEmitter.off('wallGraphChanged', callback);
    }
} 