import { Component } from '../../core/ui/Component';
import { ToolService } from '../../core/tools/services/ToolService';
import { IToolContext } from '../../core/tools/interfaces/ITool';
import { Point } from '../../store/ProjectStore';

export abstract class BaseCanvas extends Component {
    protected toolService: ToolService;
    protected gridSize: number = 100; // 100 píxeles = 1 metro
    protected scale: number = 1;

    constructor(container: HTMLElement) {
        super(container, 'canvas-component');
        this.toolService = ToolService.getInstance();
        this.setupEventListeners();
    }

    protected abstract getPointerPosition(): Point | null;
    protected abstract getScale(): number;

    private setupEventListeners(): void {
        // Keyboard events
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    protected createToolContext(): IToolContext | null {
        const position = this.getPointerPosition();
        if (!position) return null;

        return {
            canvasPosition: position,
            scale: this.getScale(),
            gridSize: this.gridSize
        };
    }

    protected handleMouseDown(event: MouseEvent): void {
        const context = this.createToolContext();
        if (context) {
            this.toolService.handleMouseDown(context);
        }
    }

    protected handleMouseMove(event: MouseEvent): void {
        const context = this.createToolContext();
        if (context) {
            this.toolService.handleMouseMove(context);
        }
    }

    protected handleMouseUp(event: MouseEvent): void {
        const context = this.createToolContext();
        if (context) {
            this.toolService.handleMouseUp(context);
        }
    }

    private handleKeyDown(event: KeyboardEvent): void {
        this.toolService.handleKeyDown(event);
    }

    private handleKeyUp(event: KeyboardEvent): void {
        this.toolService.handleKeyUp(event);
    }

    // Override del método destroy para limpiar recursos
    destroy(): void {
        window.removeEventListener('keydown', this.handleKeyDown.bind(this));
        window.removeEventListener('keyup', this.handleKeyUp.bind(this));
        super.destroy();
    }
} 