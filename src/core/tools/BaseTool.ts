import { ITool, IToolContext } from './interfaces/ITool';
import { EventBus } from '../events/EventBus';

export abstract class BaseTool implements ITool {
    protected eventBus: EventBus;
    private _isActive: boolean = false;
    private unsubscribeFunctions: (() => void)[] = [];

    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly icon: string,
        public readonly type: string,
        public readonly shortcut?: string
    ) {
        this.eventBus = EventBus.getInstance();
    }

    // Lifecycle methods
    initialize(): void {
        this.registerEventHandlers?.();
    }

    dispose(): void {
        // Limpiar todas las suscripciones
        this.unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
        this.unsubscribeFunctions = [];
        this.deactivate();
    }

    // Tool state management
    isActive(): boolean {
        return this._isActive;
    }

    async activate(): Promise<void> {
        if (this._isActive) {
            console.log(`Tool ${this.id} is already active`);
            return;
        }

        this._isActive = true;
        await this.onActivate();
        this.eventBus.emit('tool:activated', {
            id: this.id,
            name: this.name,
            icon: this.icon,
            type: this.type
        });
    }

    async deactivate(): Promise<void> {
        if (!this._isActive) {
            console.log(`Tool ${this.id} is already inactive`);
            return;
        }

        this._isActive = false;
        await this.onDeactivate();
        this.eventBus.emit('tool:deactivated', {
            id: this.id,
            name: this.name,
            icon: this.icon,
            type: this.type
        });
    }

    // Event handlers (to be implemented by concrete tools)
    onMouseDown(context: IToolContext): void {}
    onMouseMove(context: IToolContext): void {}
    onMouseUp(context: IToolContext): void {}
    onKeyDown(event: KeyboardEvent): void {}
    onKeyUp(event: KeyboardEvent): void {}

    // Protected methods for tool-specific logic
    protected async onActivate(): Promise<void> {}
    protected async onDeactivate(): Promise<void> {}

    // Optional methods
    getProperties?(): unknown {
        return undefined;
    }

    setProperties?(props: unknown): void {}

    registerEventHandlers?(): void {}

    // Protected methods for event handling
    protected subscribeToEvent(eventName: string, callback: (data: any) => void): void {
        const fullEventName = `tool:${this.id}:${eventName}`;
        const unsubscribe = this.eventBus.subscribe(fullEventName, callback);
        this.unsubscribeFunctions.push(unsubscribe);
    }

    protected emitEvent(eventName: string, data?: any): void {
        const fullEventName = `tool:${this.id}:${eventName}`;
        this.eventBus.emit(fullEventName, data);
    }
} 