import Konva from 'konva';
import { ToolType } from './Toolbar';
import { ProjectStore, Point, Wall } from '../store/ProjectStore';

export class Canvas2D {
    private stage: Konva.Stage;
    private layer: Konva.Layer;
    private gridLayer: Konva.Layer;
    private tempLine: Konva.Line | null = null;
    private isDrawing: boolean = false;
    private gridSize: number = 50;
    private currentTool: ToolType = ToolType.SELECT;
    private selectedShape: Konva.Shape | null = null;
    private container: HTMLElement;

    constructor(containerId: string, private store: ProjectStore) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Container not found');
        this.container = container;

        // Initialize Konva Stage with container dimensions
        this.stage = new Konva.Stage({
            container: containerId,
            width: container.clientWidth,
            height: container.clientHeight
        });

        // Create grid layer
        this.gridLayer = new Konva.Layer();
        
        // Create main layer for walls and objects
        this.layer = new Konva.Layer();

        // Add layers to stage
        this.stage.add(this.gridLayer);
        this.stage.add(this.layer);

        // Set initial scale and position
        const initialScale = 1;
        this.gridLayer.scale({ x: initialScale, y: initialScale });
        this.layer.scale({ x: initialScale, y: initialScale });

        // Center the view
        this.centerView();

        // Draw initial grid
        this.drawGrid();

