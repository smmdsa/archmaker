import Konva from 'konva';
import { ToolType } from './Toolbar';
import { ProjectStore, Point, Wall } from '../store/ProjectStore';
import { AddWallCommand } from '../store/commands/WallCommands';
import { WallProperties } from './PropertiesPanel';

// Extender la interfaz de Layer para incluir startPos
interface ExtendedLayer extends Konva.Layer {
    startPos?: {
        x: number;
        y: number;
    };
}

export class Canvas2D {
    private RIGHT_CLICK_CONTEXT_MENU: string = 'contextmenu';
    private stage: Konva.Stage;
    private layer: ExtendedLayer;
    private gridLayer: ExtendedLayer;
    private tempLine: Konva.Line | null = null;
    private tempDimensionLabel: Konva.Text | null = null;
    private tempDimensionBackground: Konva.Rect | null = null;
    private isDrawing: boolean = false;
    private gridSize: number = 100; // 100 píxeles = 1 metro
    private readonly GRID_METER_SIZE = 100; // Constante para conversión metro-píxel
    private currentTool: ToolType = ToolType.SELECT;
    private selectedShape: Konva.Shape | null = null;
    private container: HTMLElement;
    private readonly SNAP_THRESHOLD = 20; // Distancia máxima para el snap en píxeles
    private wallProperties: WallProperties = {
        height: 240,
        thickness: 15
    };

    constructor(containerId: string, private store: ProjectStore) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Container not found');
        this.container = container;

        // Prevent right click context menu
        container.addEventListener(this.RIGHT_CLICK_CONTEXT_MENU, (e) => {
            e.preventDefault();
            return false;
        });

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
        this.setupKeyboardShortcuts();

        // Handle window resize
        window.addEventListener('resize', this.handleResize.bind(this));

        // Subscribe to store changes
        this.store.subscribe(() => this.updateFromStore());

        // Initial update from store
        this.updateFromStore();

        // Dibujar los ejes de referencia
        this.drawAxes();
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
        const viewportWidth = this.stage.width() * 8;
        const viewportHeight = this.stage.height() * 8;
        const offsetX = -viewportWidth / 2;
        const offsetY = -viewportHeight / 2;
        const fillColor = '#aaaaaa';
        // Add background
        const background = new Konva.Rect({
            x: offsetX,
            y: offsetY,
            width: viewportWidth,
            height: viewportHeight,
            fill: fillColor
        });
        this.gridLayer.add(background);

        // Draw grid lines
        for (let x = offsetX; x <= viewportWidth / 2; x += this.gridSize) {
            const isMajor = Math.round(x / this.gridSize) % 5 === 0;
            this.gridLayer.add(new Konva.Line({
                points: [x, offsetY, x, -offsetY],
                stroke: x === 0 ? '#2c3e50' : (isMajor ? '#a0aec0' : '#e2e8f0'),
                strokeWidth: x === 0 ? 2 : (isMajor ? 1 : 0.5)
            }));

            // Añadir etiquetas de medida para líneas principales
            if (isMajor && x !== 0) {
                const label = new Konva.Text({
                    x: x - 15,
                    y: 10,
                    text: `${x / this.GRID_METER_SIZE}m`,
                    fontSize: 12,
                    fontFamily: 'Arial',
                    fill: '#666'
                });
                this.gridLayer.add(label);
            }
        }

        for (let y = offsetY; y <= viewportHeight / 2; y += this.gridSize) {
            const isMajor = Math.round(y / this.gridSize) % 5 === 0;
            this.gridLayer.add(new Konva.Line({
                points: [offsetX, y, -offsetX, y],
                stroke: y === 0 ? '#2c3e50' : (isMajor ? '#a0aec0' : '#e2e8f0'),
                strokeWidth: y === 0 ? 2 : (isMajor ? 1 : 0.5)
            }));

            // Añadir etiquetas de medida para líneas principales
            if (isMajor && y !== 0) {
                const label = new Konva.Text({
                    x: 10,
                    y: y - 6,
                    text: `${y / this.GRID_METER_SIZE}m`,
                    fontSize: 12,
                    fontFamily: 'Arial',
                    fill: '#666'
                });
                this.gridLayer.add(label);
            }
        }

