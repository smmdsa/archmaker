import { Toolbar } from '../Toolbar';
import { IPluginManager } from '../../core/interfaces/IPluginManager';
import { IToolProvider, Tool } from '../../core/interfaces/IToolProvider';

describe('Toolbar', () => {
    let container: HTMLElement;
    let toolbar: Toolbar;
    let mockPluginManager: jest.Mocked<IPluginManager>;
    let mockToolProvider: jest.Mocked<IToolProvider>;

    const mockTools: Tool[] = [
        {
            id: 'tool-1',
            name: 'Test Tool 1',
            icon: '🔨',
            tooltip: 'Test Tool 1',
            section: 'test',
            order: 1
        },
        {
            id: 'tool-2',
            name: 'Test Tool 2',
            icon: '🔧',
            tooltip: 'Test Tool 2',
            section: 'test',
            order: 2
        }
    ];

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        mockToolProvider = {
            id: 'test-provider',
            getTools: jest.fn().mockReturnValue(mockTools),
            activateTool: jest.fn().mockResolvedValue(undefined),
            deactivateTool: jest.fn().mockResolvedValue(undefined),
            isToolActive: jest.fn().mockReturnValue(false)
        } as unknown as jest.Mocked<IToolProvider>;

        mockPluginManager = {
            getPlugins: jest.fn().mockReturnValue([mockToolProvider])
        } as unknown as jest.Mocked<IPluginManager>;

        toolbar = new Toolbar(container, mockPluginManager);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it('should render toolbar with sections', () => {
        const sections = container.querySelectorAll('.toolbar-section');
        expect(sections.length).toBe(1); // Solo una sección 'test'
    });

    it('should render all tools', () => {
        const toolButtons = container.querySelectorAll('.tool-button');
        expect(toolButtons.length).toBe(mockTools.length);
    });

    it('should activate tool on click', async () => {
        const firstToolButton = container.querySelector('.tool-button');
        await firstToolButton?.click();

        expect(mockToolProvider.activateTool).toHaveBeenCalledWith('tool-1');
        expect(firstToolButton?.classList.contains('active')).toBe(true);
    });

    it('should deactivate tool when clicking active tool', async () => {
        const firstToolButton = container.querySelector('.tool-button');
        
        // Activar herramienta
        await firstToolButton?.click();
        expect(mockToolProvider.activateTool).toHaveBeenCalledWith('tool-1');

        // Desactivar herramienta
        await firstToolButton?.click();
        expect(mockToolProvider.deactivateTool).toHaveBeenCalledWith('tool-1');
        expect(firstToolButton?.classList.contains('active')).toBe(false);
    });

    it('should switch between tools', async () => {
        const [firstTool, secondTool] = container.querySelectorAll('.tool-button');

        // Activar primera herramienta
        await firstTool?.click();
        expect(mockToolProvider.activateTool).toHaveBeenCalledWith('tool-1');
        expect(firstTool?.classList.contains('active')).toBe(true);

        // Cambiar a segunda herramienta
        await secondTool?.click();
        expect(mockToolProvider.deactivateTool).toHaveBeenCalledWith('tool-1');
        expect(mockToolProvider.activateTool).toHaveBeenCalledWith('tool-2');
        expect(firstTool?.classList.contains('active')).toBe(false);
        expect(secondTool?.classList.contains('active')).toBe(true);
    });

    it('should update tools when requested', () => {
        const newTools: Tool[] = [
            {
                id: 'tool-3',
                name: 'Test Tool 3',
                icon: '🔩',
                tooltip: 'Test Tool 3',
                section: 'new-section',
                order: 1
            }
        ];

        mockToolProvider.getTools.mockReturnValue(newTools);
        toolbar.updateTools();

        const sections = container.querySelectorAll('.toolbar-section');
        expect(sections.length).toBe(1); // Ahora solo 'new-section'

        const toolButtons = container.querySelectorAll('.tool-button');
        expect(toolButtons.length).toBe(1);
        expect(toolButtons[0].title).toBe('Test Tool 3');
    });
}); 