import Konva from 'konva';
import { ILogger } from '../interfaces/ILogger';
import { IEventManager } from '../interfaces/IEventManager';
import { Point } from '../types/geometry';

export interface ICanvasManager {
    initialize(containerId: string): Promise<void>;
    dispose(): Promise<void>;
    getStage(): Konva.Stage;
    getPreviewLayer(): Konva.Layer;
    getMainLayer(): Konva.Layer;
    clear(layer?: 'preview' | 'main'): void;
    render(): void;
    setGridSize(size: number): void;
    toggleGrid(visible: boolean): void;
    pixelToCm(pixels: number): number;
    cmToPixel(cm: number): number;
}

interface Wall {
    id: string;
    startPoint: Point;
    endPoint: Point;
    thickness: number;
    properties: {
        color?: string;
    };
}

interface Room {
    points: Point[];
    properties: {
        name: string;
        area: number;
    };
}

export class CanvasManager implements ICanvasManager {
    private stage: Konva.Stage;
    private mainLayer: Konva.Layer;
    private previewLayer: Konva.Layer;
    private gridLayer: Konva.Layer;
    private gridSize: number = 100; // 100cm = 1m
    private gridVisible: boolean = true;
    private walls: Map<string, Konva.Line> = new Map();
    private rooms: Map<string, Konva.Line> = new Map();
    private readonly PIXEL_TO_CM_RATIO = 1; // 1 pixel = 1 cm

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {}

