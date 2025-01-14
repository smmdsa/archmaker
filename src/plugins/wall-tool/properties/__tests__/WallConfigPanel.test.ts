import { WallConfigPanel } from '../WallConfigPanel';
import { IWallService } from '../../services/IWallService';
import { WallProperties } from '../../types/wall';

describe('WallConfigPanel', () => {
    let container: HTMLElement;
    let panel: WallConfigPanel;
    let mockService: jest.Mocked<IWallService>;

    const defaultProperties: WallProperties = {
        height: 240,
        thickness: 15,
        material: 'brick',
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 0, y: 0 }
    };

    beforeEach(async () => {
        container = document.createElement('div');
        document.body.appendChild(container);

        mockService = {
            id: 'wall-service',
            getWallDefaults: jest.fn().mockResolvedValue(defaultProperties),
            setWallDefaults: jest.fn().mockResolvedValue(undefined),
            getAvailableMaterials: jest.fn().mockResolvedValue(['brick', 'concrete', 'wood'])
        } as unknown as jest.Mocked<IWallService>;

        panel = new WallConfigPanel(container, mockService);

        // Esperar a que se cargue la configuración
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it('should render configuration panel', () => {
        const title = container.querySelector('h3');
        expect(title?.textContent).toBe('Wall Tool Configuration');

        const subtitle = container.querySelector('h4');
        expect(subtitle?.textContent).toBe('Default Properties');

        const inputs = container.querySelectorAll('input');
        expect(inputs.length).toBe(2); // height y thickness

        const select = container.querySelector('select');
        expect(select).toBeTruthy();
    });

    it('should load and display default values', () => {
        const heightInput = container.querySelector('input') as HTMLInputElement;
        expect(heightInput.value).toBe('240');

        const thicknessInput = container.querySelectorAll('input')[1] as HTMLInputElement;
        expect(thicknessInput.value).toBe('15');

        const materialSelect = container.querySelector('select') as HTMLSelectElement;
        expect(materialSelect.value).toBe('brick');
    });

    it('should render material options', () => {
        const select = container.querySelector('select') as HTMLSelectElement;
        const options = select.querySelectorAll('option');
        expect(options.length).toBe(3);
        expect(options[0].value).toBe('brick');
        expect(options[1].value).toBe('concrete');
        expect(options[2].value).toBe('wood');
    });

    it('should update height and call service', async () => {
        const heightInput = container.querySelector('input') as HTMLInputElement;
        heightInput.value = '300';
        heightInput.dispatchEvent(new Event('change'));

        expect(mockService.setWallDefaults).toHaveBeenCalledWith({ height: 300 });
    });

    it('should update thickness and call service', async () => {
        const thicknessInput = container.querySelectorAll('input')[1] as HTMLInputElement;
        thicknessInput.value = '20';
        thicknessInput.dispatchEvent(new Event('change'));

        expect(mockService.setWallDefaults).toHaveBeenCalledWith({ thickness: 20 });
    });

    it('should update material and call service', async () => {
        const select = container.querySelector('select') as HTMLSelectElement;
        select.value = 'concrete';
        select.dispatchEvent(new Event('change'));

        expect(mockService.setWallDefaults).toHaveBeenCalledWith({ material: 'concrete' });
    });

    it('should revert changes on service error', async () => {
        mockService.setWallDefaults.mockRejectedValueOnce(new Error('Update failed'));

        const heightInput = container.querySelector('input') as HTMLInputElement;
        heightInput.value = '300';
        heightInput.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(heightInput.value).toBe('240'); // Revierte al valor original
    });

    it('should refresh configuration', async () => {
        const newDefaults: WallProperties = {
            ...defaultProperties,
            height: 300,
            thickness: 20,
            material: 'concrete'
        };

        mockService.getWallDefaults.mockResolvedValueOnce(newDefaults);
        await panel.refresh();

        const heightInput = container.querySelector('input') as HTMLInputElement;
        expect(heightInput.value).toBe('300');

        const thicknessInput = container.querySelectorAll('input')[1] as HTMLInputElement;
        expect(thicknessInput.value).toBe('20');

        const materialSelect = container.querySelector('select') as HTMLSelectElement;
        expect(materialSelect.value).toBe('concrete');
    });
}); 