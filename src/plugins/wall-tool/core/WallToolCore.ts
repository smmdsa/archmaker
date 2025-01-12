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
        private readonly canvasStore: CanvasStore
    ) {
        this.config = config;
        
        const context: WallToolStateContext = {
            graph: this.canvasStore.getWallGraph(),
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
                node.setPosition(pos.x, pos.y);
                
                // Update connected walls
                node.getConnectedWalls().forEach(wall => {
                    const wallShape = this.wallShapes.get(wall.getId());
                    if (wallShape) {
                        WallRenderer.updateWallLine(wallShape, wall as Wall);
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
} 