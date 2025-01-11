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
    private readonly graph: WallGraph;
    private readonly state: WallToolState;
    private readonly config: WallToolConfig;
    private mainLayer: Layer | null = null;
    private previewLayer: Layer | null = null;

    // Cached Konva objects
    private wallShapes: Map<string, Line> = new Map();
    private nodeShapes: Map<string, Circle> = new Map();
    private previewLine: Line | null = null;
    private previewNode: Circle | null = null;

    constructor(config: WallToolConfig) {
        this.config = config;
        this.graph = new WallGraph();
        
        const context: WallToolStateContext = {
            graph: this.graph,
            defaultProperties: config.defaultWallProperties
        };
        
        this.state = new WallToolState(context);
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
        this.state.handleMouseDown(point);
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
        return this.graph.getAllWalls();
    }

    getAllNodes(): WallNode[] {
        return this.graph.getAllNodes();
    }

    clear(): void {
        this.graph.clear();
        this.redrawAll();
    }

    // Helper methods
    private getMousePosition(e: KonvaEventObject<MouseEvent>): Vector2 {
        try {
            const stage = e.target.getStage();
            if (!stage) {
                console.warn('No stage available, using event coordinates');
                // Try to get coordinates from the event itself
                return new Vector2(
                    Math.round(e.evt.clientX || 0),
                    Math.round(e.evt.clientY || 0)
                );
            }
            
            const point = stage.getPointerPosition();
            if (!point) {
                console.warn('No pointer position, using event coordinates');
                return new Vector2(
                    Math.round(e.evt.clientX || 0),
                    Math.round(e.evt.clientY || 0)
                );
            }

            // Ensure coordinates are valid numbers
            let x = Number(point.x);
            let y = Number(point.y);

            // If we got NaN, try to get coordinates from the event
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                console.warn('Invalid stage coordinates, using event coordinates');
                x = Number(e.evt.clientX || 0);
                y = Number(e.evt.clientY || 0);
            }

            // Final validation and rounding
            x = Number.isFinite(x) ? Math.round(x) : 0;
            y = Number.isFinite(y) ? Math.round(y) : 0;

            return new Vector2(x, y);
        } catch (error) {
            console.error('Error getting mouse position:', error);
            return new Vector2(0, 0);
        }
    }

    // Drawing methods
    private redrawAll(): void {
        if (!this.mainLayer || !this.previewLayer) return;

        this.mainLayer.destroyChildren();
        this.previewLayer.destroyChildren();

        // Clear cached shapes
        this.wallShapes.clear();
        this.nodeShapes.clear();
        this.previewLine = null;
        this.previewNode = null;

        // Draw all permanent walls and nodes
        this.drawWalls(this.mainLayer);
        this.drawNodes(this.mainLayer);

        // Draw preview elements
        this.drawPreview();

        this.mainLayer.batchDraw();
        this.previewLayer.batchDraw();
    }

    private redrawPreview(): void {
        if (!this.previewLayer) return;
        this.previewLayer.destroyChildren();
        this.drawPreview();
        this.previewLayer.batchDraw();
    }

    private drawWalls(layer: Layer): void {
        this.graph.getAllWalls().forEach(wall => {
            const line = WallRenderer.createWallLine(wall, layer);
            this.wallShapes.set(wall.getId(), line);
            layer.add(line);
        });
    }

    private drawNodes(layer: Layer): void {
        this.graph.getAllNodes().forEach(node => {
            const circle = NodeRenderer.createNodeCircle(node, this.config.nodeRadius, layer);
            
            // Setup drag events
            circle.on('dragmove', () => {
                const pos = circle.position();
                node.setPosition(pos.x, pos.y);
                
                // Update connected walls
                node.getConnectedWalls().forEach(wall => {
                    const wallShape = this.wallShapes.get(wall.getId());
                    if (wallShape) {
                        WallRenderer.updateWallLine(wallShape, wall);
                    }
                });
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
} 