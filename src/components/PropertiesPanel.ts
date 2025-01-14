import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';
import { ToolService } from '../core/tools/services/ToolService';

export class PropertiesPanel {
    private container: HTMLElement;
    private currentProperties: any = null;

    constructor(
        containerId: string,
        private readonly toolService: ToolService,
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly onUpdate: (props: any) => void
    ) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Properties panel container not found: ${containerId}`);
        }
        this.container = container;
        this.initialize();
    }

    private initialize(): void {
        this.logger.info('Initializing properties panel...');
        this.setupEventListeners();
        this.render();
    }

    private setupEventListeners(): void {
        this.eventManager.on('tool:activated', ({ toolId }) => {
            const tool = this.toolService.getAvailableTools().find(t => t.id === toolId);
            if (tool) {
                this.updateProperties(tool);
            }
        });
    }

    private updateProperties(tool: any): void {
        this.currentProperties = tool.getProperties?.() || null;
        this.render();
    }

    private render(): void {
        this.container.innerHTML = '';
        
        if (!this.currentProperties) {
            this.container.innerHTML = '<div class="no-properties">No properties available</div>';
            return;
        }

        const form = document.createElement('form');
        form.className = 'properties-form';

        Object.entries(this.currentProperties).forEach(([key, value]) => {
            const formGroup = this.createFormGroup(key, value);
            form.appendChild(formGroup);
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const properties = Object.fromEntries(formData.entries());
            this.onUpdate(properties);
        });

        this.container.appendChild(form);
    }

    private createFormGroup(key: string, value: any): HTMLDivElement {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.textContent = this.formatLabel(key);
        label.htmlFor = key;

        const input = this.createInput(key, value);
        input.id = key;
        input.name = key;

        formGroup.appendChild(label);
        formGroup.appendChild(input);

        return formGroup;
    }

    private createInput(key: string, value: any): HTMLInputElement | HTMLSelectElement {
        if (typeof value === 'boolean') {
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = value;
            return input;
        }

        if (typeof value === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.value = value.toString();
            return input;
        }

        if (Array.isArray(value)) {
            const select = document.createElement('select');
            value.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            });
            return select;
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.value = value.toString();
        return input;
    }

    private formatLabel(key: string): string {
        return key
            .split(/(?=[A-Z])/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    public dispose(): void {
        this.logger.info('Disposing properties panel...');
        this.container.innerHTML = '';
    }
} 