import { Vector2 } from 'three';
import { WallGraph } from '../models/WallGraph';
import { WallToolState, WallToolMode, WallToolStateContext } from './WallToolState';
import { WallNode } from '../models/WallNode';
import { Wall } from '../models/Wall';
import { Layer } from 'konva/lib/Layer';
import { KonvaEventObject } from 'konva/lib/Node';
import { WallRenderer } from '../renderers/WallRenderer';
import { NodeRenderer } from '../renderers/NodeRenderer';
import { Line } from 'konva/lib/shapes/Line';
import { Circle } from 'konva/lib/shapes/Circle';
import { CanvasStore } from '../../../store/CanvasStore';
import { IEventManager } from '../../../core/interfaces/IEventManager';

export interface WallToolConfig {
    defaultWallProperties: {
        thickness: number;
        height: number;
        material?: string;
    };
    snapThreshold: number;
    nodeRadius: number;
}

export class WallToolCore {
    private readonly state: WallToolState;
    private readonly config: WallToolConfig;
    private mainLayer: Layer | null = null;
    private previewLayer: Layer | null = null;

    // Cached Konva objects
    private wallShapes: Map<string, Line> = new Map();
    private nodeShapes: Map<string, Circle> = new Map();
    private previewLine: Line | null = null;
    private previewNode: Circle | null = null;

    constructor(
        config: WallToolConfig,
        private readonly canvasStore: CanvasStore,
        private readonly eventManager: IEventManager
    ) {
        this.config = config;
        
        const context: WallToolStateContext = {
            graph: this.canvasStore.getWallGraph(),
            defaultProperties: config.defaultWallProperties
        };
        
        this.state = new WallToolState(context, eventManager);
    }

    // Layer setup
    setLayers(mainLayer: Layer, previewLayer: Layer): void {
        this.mainLayer = mainLayer;
        this.previewLayer = previewLayer;
        this.redrawAll();
    }

    // Event handlers
    handleMouseDown(e: KonvaEventObject<MouseEvent>): void {
        const point = this.getMousePosition(e);
        
        // Check for nearby nodes before handling mouse down
        const nearestNode = this.findNearestNode(point);
        
        if (this.state.getMode() === WallToolMode.DRAWING) {
            // If we're drawing and find a nearby node, connect to it
            if (nearestNode) {
                const startNode = this.state.getStartNode();
                if (startNode && startNode !== nearestNode) {
                    const wall = this.canvasStore.getWallGraph().createWall(startNode, nearestNode, this.config.defaultWallProperties);
                    // Emit wall created event
                    this.eventManager.emit('wall:created', { wall });
                }
                this.state.setMode(WallToolMode.IDLE);
            } else {
                // No nearby node, create a new one through state
                this.state.handleMouseDown(point);
                
                // After state creates the node, check for possible merges
                const currentNode = this.state.getStartNode();
                if (currentNode) {
                    const nodePos = currentNode.getPosition();
                    this.handleNodePositionUpdate(currentNode, new Vector2(nodePos.x, nodePos.y));
                }
            }
        } else if (this.state.getMode() === WallToolMode.IDLE) {
            if (nearestNode) {
                // Start drawing from the existing node
                this.state.handleMouseDown(nearestNode.getPosition());
            } else {
                // Create new node and start drawing
                this.state.handleMouseDown(point);
                
                // Check for possible merges after node creation
                const currentNode = this.state.getStartNode();
                if (currentNode) {
                    const nodePos = currentNode.getPosition();
                    this.handleNodePositionUpdate(currentNode, new Vector2(nodePos.x, nodePos.y));
                }
            }
        } else {
            // Handle other modes
            this.state.handleMouseDown(point);
        }
        
        this.redrawAll();
    }

    handleMouseMove(e: KonvaEventObject<MouseEvent>): void {
        const point = this.getMousePosition(e);
        this.state.handleMouseMove(point);
        this.redrawPreview();
    }

    handleMouseUp(e: KonvaEventObject<MouseEvent>): void {
        const point = this.getMousePosition(e);
        this.state.handleMouseUp(point);
        this.redrawAll();
    }

    // Mode control
    setMode(mode: WallToolMode): void {
        this.state.setMode(mode);
        this.redrawAll();
    }

    getMode(): WallToolMode {
        return this.state.getMode();
    }

    // Graph operations
    getAllWalls(): Wall[] {
        return this.canvasStore.getWallGraph().getAllWalls();
    }

    getAllNodes(): WallNode[] {
        return this.canvasStore.getWallGraph().getAllNodes();
    }

    clear(): void {
        this.canvasStore.getWallGraph().clear();
        this.redrawAll();
    }

