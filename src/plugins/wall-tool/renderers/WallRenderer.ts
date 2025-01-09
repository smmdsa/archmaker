import Konva from 'konva';
import { Point } from '../../../store/ProjectStore';
import { IWall } from '../interfaces/IWall';

interface WallRenderOptions {
    thickness?: number;
    color?: string;
    showDimensions?: boolean;
}

export class WallRenderer {
    private gridSize: number = 100;
    private gridEnabled: boolean = true;

    setGridSize(size: number): void {
        this.gridSize = size;
    }

    enableGridSnapping(enabled: boolean): void {
        this.gridEnabled = enabled;
    }

    clear(layer: Konva.Layer): void {
        layer.destroyChildren();
        layer.draw();
    }

    renderWall(layer: Konva.Layer, wall: IWall, options: WallRenderOptions = {}): void {
        const { thickness = 20, color = '#666666', showDimensions = true } = options;

        // Crear la línea del muro
        const line = new Konva.Line({
            points: [wall.startPoint.x, wall.startPoint.y, wall.endPoint.x, wall.endPoint.y],
            stroke: color,
            strokeWidth: thickness,
            lineCap: 'round',
            lineJoin: 'round',
            id: wall.id
        });

        layer.add(line);

        // Agregar etiqueta de dimensión si está habilitada
        if (showDimensions) {
            this.renderDimensionLabel(layer, wall.startPoint, wall.endPoint);
        }

        layer.batchDraw();
    }

    renderPreview(layer: Konva.Layer, startPoint: Point, endPoint: Point, options: WallRenderOptions = {}): void {
        const { thickness = 20, showDimensions = true } = options;

        // Crear línea de preview
        const line = new Konva.Line({
            points: [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
            stroke: '#666666',
            strokeWidth: thickness,
            lineCap: 'round',
            lineJoin: 'round',
            opacity: 0.6,
            dash: [10, 5]
        });

        layer.add(line);

        // Agregar etiqueta de dimensión si está habilitada
        if (showDimensions) {
            this.renderDimensionLabel(layer, startPoint, endPoint, true);
        }

        layer.batchDraw();
    }

    renderSnapPoints(layer: Konva.Layer, points: Point[]): void {
        points.forEach(point => {
            const circle = new Konva.Circle({
                x: point.x,
                y: point.y,
                radius: 5,
                fill: '#4299e1',
                opacity: 0.6
            });
            layer.add(circle);
        });
        layer.batchDraw();
    }

    renderSnapIndicator(layer: Konva.Layer, point: Point): void {
        const indicator = new Konva.Circle({
            x: point.x,
            y: point.y,
            radius: 8,
            stroke: '#4299e1',
            strokeWidth: 2,
            opacity: 0.8
        });
        layer.add(indicator);
        layer.batchDraw();
    }

    private renderDimensionLabel(layer: Konva.Layer, startPoint: Point, endPoint: Point, isPreview: boolean = false): void {
        // Calcular la longitud en píxeles
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Convertir a metros (1 metro = 100 píxeles)
        const lengthInMeters = Math.round(length / 100 * 10) / 10;
        
        // Calcular el punto medio
        const midX = (startPoint.x + endPoint.x) / 2;
        const midY = (startPoint.y + endPoint.y) / 2;
        
        // Calcular el ángulo para la etiqueta
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        // Crear el contenedor de la etiqueta
        const labelContainer = new Konva.Label({
            x: midX,
            y: midY,
            opacity: isPreview ? 0.8 : 1
        });

        // Crear el fondo de la etiqueta
        const labelTag = new Konva.Tag({
            fill: '#ffffff',
            stroke: '#666666',
            strokeWidth: 1,
            pointerDirection: 'none',
            pointerWidth: 10,
            pointerHeight: 10,
            lineJoin: 'round',
            shadowColor: 'black',
            shadowBlur: 4,
            shadowOffset: { x: 1, y: 1 },
            shadowOpacity: 0.2,
            cornerRadius: 4
        });

        // Crear el texto de la etiqueta
        const labelText = new Konva.Text({
            text: `${lengthInMeters}m`,
            fontSize: 14,
            fontFamily: 'Arial',
            fill: '#333333',
            padding: 5
        });

        // Agregar el texto y el fondo al contenedor
        labelContainer.add(labelTag);
        labelContainer.add(labelText);

        // Rotar la etiqueta si el ángulo está entre 90 y 270 grados
        if (angle > 90 || angle < -90) {
            labelContainer.rotation(angle + 180);
        } else {
            labelContainer.rotation(angle);
        }

        // Agregar la etiqueta a la capa
        layer.add(labelContainer);
    }
} 