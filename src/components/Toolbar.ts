export enum ToolType {
    WALL = 'wall',
    DOOR = 'door',
    WINDOW = 'window',
    SELECT = 'select',
    MOVE = 'move'
}

const TOOL_ICONS: Record<ToolType, string> = {
    [ToolType.WALL]: '🧱',
    [ToolType.DOOR]: '🚪',
    [ToolType.WINDOW]: '⬜',
    [ToolType.SELECT]: '👆',
    [ToolType.MOVE]: '✋'
};

export class Toolbar {
    private container: HTMLElement;
    private currentTool: ToolType = ToolType.SELECT;
    private onToolChange: (tool: ToolType) => void;

    constructor(containerId: string, onToolChange: (tool: ToolType) => void) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error('Toolbar container not found');
        this.container = container;
        this.onToolChange = onToolChange;
        this.createToolbar();
    }

    private createToolbar(): void {
        this.container.className = 'toolbar';
        Object.values(ToolType).forEach(tool => {
            const button = document.createElement('button');
            button.innerHTML = `${TOOL_ICONS[tool]}<span class="tooltip">${tool}</span>`;
            button.className = `tool-button ${tool === this.currentTool ? 'active' : ''}`;
            button.dataset.tool = tool;
            button.addEventListener('click', () => this.selectTool(tool));
            this.container.appendChild(button);
        });

        // Add basic styles
        const style = document.createElement('style');
        style.textContent = `
            .toolbar {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 8px;
                background: #ffffff;
                box-shadow: 2px 0 5px rgba(0,0,0,0.1);
            }

            .tool-button {
                width: 40px;
                height: 40px;
                padding: 8px;
                border: none;
                border-radius: 8px;
                background: #ffffff;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }

            .tool-button:hover {
                background: #f0f0f0;
            }

            .tool-button.active {
                background: #007bff;
                color: white;
            }

            .tool-button .tooltip {
                position: absolute;
                left: 100%;
                top: 50%;
                transform: translateY(-50%);
                background: #333;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
                margin-left: 8px;
            }

            .tool-button:hover .tooltip {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    public selectTool(tool: ToolType): void {
        this.currentTool = tool;
        this.onToolChange(tool);
        
        // Update button styles
        const buttons = this.container.getElementsByClassName('tool-button');
        Array.from(buttons).forEach(button => {
            button.classList.toggle('active', button.dataset.tool === tool);
        });
    }

    public getCurrentTool(): ToolType {
        return this.currentTool;
    }
} 