        // Add "2D Editor" label with scale information
        const label = new Konva.Text({
            x: 20,
            y: 20,
            text: '2D Editor - 1 cuadrado = 1 metro',
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

        // Get the current transform of the layer
        const transform = this.layer.getAbsoluteTransform().copy();
        // Invert the transform to get the correct relative position
        transform.invert();
        // Transform the point
        const transformedPos = transform.point(pos);

        // Debug coordinates
        console.log('Mouse Position:', {
            screen: pos,
            transformed: transformedPos,
            meters: {
                x: transformedPos.x / this.GRID_METER_SIZE,
                y: transformedPos.y / this.GRID_METER_SIZE
            }
        });

        return {
            x: transformedPos.x,
            y: transformedPos.y
        };
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

            if (this.currentTool === ToolType.WALL) {
                const pos = this.getRelativePointerPosition();
                if (!pos) return;
                this.startDrawing(pos);
            } else if (this.currentTool === ToolType.MOVE) {
                // Enable dragging for move tool
                this.stage.draggable(true);
                // Store the initial transform
                this.gridLayer.startPos = {
                    x: this.gridLayer.x(),
                    y: this.gridLayer.y()
                };
                this.layer.startPos = {
                    x: this.layer.x(),
                    y: this.layer.y()
                };

                // Update position based on drag
                const newGridPos = {
                    x: (this.gridLayer.startPos?.x || 0) + e.evt.movementX,
                    y: (this.gridLayer.startPos?.y || 0) + e.evt.movementY
                };
                const newLayerPos = {
                    x: (this.layer.startPos?.x || 0) + e.evt.movementX,
                    y: (this.layer.startPos?.y || 0) + e.evt.movementY
                };
            }
        });

        this.stage.on('mousemove touchmove', (e) => {
            e.evt.preventDefault();
            if (this.isDrawing) {
                this.handleDrawing(e);
            } else if (this.currentTool === ToolType.MOVE && this.stage.isDragging()) {
                // Sync grid layer with main layer during drag
                if (this.layer.startPos && this.gridLayer.startPos) {
                    const dx = this.layer.x() - this.layer.startPos.x;
                    const dy = this.layer.y() - this.layer.startPos.y;
                    this.gridLayer.position({
                        x: this.gridLayer.startPos.x + dx,
                        y: this.gridLayer.startPos.y + dy
                    });
                }
            }
        });

        this.stage.on('mouseup touchend', () => {
            if (this.isDrawing) {
                this.handleDrawingEnd();
            }
            // Disable dragging after mouse up
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

        // Aplicar snap al punto inicial
        const snappedPos = this.findSnapPoint(layerPos);

        this.isDrawing = true;
        this.tempLine = new Konva.Line({
            points: [
                snappedPos.x,
                snappedPos.y,  // Ya no invertimos Y
                snappedPos.x,
                snappedPos.y   // Ya no invertimos Y
            ],
            stroke: '#2c3e50',
            strokeWidth: 3,
            dash: [5, 5],
            lineCap: 'round'
        });
        this.layer.add(this.tempLine);

        // Mostrar indicador de snap si es necesario
        if (snappedPos !== layerPos) {
            this.drawSnapIndicator(snappedPos);
        }
    }

    private handleDrawing(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
        const layerPos = this.getRelativePointerPosition();
        if (!layerPos || !this.tempLine) return;

        const points = this.tempLine.points();
        const snapPoint = this.findSnapPoint(layerPos);

        // Actualizar la línea temporal sin invertir Y
        this.tempLine.points([
            points[0],
            points[1],
            snapPoint.x,
            snapPoint.y
        ]);

        // Calcular y mostrar la longitud en tiempo real
        const start: Point = { x: points[0], y: points[1] };
        const end: Point = { x: snapPoint.x, y: snapPoint.y };
        const distance = this.getDistance(start, end);
        const distanceMeters = (distance / this.GRID_METER_SIZE).toFixed(2);

        // Calcular posición y ángulo para el texto
        const centerX = (start.x + end.x) / 2;
        const centerY = (start.y + end.y) / 2;
        const angle = Math.atan2(end.y - start.y, end.x - start.x);

        // Eliminar etiquetas anteriores si existen
        if (this.tempDimensionLabel) {
            this.tempDimensionLabel.destroy();
        }
        if (this.tempDimensionBackground) {
            this.tempDimensionBackground.destroy();
        }

        // Crear nuevo texto con las dimensiones
        this.tempDimensionLabel = new Konva.Text({
            x: centerX,
            y: centerY,
            text: `${distanceMeters}m`,
            fontSize: 12,
            fontFamily: 'Arial',
            fill: '#2c3e50',
            padding: 4,
            rotation: angle * (180 / Math.PI),
            offsetX: 20,
            name: 'temp-dimension-label'
        });

        // Crear fondo para el texto
        this.tempDimensionBackground = new Konva.Rect({
            x: centerX,
            y: centerY,
            width: this.tempDimensionLabel.width() + 8,
            height: this.tempDimensionLabel.height() + 8,
            fill: 'white',
            opacity: 0.8,
            cornerRadius: 4,
            rotation: angle * (180 / Math.PI),
            offsetX: 20,
            name: 'temp-dimension-background'
        });

        // Añadir elementos a la capa
        this.layer.add(this.tempDimensionBackground);
        this.layer.add(this.tempDimensionLabel);

        // Dibujar indicador visual de snap si estamos en un punto de snap
        if (snapPoint !== layerPos) {
            this.drawSnapIndicator(snapPoint);
        } else {
            this.clearSnapIndicators();
        }

        this.layer.batchDraw();
    }

    private handleDrawingEnd(): void {
        if (!this.isDrawing || !this.tempLine) return;

        const points = this.tempLine.points();
        const start: Point = {
            x: points[0],
            y: points[1]
        };
        const end: Point = {
            x: points[2],
            y: points[3]
        };

        // Solo crear la pared si tiene una longitud mínima
        if (this.getDistance(start, end) > 10) {
            const command = new AddWallCommand(
                this.store, 
                start,
                end,
                this.wallProperties.height,
                this.wallProperties.thickness
            );
            this.store.executeCommand(command);
        }

        // Limpiar elementos temporales
        this.tempLine.destroy();
        this.tempLine = null;
        if (this.tempDimensionLabel) {
            this.tempDimensionLabel.destroy();
            this.tempDimensionLabel = null;
        }
        if (this.tempDimensionBackground) {
            this.tempDimensionBackground.destroy();
            this.tempDimensionBackground = null;
        }
        this.isDrawing = false;
        this.clearSnapIndicators();
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
                points: [
                    wall.start.x,
                    wall.start.y,  // Ya no invertimos Y
                    wall.end.x,
                    wall.end.y     // Ya no invertimos Y
                ],
                stroke: '#2c3e50',
                strokeWidth: 3,
                lineCap: 'round',
                id: wall.id
            });
            this.layer.add(line);

