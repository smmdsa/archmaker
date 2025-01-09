import Konva from 'konva';
import { ProjectStore, Point } from '../store/ProjectStore';
import { EventBus } from '../core/events/EventBus';
import { ToolService } from '../core/tools/services/ToolService';
import { IToolContext } from '../core/tools/interfaces/ITool';

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
    private mainLayer: ExtendedLayer;    // Capa para elementos permanentes
    private tempLayer: ExtendedLayer;    // Capa para elementos temporales (previews, snaps)
    private gridLayer: ExtendedLayer;    // Capa para la grilla
    private gridSize: number = 100;      // 100 píxeles = 1 metro
    private readonly GRID_METER_SIZE = 100;
    private container: HTMLElement;
    private readonly SNAP_THRESHOLD = 20;
    private eventBus: EventBus;
    private toolService: ToolService;

    constructor(containerId: string, private store: ProjectStore) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Container not found');
        this.container = container;

        // Inicializar servicios
        this.eventBus = EventBus.getInstance();
        this.toolService = ToolService.getInstance();

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

        // Create layers in order (bottom to top)
        this.gridLayer = new Konva.Layer();  // Grid en el fondo
        this.mainLayer = new Konva.Layer(); // Elementos permanentes
        this.tempLayer = new Konva.Layer(); // Elementos temporales arriba

        // Add layers to stage in order
        this.stage.add(this.gridLayer);
        this.stage.add(this.mainLayer);
        this.stage.add(this.tempLayer);

        // Set initial scale and position
        const initialScale = 1;
        this.gridLayer.scale({ x: initialScale, y: initialScale });
        this.mainLayer.scale({ x: initialScale, y: initialScale });
        this.tempLayer.scale({ x: initialScale, y: initialScale });

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
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();
        const centerX = stageWidth / 2;
        const centerY = stageHeight / 2;

        // Asegurar que todas las capas estén centradas
        this.gridLayer.position({ x: centerX, y: centerY });
        this.mainLayer.position({ x: centerX, y: centerY });
        this.tempLayer.position({ x: centerX, y: centerY });

        // Asegurar que todas las capas tengan la misma escala inicial
        const initialScale = 1;
        this.gridLayer.scale({ x: initialScale, y: initialScale });
        this.mainLayer.scale({ x: initialScale, y: initialScale });
        this.tempLayer.scale({ x: initialScale, y: initialScale });

        this.stage.batchDraw();
    }

    private setupEventListeners(): void {
        // Mouse events
        this.stage.on('mousedown', (e) => {
            const pos = this.getRelativePointerPosition();
            if (!pos) return;

            const context: IToolContext = {
                canvasPosition: pos,
                event: e.evt,
                stage: this.stage,
                layer: this.tempLayer,      // Capa temporal para previews
                mainLayer: this.mainLayer   // Capa principal para elementos permanentes
            };

            const activeTool = this.toolService.getActiveTool();
            if (activeTool) {
                activeTool.onMouseDown(context);
            }
        });

        this.stage.on('mousemove', (e) => {
            const pos = this.getRelativePointerPosition();
            if (!pos) return;

            const context: IToolContext = {
                canvasPosition: pos,
                event: e.evt,
                stage: this.stage,
                layer: this.tempLayer,
                mainLayer: this.mainLayer
            };

            const activeTool = this.toolService.getActiveTool();
            if (activeTool) {
                activeTool.onMouseMove(context);
            }
        });

        this.stage.on('mouseup', (e) => {
            const pos = this.getRelativePointerPosition();
            if (!pos) return;

            const context: IToolContext = {
                canvasPosition: pos,
                event: e.evt,
                stage: this.stage,
                layer: this.tempLayer,
                mainLayer: this.mainLayer
            };

            const activeTool = this.toolService.getActiveTool();
            if (activeTool) {
                activeTool.onMouseUp(context);
            }
        });

        // Zoom handling
        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            
            const oldScale = this.mainLayer.scaleX();
            const pointer = this.stage.getPointerPosition();
            
            if (!pointer) return;
            
            const mousePointTo = {
                x: (pointer.x - this.mainLayer.x()) / oldScale,
                y: (pointer.y - this.mainLayer.y()) / oldScale,
            };
            
            const zoomAmount = e.evt.deltaY > 0 ? 0.9 : 1.1;
            const newScale = oldScale * zoomAmount;
            
            if (newScale > 0.1 && newScale < 5) {
                // Actualizar escala de todas las capas
                this.mainLayer.scale({ x: newScale, y: newScale });
                this.gridLayer.scale({ x: newScale, y: newScale });
                this.tempLayer.scale({ x: newScale, y: newScale });
                
                const newPos = {
                    x: pointer.x - mousePointTo.x * newScale,
                    y: pointer.y - mousePointTo.y * newScale,
                };

                // Actualizar posición de todas las capas
                this.mainLayer.position(newPos);
                this.gridLayer.position(newPos);
                this.tempLayer.position(newPos);
                
                this.stage.batchDraw();
            }
        });
    }

    private setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e) => {
            const activeTool = this.toolService.getActiveTool();
            if (activeTool) {
                activeTool.onKeyDown(e);
            }
        });

        document.addEventListener('keyup', (e) => {
            const activeTool = this.toolService.getActiveTool();
            if (activeTool) {
                activeTool.onKeyUp(e);
            }
        });
    }

    private getRelativePointerPosition(): Point | null {
        const pos = this.stage.getPointerPosition();
        if (!pos) return null;

        const transform = this.mainLayer.getAbsoluteTransform().copy();
        transform.invert();
        const transformedPos = transform.point(pos);

        return {
            x: transformedPos.x,
            y: transformedPos.y
        };
    }

    private handleResize(): void {
        if (!this.container) return;
        
        this.stage.width(this.container.clientWidth);
        this.stage.height(this.container.clientHeight);
        this.drawGrid();
    }

    private updateFromStore(): void {
        // Limpiar la capa principal
        this.mainLayer.destroyChildren();

        // Obtener y dibujar las paredes
        const walls = this.store.getWalls();
        walls.forEach(wall => {
            this.drawWall(wall);
        });

        // Redibujar la capa
        this.mainLayer.batchDraw();
    }

    private drawWall(wall: any): void {
        const line = new Konva.Line({
            points: [wall.startPoint.x, wall.startPoint.y, wall.endPoint.x, wall.endPoint.y],
            stroke: '#2c3e50',
            strokeWidth: wall.thickness || 15,
            lineCap: 'round',
            lineJoin: 'round',
            id: wall.id
        });

        this.mainLayer.add(line);
    }

    private drawAxes(): void {
        // Dibujar ejes X e Y
        const axisLength = 50;
        const axisColor = '#2c3e50';
        const axisWidth = 2;

        // Eje X
        const xAxis = new Konva.Arrow({
            points: [0, 0, axisLength, 0],
            stroke: axisColor,
            strokeWidth: axisWidth,
            fill: axisColor,
            pointerLength: 10,
            pointerWidth: 10
        });

        // Eje Y
        const yAxis = new Konva.Arrow({
            points: [0, 0, 0, -axisLength],
            stroke: axisColor,
            strokeWidth: axisWidth,
            fill: axisColor,
            pointerLength: 10,
            pointerWidth: 10
        });

        // Etiquetas
        const xLabel = new Konva.Text({
            x: axisLength + 5,
            y: -15,
            text: 'X',
            fontSize: 16,
            fontFamily: 'Arial',
            fill: axisColor
        });

        const yLabel = new Konva.Text({
            x: -15,
            y: -axisLength - 20,
            text: 'Y',
            fontSize: 16,
            fontFamily: 'Arial',
            fill: axisColor
        });

        this.mainLayer.add(xAxis);
        this.mainLayer.add(yAxis);
        this.mainLayer.add(xLabel);
        this.mainLayer.add(yLabel);
    }

    private drawGrid(): void {
        // Limpiar la capa de la cuadrícula
        this.gridLayer.destroyChildren();

        // Calcular dimensiones de la cuadrícula
        const viewportWidth = this.stage.width() * 8;
        const viewportHeight = this.stage.height() * 8;
        const offsetX = -viewportWidth / 2;
        const offsetY = -viewportHeight / 2;

        // Agregar fondo
        const background = new Konva.Rect({
            x: offsetX,
            y: offsetY,
            width: viewportWidth,
            height: viewportHeight,
            fill: '#f8f9fa'
        });
        this.gridLayer.add(background);

        // Dibujar líneas de la cuadrícula
        for (let x = offsetX; x <= viewportWidth / 2; x += this.gridSize) {
            const isMajor = Math.round(x / this.gridSize) % 5 === 0;
            this.gridLayer.add(new Konva.Line({
                points: [x, offsetY, x, -offsetY],
                stroke: x === 0 ? '#2c3e50' : (isMajor ? '#a0aec0' : '#e2e8f0'),
                strokeWidth: x === 0 ? 2 : (isMajor ? 1 : 0.5)
            }));

            // Añadir etiquetas para líneas principales
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

            // Añadir etiquetas para líneas principales
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

        // Añadir etiqueta del editor
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

    // Métodos públicos
    public dispose(): void {
        window.removeEventListener('resize', this.handleResize.bind(this));
        this.stage.destroy();
    }
} 