    async initialize(containerId: string): Promise<void> {
        this.logger.info('Initializing Canvas Manager...');
        
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Canvas container not found: ${containerId}`);
        }

        // Initialize stage
        this.stage = new Konva.Stage({
            container: containerId,
            width: container.clientWidth,
            height: container.clientHeight
        });

        // Create layers
        this.gridLayer = new Konva.Layer();
        this.mainLayer = new Konva.Layer();
        this.previewLayer = new Konva.Layer();

        // Add layers to stage
        this.stage.add(this.gridLayer);
        this.stage.add(this.mainLayer);
        this.stage.add(this.previewLayer);

        // Setup event listeners
        this.setupEventListeners();
        
        // Draw initial grid
        this.drawGrid();
        
        this.logger.info('Canvas Manager initialized');
    }

    private setupEventListeners(): void {
        // Handle window resize
        window.addEventListener('resize', () => {
            const container = this.stage.container();
            this.stage.width(container.clientWidth);
            this.stage.height(container.clientHeight);
            this.drawGrid();
        });

        // Handle canvas events
        this.stage.on('mousedown mousemove mouseup', (e) => {
            const pos = this.stage.getPointerPosition();
            if (!pos) return;

            const event = {
                type: e.type as 'mousedown' | 'mousemove' | 'mouseup',
                position: pos as Point,
                originalEvent: e.evt,
                canvas: {
                    stage: this.stage,
                    previewLayer: this.previewLayer,
                    mainLayer: this.mainLayer
                }
            };

            this.eventManager.emit('canvas:event', event);
        });

        // Handle wall events
        this.eventManager.on<{ wall: Wall }>('wall:created', ({ wall }) => {
            this.addWall(wall);
        });

        this.eventManager.on<{ wall: Wall }>('wall:updated', ({ wall }) => {
            this.updateWall(wall);
        });

        this.eventManager.on<{ wallId: string }>('wall:deleted', ({ wallId }) => {
            this.deleteWall(wallId);
        });

        // Handle room events
        this.eventManager.on<{ room: Room }>('room:created', ({ room }) => {
            this.addRoom(room);
        });
    }

    private addWall(wall: Wall): void {
        const line = new Konva.Line({
            points: [
                wall.startPoint.x,
                wall.startPoint.y,
                wall.endPoint.x,
                wall.endPoint.y
            ],
            stroke: wall.properties.color || '#333',
            strokeWidth: this.cmToPixel(wall.thickness),
            lineCap: 'round',
            lineJoin: 'round'
        });

        this.walls.set(wall.id, line);
        this.mainLayer.add(line);
        this.mainLayer.batchDraw();
    }

    private updateWall(wall: Wall): void {
        const line = this.walls.get(wall.id);
        if (line) {
            line.points([
                wall.startPoint.x,
                wall.startPoint.y,
                wall.endPoint.x,
                wall.endPoint.y
            ]);
            line.strokeWidth(this.cmToPixel(wall.thickness));
            if (wall.properties.color) {
                line.stroke(wall.properties.color);
            }
            this.mainLayer.batchDraw();
        }
    }

    private deleteWall(wallId: string): void {
        const line = this.walls.get(wallId);
        if (line) {
            line.destroy();
            this.walls.delete(wallId);
            this.mainLayer.batchDraw();
        }
    }

    private addRoom(room: Room): void {
        const id = `room-${Date.now()}`;
        const flatPoints = room.points.reduce<number[]>((acc, p) => [...acc, p.x, p.y], []);
        
        // Crear el polígono de la habitación
        const polygon = new Konva.Line({
            points: flatPoints,
            stroke: '#333',
            strokeWidth: 2,
            fill: '#f0f0f0',
            closed: true,
            opacity: 0.5,
            name: 'room-polygon'
        });

        // Crear el grupo que contendrá el polígono y la etiqueta
        const group = new Konva.Group({
            name: 'room-group'
        });

        // Agregar el polígono al grupo
        group.add(polygon);

        // Calcular el centro y crear la etiqueta
        const center = this.calculatePolygonCenter(room.points);
        const areaInSquareMeters = room.properties.area / 10000; // Convertir cm² a m²
        const label = new Konva.Text({
            x: center.x,
            y: center.y,
            text: `${room.properties.name}\n${areaInSquareMeters.toFixed(2)}m²`,
            fontSize: 12,
            fill: '#666',
            align: 'center',
            verticalAlign: 'middle',
            offsetX: 20,
            offsetY: 10,
            name: 'room-label'
        });

        // Crear un fondo para la etiqueta
        const labelBg = new Konva.Rect({
            x: center.x - 25,
            y: center.y - 15,
            width: label.width() + 10,
            height: label.height() + 10,
            fill: 'white',
            opacity: 0.8,
            cornerRadius: 4,
            name: 'room-label-bg'
        });

        // Agregar el fondo y la etiqueta al grupo
        group.add(labelBg);
        group.add(label);

        // Almacenar la referencia y agregar al layer
        this.rooms.set(id, polygon);
        this.mainLayer.add(group);
        this.mainLayer.batchDraw();

        // Agregar interactividad
        group.on('mouseover', () => {
            polygon.opacity(0.7);
            labelBg.opacity(1);
            this.mainLayer.batchDraw();
        });

        group.on('mouseout', () => {
            polygon.opacity(0.5);
            labelBg.opacity(0.8);
            this.mainLayer.batchDraw();
        });
    }

    private calculatePolygonCenter(points: Point[]): Point {
        const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return { x, y };
    }

    async dispose(): Promise<void> {
        this.logger.info('Disposing Canvas Manager...');
        this.stage.destroy();
    }

    getStage(): Konva.Stage {
        return this.stage;
    }

    getPreviewLayer(): Konva.Layer {
        return this.previewLayer;
    }

    getMainLayer(): Konva.Layer {
        return this.mainLayer;
    }

    clear(layer?: 'preview' | 'main'): void {
        if (!layer || layer === 'preview') {
            this.previewLayer.destroyChildren();
            this.previewLayer.draw();
        }
        if (!layer || layer === 'main') {
            this.mainLayer.destroyChildren();
            this.walls.clear();
            this.rooms.clear();
            this.mainLayer.draw();
        }
    }

    render(): void {
        this.mainLayer.batchDraw();
        this.previewLayer.batchDraw();
    }

    setGridSize(size: number): void {
        this.gridSize = size;
        this.drawGrid();
    }

    toggleGrid(visible: boolean): void {
        this.gridVisible = visible;
        this.gridLayer.visible(visible);
        this.gridLayer.batchDraw();
    }

    pixelToCm(pixels: number): number {
        return pixels * this.PIXEL_TO_CM_RATIO;
    }

    cmToPixel(cm: number): number {
        return cm / this.PIXEL_TO_CM_RATIO;
    }

    private drawGrid(): void {
        if (!this.gridVisible) return;

        this.gridLayer.destroyChildren();

        const width = this.stage.width();
        const height = this.stage.height();

        // Dibujar líneas principales (metros)
        for (let x = 0; x < width; x += this.gridSize) {
            this.gridLayer.add(new Konva.Line({
                points: [x, 0, x, height],
                stroke: '#ccc',
                strokeWidth: 1
            }));

            // Agregar etiqueta de medida (metros)
            if (x > 0) {
                const label = new Konva.Text({
                    x: x - 10,
                    y: 10,
                    text: `${x / 100}m`,
                    fontSize: 10,
                    fill: '#999'
                });
                this.gridLayer.add(label);
            }
        }

        for (let y = 0; y < height; y += this.gridSize) {
            this.gridLayer.add(new Konva.Line({
                points: [0, y, width, y],
                stroke: '#ccc',
                strokeWidth: 1
            }));

            // Agregar etiqueta de medida (metros)
            if (y > 0) {
                const label = new Konva.Text({
                    x: 10,
                    y: y - 5,
                    text: `${y / 100}m`,
                    fontSize: 10,
                    fill: '#999'
                });
                this.gridLayer.add(label);
            }
        }

        // Dibujar subdivisiones (10cm)
        const subGridSize = 10; // 10cm
        for (let x = 0; x < width; x += subGridSize) {
            if (x % this.gridSize !== 0) { // No dibujar donde ya hay líneas principales
                this.gridLayer.add(new Konva.Line({
                    points: [x, 0, x, height],
                    stroke: '#eee',
                    strokeWidth: 0.5
                }));
            }
        }

        for (let y = 0; y < height; y += subGridSize) {
            if (y % this.gridSize !== 0) { // No dibujar donde ya hay líneas principales
                this.gridLayer.add(new Konva.Line({
                    points: [0, y, width, y],
                    stroke: '#eee',
                    strokeWidth: 0.5
                }));
            }
        }

        this.gridLayer.batchDraw();
    }
} 