            // Mostrar dimensiones para cada pared
            this.showWallDimensions(wall.start, wall.end);
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
        this.stage.draggable(tool === ToolType.MOVE);
    }

    public clear(): void {
        this.layer.destroyChildren();
        this.layer.batchDraw();
        this.store.clear();
    }

    // Add keyboard shortcuts for undo/redo
    private setupKeyboardShortcuts(): void {
        window.addEventListener('keydown', (e) => {
            // Check if Ctrl/Cmd key is pressed
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'z':
                        if (e.shiftKey) {
                            // Ctrl+Shift+Z or Cmd+Shift+Z for Redo
                            this.store.redo();
                        } else {
                            // Ctrl+Z or Cmd+Z for Undo
                            this.store.undo();
                        }
                        e.preventDefault();
                        break;
                    case 'y':
                        // Ctrl+Y or Cmd+Y for Redo
                        this.store.redo();
                        e.preventDefault();
                        break;
                }
            }
        });
    }

    private findSnapPoint(point: Point): Point {
        // Primero, intentamos snap a los puntos finales de las paredes existentes
        const walls = this.store.getWalls();
        for (const wall of walls) {
            // Comprobar el punto inicial de la pared
            if (this.getDistance(point, wall.start) < this.SNAP_THRESHOLD) {
                return wall.start;
            }
            // Comprobar el punto final de la pared
            if (this.getDistance(point, wall.end) < this.SNAP_THRESHOLD) {
                return wall.end;
            }
        }

        // Si no encontramos un punto para hacer snap, devolvemos el punto original
        return point;
    }

    private drawSnapIndicator(point: Point): void {
        // Limpiar indicadores anteriores
        this.clearSnapIndicators();

        // Crear un nuevo indicador
        const indicator = new Konva.Circle({
            x: point.x,
            y: point.y,
            radius: 5,
            fill: '#2ecc71',
            stroke: '#27ae60',
            strokeWidth: 2,
            name: 'snap-indicator' // Para poder identificarlo después
        });

        this.layer.add(indicator);
        this.layer.batchDraw();
    }

    private clearSnapIndicators(): void {
        // Eliminar todos los indicadores de snap existentes
        this.layer.find('.snap-indicator').forEach(node => node.destroy());
        this.layer.batchDraw();
    }

    public updateWallProperties(props: WallProperties): void {
        this.wallProperties = { ...props };
    }

    private showWallDimensions(start: Point, end: Point): void {
        const distance = this.getDistance(start, end);
        const distanceMeters = (distance / this.GRID_METER_SIZE).toFixed(2); // Convertir a metros

        // Calcular posición para el texto
        const centerX = (start.x + end.x) / 2;
        const centerY = (start.y + end.y) / 2;
        
        // Calcular el ángulo de la pared
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        
        // Crear texto con las dimensiones
        const dimensionText = new Konva.Text({
            x: centerX,
            y: centerY,
            text: `${distanceMeters}m`,
            fontSize: 12,
            fontFamily: 'Arial',
            fill: '#2c3e50',
            padding: 4,
            rotation: angle * (180 / Math.PI),
            offsetX: 20,
            name: 'dimension-label'
        });

        // Agregar fondo blanco al texto
        const textBackground = new Konva.Rect({
            x: centerX,
            y: centerY,
            width: dimensionText.width() + 8,
            height: dimensionText.height() + 8,
            fill: 'white',
            opacity: 0.8,
            cornerRadius: 4,
            rotation: angle * (180 / Math.PI),
            offsetX: 20,
            name: 'dimension-background'
        });

        this.layer.add(textBackground);
        this.layer.add(dimensionText);
        this.layer.batchDraw();
    }

    private drawAxes(): void {
        // Ejes principales
        const axisLayer = new Konva.Layer();
        this.stage.add(axisLayer);

        // Eje X (rojo)
        const xAxis = new Konva.Arrow({
            points: [-5000, 0, 5000, 0],
            stroke: '#FF0000',
            fill: '#FF0000',
            strokeWidth: 2,
            pointerLength: 10,
            pointerWidth: 10
        });

        // Eje Y (azul) - Invertido para mantener consistencia con Three.js
        const yAxis = new Konva.Arrow({
            points: [0, 5000, 0, -5000],
            stroke: '#0000FF',
            fill: '#0000FF',
            strokeWidth: 2,
            pointerLength: 10,
            pointerWidth: 10
        });

        // Etiquetas de los ejes
        const xLabel = new Konva.Text({
            x: 5010,
            y: 10,
            text: 'X',
            fontSize: 16,
            fill: '#FF0000',
            fontStyle: 'bold'
        });

        const yLabel = new Konva.Text({
            x: 10,
            y: -5010,
            text: 'Y',
            fontSize: 16,
            fill: '#0000FF',
            fontStyle: 'bold'
        });

        // Coordenadas en tiempo real
        const coordsText = new Konva.Text({
            x: 10,
            y: 50,
            text: 'Coordenadas: (0, 0)',
            fontSize: 14,
            fill: '#2c3e50',
            padding: 5,
            backgroundColor: 'rgba(255,255,255,0.8)',
            cornerRadius: 3
        });

        // Actualizar coordenadas en tiempo real
        this.stage.on('mousemove', () => {
            const pos = this.getRelativePointerPosition();
            if (pos) {
                const x = (pos.x / this.GRID_METER_SIZE).toFixed(2);
                const y = (pos.y / this.GRID_METER_SIZE).toFixed(2);
                coordsText.text(`Coordenadas: (${x}m, ${y}m)`);
                axisLayer.batchDraw();
            }
        });

        // Marcas de medición en los ejes
        for (let i = -50; i <= 50; i++) {
            if (i === 0) continue;
            const pos = i * this.GRID_METER_SIZE;
            
            // Marcas en X
            const xTick = new Konva.Line({
                points: [pos, -5, pos, 5],
                stroke: '#FF0000',
                strokeWidth: 1
            });
            
            const xText = new Konva.Text({
                x: pos - 10,
                y: 10,
                text: `${i}m`,
                fontSize: 10,
                fill: '#FF0000'
            });
            
            // Marcas en Y
            const yTick = new Konva.Line({
                points: [-5, pos, 5, pos],
                stroke: '#0000FF',
                strokeWidth: 1
            });
            
            const yText = new Konva.Text({
                x: 10,
                y: pos - 5,
                text: `${i}m`,
                fontSize: 10,
                fill: '#0000FF'
            });
            
            axisLayer.add(xTick, xText, yTick, yText);
        }

        // Origen (0,0)
        const originPoint = new Konva.Circle({
            x: 0,
            y: 0,
            radius: 5,
            fill: '#2c3e50'
        });

        const originLabel = new Konva.Text({
            x: 10,
            y: 10,
            text: '(0,0)',
            fontSize: 12,
            fill: '#2c3e50'
        });

        axisLayer.add(xAxis, yAxis, xLabel, yLabel, originPoint, originLabel, coordsText);
        axisLayer.moveToTop();
    }
} 