    // Rendering methods
    redrawAll(): void {
        if (!this.mainLayer) return;

        // Clear existing shapes
        this.wallShapes.clear();
        this.nodeShapes.clear();
        this.mainLayer.destroyChildren();

        // Render all walls
        const walls = this.canvasStore.getWallGraph().getAllWalls();
        walls.forEach(wall => {
            const shape = WallRenderer.createWallLine(wall, this.mainLayer!);
            this.wallShapes.set(wall.getId(), shape);
        });

        // Render all nodes
        const nodes = this.canvasStore.getWallGraph().getAllNodes();
        nodes.forEach(node => {
            const shape = NodeRenderer.createNodeCircle(node, this.config.nodeRadius, this.mainLayer!);
            this.nodeShapes.set(node.getId(), shape);
        });

        this.mainLayer.batchDraw();
    }

    private redrawPreview(): void {
        if (!this.previewLayer) return;
        this.previewLayer.destroyChildren();
        this.drawPreview();
        this.previewLayer.batchDraw();
    }

    private drawWalls(layer: Layer): void {
        this.canvasStore.getWallGraph().getAllWalls().forEach(wall => {
            const line = WallRenderer.createWallLine(wall, layer);
            this.wallShapes.set(wall.getId(), line);
            layer.add(line);
        });
    }

    private drawNodes(layer: Layer): void {
        this.canvasStore.getWallGraph().getAllNodes().forEach(node => {
            const circle = NodeRenderer.createNodeCircle(node, this.config.nodeRadius, layer);
            
            // Setup drag events
            circle.on('dragmove', () => {
                const pos = circle.position();
                // Just update the node and wall positions during drag
                node.setPosition(pos.x, pos.y);
                
                // Update connected walls
                node.getConnectedWalls().forEach(wall => {
                    const wallShape = this.wallShapes.get(wall.getId());
                    if (wallShape) {
                        WallRenderer.updateWallLine(wallShape, wall as Wall);
                    }
                });
            });

            circle.on('dragend', () => {
                const pos = circle.position();
                const point = new Vector2(pos.x, pos.y);
                
                // Check for merges after drag ends
                const nearestNode = this.findNearestNode(point, node);
                if (nearestNode) {
                    this.mergeNodes(nearestNode, node);
                    this.redrawAll();
                }
            });

            this.nodeShapes.set(node.getId(), circle);
            layer.add(circle);
        });
    }

    private drawPreview(): void {
        if (!this.previewLayer) return;

        const startNode = this.state.getStartNode();
        const tempPoint = this.state.getTempPoint();

        if (startNode && tempPoint && this.state.getMode() === WallToolMode.DRAWING) {
            const startPos = startNode.getPosition();

            // Draw preview line
            if (!this.previewLine) {
                this.previewLine = WallRenderer.createPreviewLine(
                    startPos,
                    tempPoint,
                    this.previewLayer
                );
            } else {
                WallRenderer.updatePreviewLine(
                    this.previewLine,
                    startPos,
                    tempPoint
                );
            }

            // Draw preview node
            if (!this.previewNode) {
                this.previewNode = NodeRenderer.createPreviewCircle(
                    tempPoint,
                    this.config.nodeRadius,
                    this.previewLayer,
                    false
                );
            } else {
                NodeRenderer.updatePreviewCircle(
                    this.previewNode,
                    tempPoint
                );
            }
        }

        const activeWall = this.state.getActiveWall();
        if (activeWall && tempPoint && this.state.getMode() === WallToolMode.SPLITTING_WALL) {
            if (!this.previewNode) {
                this.previewNode = NodeRenderer.createPreviewCircle(
                    tempPoint,
                    this.config.nodeRadius,
                    this.previewLayer,
                    true
                );
            } else {
                NodeRenderer.updatePreviewCircle(
                    this.previewNode,
                    tempPoint
                );
            }
        }
    }

    // Helper methods
    private getMousePosition(e: KonvaEventObject<MouseEvent>): Vector2 {
        let x = 0;
        let y = 0;

        try {
            // First try to get stage pointer position
            const stage = e.target.getStage();
            if (stage) {
                const point = stage.getPointerPosition();
                if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
                    x = point.x;
                    y = point.y;
                }
            }

            // If stage coordinates are not available, fall back to event coordinates
            if (x === 0 && y === 0 && e.evt) {
                const rect = (e.evt.target as HTMLElement)?.getBoundingClientRect?.();
                if (rect) {
                    x = e.evt.clientX - rect.left;
                    y = e.evt.clientY - rect.top;
                } else {
                    x = e.evt.clientX || 0;
                    y = e.evt.clientY || 0;
                }
            }
        } catch (error) {
            console.warn('Error getting mouse position, using fallback coordinates');
        }

        // Ensure final coordinates are valid numbers
        x = Number.isFinite(x) ? Math.round(x) : 0;
        y = Number.isFinite(y) ? Math.round(y) : 0;