        // Setup event listeners
        this.setupEventListeners();

        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));

        // Subscribe to store changes
        this.store.subscribe(() => this.updateFromStore());

        // Initial update from store
        this.updateFromStore();
    }

    private centerView(): void {
        // Get stage dimensions
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();

        // Set the new position for both layers to center
        const centerX = stageWidth / 2;
        const centerY = stageHeight / 2;

        this.gridLayer.position({ x: centerX, y: centerY });
        this.layer.position({ x: centerX, y: centerY });

        // Update the stage
        this.stage.batchDraw();
    }

    private drawGrid(): void {
        // Clear existing grid
        this.gridLayer.destroyChildren();

        // Calculate grid dimensions
        const viewportWidth = this.stage.width() * 2;
        const viewportHeight = this.stage.height() * 2;
        const offsetX = -viewportWidth / 2;
        const offsetY = -viewportHeight / 2;

        // Add background
        const background = new Konva.Rect({
            x: offsetX,
            y: offsetY,
            width: viewportWidth,
            height: viewportHeight,
            fill: '#f8f9fa'
        });
        this.gridLayer.add(background);

        // Draw grid lines
        for (let x = offsetX; x <= viewportWidth / 2; x += this.gridSize) {
            this.gridLayer.add(new Konva.Line({
                points: [x, offsetY, x, -offsetY],
                stroke: x === 0 ? '#2c3e50' : '#e2e8f0',
                strokeWidth: x === 0 ? 2 : 1
            }));
        }

        for (let y = offsetY; y <= viewportHeight / 2; y += this.gridSize) {
            this.gridLayer.add(new Konva.Line({
                points: [offsetX, y, -offsetX, y],
                stroke: y === 0 ? '#2c3e50' : '#e2e8f0',
                strokeWidth: y === 0 ? 2 : 1
            }));
        }

        // Add "2D Editor" label
        const label = new Konva.Text({
            x: 20,
            y: 20,
            text: '2D Editor - Click and drag to draw walls',
            fontSize: 16,
            fontFamily: 'Arial',
            fill: '#2c3e50',
            padding: 10,
            backgroundColor: 'rgba(255,255,255,0.8)',
            cornerRadius: 5
        });
        this.gridLayer.add(label);

        this.gridLayer.batchDraw();
    }

    private getRelativePointerPosition(): Point | null {
        const pos = this.stage.getPointerPosition();
        if (!pos) return null;

        // Convert stage coordinates to layer coordinates
        const layerPos = {
            x: (pos.x - this.layer.x()) / this.layer.scaleX(),
            y: (pos.y - this.layer.y()) / this.layer.scaleY()
        };

        return layerPos;
    }

    private setupEventListeners(): void {
        // Add mouse wheel zoom
        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            
            const oldScale = this.layer.scaleX();
            const pointer = this.stage.getPointerPosition();
            
            if (!pointer) return;
            
            const mousePointTo = {
                x: (pointer.x - this.layer.x()) / oldScale,
                y: (pointer.y - this.layer.y()) / oldScale,
            };
            
            // How much we zoom
            const zoomAmount = e.evt.deltaY > 0 ? 0.9 : 1.1;
            
            // Apply zoom
            const newScale = oldScale * zoomAmount;
            
            // Limit zoom
            if (newScale > 0.1 && newScale < 5) {
                this.layer.scale({ x: newScale, y: newScale });
                this.gridLayer.scale({ x: newScale, y: newScale });
                
                // Update position to maintain mouse point
                const newPos = {
                    x: pointer.x - mousePointTo.x * newScale,
                    y: pointer.y - mousePointTo.y * newScale,
                };
                this.layer.position(newPos);
                this.gridLayer.position(newPos);
                
                this.stage.batchDraw();
            }
        });

        // Handle drawing and dragging
        this.stage.on('mousedown touchstart', (e) => {
            e.evt.preventDefault();
            const pos = this.getRelativePointerPosition();
            if (!pos) return;

            if (this.currentTool === ToolType.WALL) {
                this.startDrawing(pos);
            } else {
                // Enable dragging for non-drawing tools
                this.stage.draggable(true);
            }
        });

        this.stage.on('mousemove touchmove', (e) => {
            e.evt.preventDefault();
            if (this.isDrawing) {
                this.handleDrawing(e);
            }
        });

        this.stage.on('mouseup touchend', () => {
            if (this.isDrawing) {
                this.handleDrawingEnd();
            }
            this.stage.draggable(false);
        });

        // Handle mouse leave
        this.stage.on('mouseleave', () => {
            if (this.isDrawing) {
                this.handleDrawingEnd();
            }
            this.stage.draggable(false);
        });

        // Add selection functionality
        this.layer.on('click tap', (e) => {
            if (this.currentTool === ToolType.SELECT) {
                this.handleSelection(e);
            }
        });

        // Debug: Log pointer position
        this.stage.on('mousemove', () => {
            const pos = this.getRelativePointerPosition();
            if (pos) {
                const debugOverlay = document.querySelector('.debug-overlay');
                if (debugOverlay) {
                    debugOverlay.textContent = `Position: ${Math.round(pos.x)}, ${Math.round(pos.y)}`;
                }
            }
        });
    }

    private handleStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
        if (this.currentTool === ToolType.WALL) {
            const pos = this.stage.getPointerPosition();
            if (!pos) return;

            if (!this.isDrawing) {
                this.startDrawing(pos);
            }
        }
    }

    private startDrawing(pos: Point): void {
        const layerPos = this.getRelativePointerPosition();
        if (!layerPos) return;

        this.isDrawing = true;
        this.tempLine = new Konva.Line({
            points: [layerPos.x, layerPos.y, layerPos.x, layerPos.y],
            stroke: '#2c3e50',
            strokeWidth: 3,
            dash: [5, 5],
            lineCap: 'round'
        });
        this.layer.add(this.tempLine);
    }

    private handleDrawing(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
        const layerPos = this.getRelativePointerPosition();
        if (!layerPos || !this.tempLine) return;

        const points = this.tempLine.points();
        this.tempLine.points([points[0], points[1], layerPos.x, layerPos.y]);
        this.layer.batchDraw();
    }

    private handleDrawingEnd(): void {
        if (!this.isDrawing || !this.tempLine) return;

        const points = this.tempLine.points();
        const start: Point = { x: points[0], y: points[1] };
        const end: Point = { x: points[2], y: points[3] };

        // Only create wall if it has some length
        if (this.getDistance(start, end) > 10) {
            this.store.addWall(start, end);
        }

        this.tempLine.destroy();
        this.tempLine = null;
        this.isDrawing = false;
        this.layer.batchDraw();
    }

    private getDistance(p1: Point, p2: Point): number {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private handleSelection(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
        // Deselect previous selection
        if (this.selectedShape) {
            this.selectedShape.strokeWidth(2);
        }

        const clickedShape = e.target;
        if (clickedShape instanceof Konva.Shape) {
            this.selectedShape = clickedShape;
            this.selectedShape.strokeWidth(4);
            this.layer.batchDraw();
        } else {
            this.selectedShape = null;
        }
    }

    private updateFromStore(): void {
        // Clear existing shapes
        this.layer.destroyChildren();

        // Redraw walls
        this.store.getWalls().forEach(wall => {
            const line = new Konva.Line({
                points: [wall.start.x, wall.start.y, wall.end.x, wall.end.y],
                stroke: '#2c3e50',
                strokeWidth: 3,
                lineCap: 'round',
                id: wall.id
            });
            this.layer.add(line);
        });

        // Redraw openings (doors and windows)
        this.store.getOpenings().forEach(opening => {
            const rect = new Konva.Rect({
                x: opening.position.x - opening.width / 2,
                y: opening.position.y - opening.width / 2,
                width: opening.width,
                height: opening.width,
                fill: opening.type === 'door' ? '#e67e22' : '#3498db',
                cornerRadius: 4,
                id: opening.id
            });
            this.layer.add(rect);
        });

        this.layer.batchDraw();
    }

    private handleResize(): void {
        // Update stage size to match container
        this.stage.width(this.container.clientWidth);
        this.stage.height(this.container.clientHeight);
        
        // Center the view
        this.centerView();
        
        // Redraw grid
        this.drawGrid();
        
        // Update layers
        this.gridLayer.batchDraw();
        this.layer.batchDraw();
    }

    public setTool(tool: ToolType): void {
        this.currentTool = tool;
        // Reset any ongoing operations when tool changes
        if (this.isDrawing) {
            this.handleDrawingEnd();
        }
        if (this.selectedShape) {
            this.selectedShape.strokeWidth(2);
            this.selectedShape = null;
            this.layer.batchDraw();
        }
        // Disable stage dragging when in wall drawing mode
        this.stage.draggable(tool !== ToolType.WALL);
    }

    public clear(): void {
        this.layer.destroyChildren();
        this.layer.batchDraw();
        this.store.clear();
    }
} 