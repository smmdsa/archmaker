import { Tool } from '../core/interfaces/IToolProvider';
import { Component } from '../core/ui/Component';

export class ToolbarSection extends Component {
    private tools: Tool[];
    private activeTool: string | null;
    private onToolClick: (tool: Tool) => void;

    constructor(
        container: HTMLElement,
        private title: string,
        tools: Tool[],
        onToolClick: (tool: Tool) => void,
        activeTool: string | null = null
    ) {
        super(container);
        this.tools = tools;
        this.onToolClick = onToolClick;
        this.activeTool = activeTool;
        this.initialize();
    }

    private initialize(): void {
        this.element.classList.add('toolbar-section');
        this.setupStyles();
        this.render();
    }

    render(): void {
        this.element.innerHTML = '';
        
        // Crear título de la sección
        const titleDiv = document.createElement('div');
        titleDiv.className = 'section-title';
        titleDiv.textContent = this.title;
        this.element.appendChild(titleDiv);

        // Crear contenedor de herramientas
        const toolsDiv = document.createElement('div');
        toolsDiv.className = 'section-tools';
        this.element.appendChild(toolsDiv);

        // Crear botones de herramientas
        this.tools.forEach(tool => {
            const button = document.createElement('button');
            button.className = `tool-button ${tool.id === this.activeTool ? 'active' : ''}`;
            button.title = tool.tooltip;
            button.onclick = () => this.onToolClick(tool);

            const iconSpan = document.createElement('span');
            iconSpan.className = 'tool-icon';
            iconSpan.textContent = tool.icon;
            button.appendChild(iconSpan);

            const tooltipSpan = document.createElement('span');
            tooltipSpan.className = 'tooltip';
            tooltipSpan.textContent = tool.name;
            button.appendChild(tooltipSpan);

            toolsDiv.appendChild(button);
        });
    }

    private setupStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .toolbar-section {
                padding: 8px 0;
                border-bottom: 1px solid #eee;
            }

            .toolbar-section:last-child {
                border-bottom: none;
            }

            .section-title {
                font-size: 12px;
                color: #666;
                padding: 0 8px 8px;
                text-transform: uppercase;
            }

            .section-tools {
                display: flex;
                flex-direction: column;
                gap: 4px;
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
            }

            .tool-icon {
                font-size: 20px;
            }

            .tool-button:hover {
                background: #f0f0f0;
            }

            .tool-button.active {
                background: #007bff;
                color: white;
            }

            .tooltip {
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

    setActiveTool(toolId: string | null): void {
        this.activeTool = toolId;
        this.render();
    }

    updateTools(tools: Tool[]): void {
        this.tools = tools;
        this.render();
    }
} 