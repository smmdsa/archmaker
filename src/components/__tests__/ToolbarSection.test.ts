import { ToolbarSection } from '../ToolbarSection';
import { Tool } from '../../core/interfaces/IToolProvider';

describe('ToolbarSection', () => {
    let container: HTMLElement;
    let toolbarSection: ToolbarSection;
    let mockTools: Tool[];
    let mockOnToolClick: jest.Mock;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        mockTools = [
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

        mockOnToolClick = jest.fn();

        toolbarSection = new ToolbarSection(
            container,
            'Test Section',
            mockTools,
            mockOnToolClick
        );
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it('should render section title', () => {
        const titleElement = container.querySelector('.section-title');
        expect(titleElement).toBeTruthy();
        expect(titleElement?.textContent).toBe('Test Section');
    });

    it('should render all tools', () => {
        const toolButtons = container.querySelectorAll('.tool-button');
        expect(toolButtons.length).toBe(mockTools.length);
    });

    it('should call onToolClick when a tool is clicked', () => {
        const firstToolButton = container.querySelector('.tool-button');
        firstToolButton?.click();
        expect(mockOnToolClick).toHaveBeenCalledWith(mockTools[0]);
    });

    it('should update active tool', () => {
        toolbarSection.setActiveTool('tool-1');
        const activeButton = container.querySelector('.tool-button.active');
        expect(activeButton).toBeTruthy();
        expect(activeButton?.title).toBe('Test Tool 1');
    });

    it('should update tools list', () => {
        const newTools: Tool[] = [
            {
                id: 'tool-3',
                name: 'Test Tool 3',
                icon: '🔩',
                tooltip: 'Test Tool 3',
                section: 'test',
                order: 3
            }
        ];

        toolbarSection.updateTools(newTools);
        const toolButtons = container.querySelectorAll('.tool-button');
        expect(toolButtons.length).toBe(1);
        expect(toolButtons[0].title).toBe('Test Tool 3');
    });
}); 