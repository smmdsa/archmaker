import { EventBus } from '../events/EventBus';

export abstract class Component {
    protected element: HTMLElement;
    protected eventBus: EventBus;
    private eventSubscriptions: Array<() => void>;
    private componentId: string;

    constructor(container: HTMLElement, id?: string) {
        this.element = document.createElement('div');
        container.appendChild(this.element);
        
        this.eventBus = EventBus.getInstance();
        this.eventSubscriptions = [];
        this.componentId = id || this.generateComponentId();
        
        this.element.setAttribute('data-component-id', this.componentId);
        this.setupBaseStyles();
    }

    // Método abstracto que deben implementar las clases hijas
    protected abstract render(): void;

    // Método para inicializar el componente
    protected initialize(): void {
        // Las clases hijas pueden sobrescribir este método
    }

    // Configuración de estilos base
    private setupBaseStyles(): void {
        this.element.classList.add('base-component');
    }

    // Generar ID único para el componente
    private generateComponentId(): string {
        return `component-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Métodos para manejo de eventos
    protected subscribe(eventName: string, callback: (data: any) => void): void {
        const unsubscribe = this.eventBus.subscribe(eventName, callback);
        this.eventSubscriptions.push(unsubscribe);
    }

    protected emit(eventName: string, data?: any): void {
        this.eventBus.emit(eventName, data);
    }

    // Método para limpiar suscripciones
    protected cleanup(): void {
        this.eventSubscriptions.forEach(unsubscribe => unsubscribe());
        this.eventSubscriptions = [];
    }

    // Método para destruir el componente
    public destroy(): void {
        this.cleanup();
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }

    // Métodos utilitarios para manipulación del DOM
    protected createElement<K extends keyof HTMLElementTagNameMap>(
        tag: K,
        className?: string,
        attributes?: Record<string, string>
    ): HTMLElementTagNameMap[K] {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (attributes) {
            Object.entries(attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        return element;
    }

    protected createInput(
        type: string,
        value: string | number,
        onChange: (value: string) => void,
        options?: {
            className?: string;
            placeholder?: string;
            min?: string | number;
            max?: string | number;
            step?: string | number;
        }
    ): HTMLInputElement {
        const input = this.createElement('input', options?.className || 'input-base');
        input.type = type;
        input.value = value.toString();
        
        if (options) {
            if (options.placeholder) input.placeholder = options.placeholder;
            if (options.min) input.min = options.min.toString();
            if (options.max) input.max = options.max.toString();
            if (options.step) input.step = options.step.toString();
        }

        input.addEventListener('change', (e) => {
            onChange((e.target as HTMLInputElement).value);
        });

        return input;
    }

    protected createSelect(
        options: Array<{ value: string; label: string }>,
        selectedValue: string,
        onChange: (value: string) => void,
        className?: string
    ): HTMLSelectElement {
        const select = this.createElement('select', className || 'input-base');
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            select.appendChild(optionElement);
        });

        select.value = selectedValue;
        select.addEventListener('change', (e) => {
            onChange((e.target as HTMLSelectElement).value);
        });

        return select;
    }

    // Método para actualizar estilos
    protected updateStyles(styles: Partial<CSSStyleDeclaration>): void {
        Object.assign(this.element.style, styles);
    }

    // Método para obtener el elemento raíz del componente
    public getElement(): HTMLElement {
        return this.element;
    }

    // Método para obtener el ID del componente
    public getId(): string {
        return this.componentId;
    }
} 