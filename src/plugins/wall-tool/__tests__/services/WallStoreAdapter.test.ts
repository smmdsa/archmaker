import { WallStoreAdapter } from '../../services/WallStoreAdapter';
import { Wall as StoreWall } from '../../../../store/ProjectStore';
import { Wall, WallUpdateProperties } from '../../types/wall';

describe('WallStoreAdapter', () => {
    let adapter: WallStoreAdapter;

    beforeEach(() => {
        adapter = new WallStoreAdapter('default');
    });

    describe('convertToWall', () => {
        it('should convert store wall to plugin wall', () => {
            const storeWall: StoreWall = {
                id: 'wall-1',
                start: { x: 0, y: 0 },
                end: { x: 100, y: 100 },
                height: 240,
                thickness: 15
            };

            const wall = adapter.convertToWall(storeWall);

            expect(wall).toEqual({
                id: 'wall-1',
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 100, y: 100 },
                height: 240,
                thickness: 15,
                material: 'default',
                length: Math.sqrt(20000), // 100√2
                angle: Math.PI / 4 // 45 degrees
            });
        });
    });

    describe('convertToStoreWall', () => {
        it('should convert plugin wall to store wall', () => {
            const wall: Wall = {
                id: 'wall-1',
                startPoint: { x: 0, y: 0 },
                endPoint: { x: 100, y: 100 },
                height: 240,
                thickness: 15,
                material: 'brick',
                length: 141.42,
                angle: 0.785
            };

            const storeWall = adapter.convertToStoreWall(wall);

            expect(storeWall).toEqual({
                start: { x: 0, y: 0 },
                end: { x: 100, y: 100 },
                height: 240,
                thickness: 15
            });
        });
    });

    describe('convertProperties', () => {
        it('should convert update properties', () => {
            const properties: WallUpdateProperties = {
                startPoint: { x: 50, y: 50 },
                height: 300,
                material: 'brick'
            };

            const storeProperties = adapter.convertProperties(properties);

            expect(storeProperties).toEqual({
                start: { x: 50, y: 50 },
                height: 300
            });
            expect(storeProperties).not.toHaveProperty('material');
        });

        it('should handle empty properties', () => {
            const properties: WallUpdateProperties = {};
            const storeProperties = adapter.convertProperties(properties);
            expect(storeProperties).toEqual({});
        });
    });

    describe('convertPoint', () => {
        it('should convert point', () => {
            const point = { x: 100, y: 200 };
            const converted = adapter.convertPoint(point);
            expect(converted).toEqual(point);
            expect(converted).not.toBe(point); // Should be a new object
        });
    });
}); 