        return new Vector2(x, y);
    }

    private mergeNodes(movedNode: WallNode, targetNode: WallNode): WallNode {
        const graph = this.canvasStore.getWallGraph();
        const connectedWalls = targetNode.getConnectedWalls();

        console.log('Merging nodes:', {
            movedNode: {
                id: movedNode.getId(),
                position: movedNode.getPosition(),
                connectedWalls: movedNode.getConnectedWalls().map(w => w.getId())
            },
            targetNode: {
                id: targetNode.getId(),
                position: targetNode.getPosition(),
                connectedWalls: connectedWalls.map(w => w.getId())
            }
        });

        // Transfer all connections from targetNode to movedNode
        connectedWalls.forEach(wall => {
            const wallInstance = wall as Wall;
            if (wallInstance.getStartNode() === targetNode) {
                console.log('Transferring wall connection:', {
                    wallId: wallInstance.getId(),
                    from: 'start',
                    oldNode: targetNode.getId(),
                    newNode: movedNode.getId()
                });
                // Create new wall connecting movedNode to the other end
                graph.createWall(movedNode, wallInstance.getEndNode() as WallNode, wallInstance.getProperties());
            } else if (wallInstance.getEndNode() === targetNode) {
                console.log('Transferring wall connection:', {
                    wallId: wallInstance.getId(),
                    from: 'end',
                    oldNode: targetNode.getId(),
                    newNode: movedNode.getId()
                });
                // Create new wall connecting the start to movedNode
                graph.createWall(wallInstance.getStartNode() as WallNode, movedNode, wallInstance.getProperties());
            }
            // Remove the old wall
            graph.removeWall(wallInstance.getId());
        });

        // Remove the target node
        graph.removeNode(targetNode.getId());
        console.log('Merge complete:', {
            remainingNode: movedNode.getId(),
            newConnections: movedNode.getConnectedWalls().map(w => w.getId())
        });

        return movedNode;
    }

    private findNearestNode(point: Vector2, excludeNode?: WallNode): WallNode | null {
        const nodes = this.canvasStore.getWallGraph().getAllNodes();
        let nearestNode: WallNode | null = null;
        let minDistance = this.config.snapThreshold;

        nodes.forEach(node => {
            // Skip the excluded node if provided
            if (excludeNode && node.getId() === excludeNode.getId()) {
                return;
            }

            const nodePos = node.getPosition();
            const distance = point.distanceTo(new Vector2(nodePos.x, nodePos.y));
            if (distance < minDistance) {
                minDistance = distance;
                nearestNode = node;
            }
        });

        return nearestNode;
    }

    private handleWallCreation(startNode: WallNode, endPoint: Vector2): void {
        // Check for nearby nodes at the end point
        const nearestNode = this.findNearestNode(endPoint);
        if (nearestNode) {
            // Create wall to existing node
            const wall = this.canvasStore.getWallGraph().createWall(startNode, nearestNode, this.config.defaultWallProperties);
            // Emit wall created event
            this.eventManager.emit('wall:created', { wall });
        } else {
            // Create new node and wall
            const endNode = this.canvasStore.getWallGraph().addNode(endPoint.x, endPoint.y);
            const wall = this.canvasStore.getWallGraph().createWall(startNode, endNode, this.config.defaultWallProperties);
            // Emit wall created event
            this.eventManager.emit('wall:created', { wall });
        }
    }

    // Node position middleware
    private handleNodePositionUpdate(node: WallNode, position: Vector2): void {
        console.log('Handling node position update:', {
            nodeId: node.getId(),
            oldPosition: node.getPosition(),
            newPosition: position,
            connectedWalls: node.getConnectedWalls().map(w => w.getId())
        });

        // First update the position
        node.setPosition(position.x, position.y);

        // Then check for possible merges
        const nearestNode = this.findNearestNode(position, node);
        console.log('Checking for nearby nodes:', {
            nodeId: node.getId(),
            position: position,
            foundNearbyNode: nearestNode ? {
                id: nearestNode.getId(),
                position: nearestNode.getPosition(),
                distance: position.distanceTo(nearestNode.getPosition())
            } : null,
            snapThreshold: this.config.snapThreshold
        });

        if (nearestNode) {
            console.log('Found nearby node, initiating merge');
            this.mergeNodes(nearestNode, node);
            this.redrawAll();
            return;
        }

        console.log('No merge needed, updating connected walls');
        // If no merge occurred, just update connected walls
        node.getConnectedWalls().forEach(wall => {
            const wallShape = this.wallShapes.get(wall.getId());
            if (wallShape) {
                WallRenderer.updateWallLine(wallShape, wall as Wall);
            }
        });
    }
} 