import { RoomRenderer } from '../../renderers/RoomRenderer';
import { Layer } from 'konva/lib/Layer';
import { Stage } from 'konva/lib/Stage';
import { Group } from 'konva/lib/Group';
import { Line } from 'konva/lib/shapes/Line';
import { Text } from 'konva/lib/shapes/Text';

describe('RoomRenderer', () => {
    let roomRenderer: RoomRenderer;
    let stage: Stage;
    let layer: Layer;

    beforeEach(() => {
        stage = new Stage({
            container: document.createElement('div'),
            width: 800,
            height: 600
        });
        layer = new Layer();
        stage.add(layer);
        roomRenderer = new RoomRenderer();
    });

    describe('renderPreview', () => {
        it('should render room preview with walls', () => {
            const startPoint = { x: 100, y: 100 };
            const endPoint = { x: 300, y: 300 };
            const options = {
                wallThickness: 15,
                showDimensions: false,
                isPreview: true
            };

            roomRenderer.renderPreview(layer, startPoint, endPoint, options);

            const group = layer.findOne('Group');
            expect(group).toBeTruthy();
            expect(group.opacity()).toBe(0.7);

            const lines = group.find('Line');
            expect(lines).toHaveLength(4);

            // Verificar las propiedades de las líneas
            lines.forEach(line => {
                expect(line.strokeWidth()).toBe(options.wallThickness);
                expect(line.stroke()).toBe('#666666');
                expect(line.lineCap()).toBe('round');
                expect(line.lineJoin()).toBe('round');
            });
        });

        it('should render room preview with dimensions', () => {
            const startPoint = { x: 100, y: 100 };
            const endPoint = { x: 300, y: 300 };
            const options = {
                wallThickness: 15,
                showDimensions: true,
                isPreview: true
            };

            roomRenderer.renderPreview(layer, startPoint, endPoint, options);

            const group = layer.findOne('Group');
            expect(group).toBeTruthy();

            const texts = group.find('Text');
            expect(texts).toHaveLength(4); // 2 para ancho (arriba y abajo) y 2 para alto (izquierda y derecha)

            // Verificar las etiquetas de dimensiones
            texts.forEach(text => {
                expect(text.fontSize()).toBe(12);
                expect(text.fill()).toBe('#666666');
                expect(text.text()).toBe('200px'); // 300 - 100 = 200
            });
        });

        it('should clear layer correctly', () => {
            const startPoint = { x: 100, y: 100 };
            const endPoint = { x: 300, y: 300 };
            const options = {
                wallThickness: 15,
                showDimensions: true
            };

            roomRenderer.renderPreview(layer, startPoint, endPoint, options);
            expect(layer.children.length).toBeGreaterThan(0);

            roomRenderer.clear(layer);
            expect(layer.children.length).toBe(0);
        });
    });
}); 