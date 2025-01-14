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
import { Text } from 'konva/lib/shapes/Text';

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

    // Renderers
    private readonly wallRenderer: WallRenderer;
    private readonly nodeRenderer: NodeRenderer;

    // Cached Konva objects
    private wallShapes: Map<string, Line> = new Map();
    private nodeShapes: Map<string, Circle> = new Map();

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

        // Initialize renderers
        this.wallRenderer = new WallRenderer({
            thickness: config.defaultWallProperties.thickness,
            color: '#666'
        });

        this.nodeRenderer = new NodeRenderer({
            radius: config.nodeRadius,
            color: '#666'
        });
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
            const shape = this.wallRenderer.createWallLine(wall, this.mainLayer!);
            this.wallShapes.set(wall.getId(), shape);
        });

        // Render all nodes
        const nodes = this.canvasStore.getWallGraph().getAllNodes();
        nodes.forEach(node => {
            const shape = this.nodeRenderer.createNodeCircle(node, this.mainLayer!);
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
        this.wallShapes.clear();
        const walls = this.canvasStore.getWallGraph().getAllWalls();
        walls.forEach(wall => {
            const line = this.wallRenderer.createWallLine(wall, layer);
            this.wallShapes.set(wall.getId(), line);
        });
    }

    private drawNodes(layer: Layer): void {
        this.nodeShapes.clear();
        const nodes = this.canvasStore.getWallGraph().getAllNodes();
        nodes.forEach(node => {
            const circle = this.nodeRenderer.createNodeCircle(node, layer);
            
            // Setup drag events
            circle.on('dragmove', () => {
                const pos = circle.position();
                // Just update the node and wall positions during drag
                node.setPosition(pos.x, pos.y);
                
                // Update connected walls
                node.getConnectedWalls().forEach(wall => {
                    const wallShape = this.wallShapes.get(wall.getId());
                    if (wallShape) {
                        this.wallRenderer.updateWallLine(wallShape, wall as Wall);
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
        });
    }

    private drawPreview(): void {
        if (!this.previewLayer) return;

        // Clear previous preview
        this.previewLayer.destroyChildren();

        const mode = this.state.getMode();
        const startNode = this.state.getStartNode();
        const tempPoint = this.state.getTempPoint();
        const activeNode = this.state.getActiveNode();

        if (mode === WallToolMode.DRAWING && startNode && tempPoint) {
            // Draw wall drawing preview
            const previewWallRenderer = new WallRenderer({
                thickness: this.config.defaultWallProperties.thickness,
                color: '#888888',
                opacity: 0.5,
                dashEnabled: true,
                dash: [5, 5]
            });

            const previewWall = previewWallRenderer.createPreviewWall(
                startNode.getPosition(),
                tempPoint,
                this.config.defaultWallProperties.thickness
            );
            this.previewLayer!.add(previewWall);

            // Draw preview node at cursor position
            const previewNodeRenderer = new NodeRenderer({
                radius: this.config.nodeRadius,
                color: '#888888',
                opacity: 0.5
            });

            const previewNode = previewNodeRenderer.createPreviewNode(tempPoint);
            this.previewLayer!.add(previewNode);

            // Draw preview dimensions
            const startPos = startNode.getPosition();
            const dx = tempPoint.x - startPos.x;
            const dy = tempPoint.y - startPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Only show dimensions if wall is long enough
            if (distance > 20) {
                const dimensionText = Math.round(distance) + ' cm';
                const textX = startPos.x + dx / 2;
                const textY = startPos.y + dy / 2;
                
                const dimensionLabel = new Text({
                    x: textX,
                    y: textY,
                    text: dimensionText,
                    fontSize: 12,
                    fill: '#666666',
                    padding: 4,
                    offsetX: 0,
                    offsetY: -10,
                    rotation: Math.atan2(dy, dx) * 180 / Math.PI
                });
                this.previewLayer!.add(dimensionLabel);
            }
        } else if (mode === WallToolMode.MOVING_NODE && activeNode && tempPoint) {
            // Draw wall movement preview
            const previewWallRenderer = new WallRenderer({
                thickness: this.config.defaultWallProperties.thickness,
                color: '#888888',
                opacity: 0.5,
                dashEnabled: true,
                dash: [5, 5]
            });

            // Draw preview of all connected walls
            activeNode.getConnectedWalls().forEach(wall => {
                const startNode = wall.getStartNode();
                const endNode = wall.getEndNode();
                
                // Skip if either node is missing
                if (!startNode || !endNode || !(startNode instanceof WallNode) || !(endNode instanceof WallNode)) {
                    return;
                }

                const otherNode = startNode === activeNode ? endNode : startNode;
                const previewWall = previewWallRenderer.createPreviewWall(
                    startNode === activeNode ? tempPoint : otherNode.getPosition(),
                    endNode === activeNode ? tempPoint : otherNode.getPosition(),
                    wall.getProperties().thickness || this.config.defaultWallProperties.thickness
                );
                this.previewLayer!.add(previewWall);
            });

            // Draw preview node at cursor position
            const previewNodeRenderer = new NodeRenderer({
                radius: this.config.nodeRadius,
                color: '#888888',
                opacity: 0.5
            });

            const previewNode = previewNodeRenderer.createPreviewNode(tempPoint);
            this.previewLayer!.add(previewNode);

            // Check for nearby nodes to show potential merge
            const nearestNode = this.findNearestNode(tempPoint, activeNode);
            if (nearestNode) {
                const highlightNodeRenderer = new NodeRenderer({
                    radius: this.config.nodeRadius,
                    color: '#4CAF50',
                    opacity: 0.8
                });
                const highlightNode = highlightNodeRenderer.createPreviewNode(nearestNode.getPosition());
                this.previewLayer!.add(highlightNode);
            }
        }

        this.previewLayer.batchDraw();
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
                this.wallRenderer.updateWallLine(wallShape, wall as Wall);
            }
        });
    }
} 