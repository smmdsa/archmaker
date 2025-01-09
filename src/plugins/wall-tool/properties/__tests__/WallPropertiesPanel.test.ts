import { WallPropertiesPanel } from '../WallPropertiesPanel';
import { IWallService } from '../../services/IWallService';
import { Wall } from '../../types/wall';

describe('WallPropertiesPanel', () => {
    let container: HTMLElement;
    let panel: WallPropertiesPanel;
    let mockService: jest.Mocked<IWallService>;
    let mockOnUpdate: jest.Mock;
    let mockWall: Wall;

    beforeEach(async () => {
        container = document.createElement('div');
        document.body.appendChild(container);

        mockWall = {
            id: 'wall-1',
            height: 240,
            thickness: 15,
            material: 'brick',
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 100, y: 0 },
            length: 100,
            angle: 0
        };

        mockService = {
            id: 'wall-service',
            getAvailableMaterials: jest.fn().mockResolvedValue(['brick', 'concrete', 'wood'])
        } as unknown as jest.Mocked<IWallService>;

        mockOnUpdate = jest.fn();

        panel = new WallPropertiesPanel(
            container,
            mockWall,
            mockService,
            mockOnUpdate
        );

        // Esperar a que se carguen los materiales
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it('should render wall properties', () => {
        const title = container.querySelector('h3');
        expect(title?.textContent).toBe('Wall Properties');

        const inputs = container.querySelectorAll('input');
        expect(inputs.length).toBe(2); // height y thickness

        const heightInput = inputs[0] as HTMLInputElement;
        expect(heightInput.value).toBe('240');
        expect(heightInput.type).toBe('number');

        const thicknessInput = inputs[1] as HTMLInputElement;
        expect(thicknessInput.value).toBe('15');
        expect(thicknessInput.type).toBe('number');
    });

    it('should render material select with options', () => {
        const select = container.querySelector('select') as HTMLSelectElement;
        expect(select).toBeTruthy();
        expect(select.value).toBe('brick');

        const options = select.querySelectorAll('option');
        expect(options.length).toBe(3);
        expect(options[0].value).toBe('brick');
        expect(options[1].value).toBe('concrete');
        expect(options[2].value).toBe('wood');
    });

    it('should call onUpdate when height changes', () => {
        const heightInput = container.querySelector('input') as HTMLInputElement;
        heightInput.value = '300';
        heightInput.dispatchEvent(new Event('change'));

        expect(mockOnUpdate).toHaveBeenCalledWith('wall-1', { height: 300 });
    });

    it('should call onUpdate when thickness changes', () => {
        const thicknessInput = container.querySelectorAll('input')[1] as HTMLInputElement;
        thicknessInput.value = '20';
        thicknessInput.dispatchEvent(new Event('change'));

        expect(mockOnUpdate).toHaveBeenCalledWith('wall-1', { thickness: 20 });
    });

    it('should call onUpdate when material changes', () => {
        const select = container.querySelector('select') as HTMLSelectElement;
        select.value = 'concrete';
        select.dispatchEvent(new Event('change'));

        expect(mockOnUpdate).toHaveBeenCalledWith('wall-1', { material: 'concrete' });
    });

    it('should update when wall changes', () => {
        const newWall: Wall = {
            ...mockWall,
            height: 300,
            thickness: 20,
            material: 'concrete'
        };

        panel.updateWall(newWall);

        const heightInput = container.querySelector('input') as HTMLInputElement;
        expect(heightInput.value).toBe('300');

        const thicknessInput = container.querySelectorAll('input')[1] as HTMLInputElement;
        expect(thicknessInput.value).toBe('20');

        const select = container.querySelector('select') as HTMLSelectElement;
        expect(select.value).toBe('concrete');
    });
}); 