import { BaseTool } from '../../core/tools/BaseTool';
import { IToolContext } from '../../core/tools/interfaces/ITool';
import { IPlugin } from '../../core/interfaces/IPlugin';
import { ToolService } from '../../core/tools/services/ToolService';
import { Point } from '../../store/ProjectStore';

export class MoveTool extends BaseTool implements IPlugin {
    private isDragging: boolean = false;
    private startPosition: Point | null = null;
    private lastPosition: Point | null = null;

    constructor() {
        super(
            'move:default',
            'Move',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M13 6v5h5V7.5L22.5 12 18 16.5V13h-5v5h3.5L12 22.5 7.5 18H11v-5H6v3.5L1.5 12 6 7.5V11h5V6H7.5L12 1.5 16.5 6H13z"/></svg>'
        );
    }

    // Implementación de IPlugin
    initialize(): void {
        ToolService.getInstance().registerTool(this);
    }

    dispose(): void {
        ToolService.getInstance().unregisterTool(this.id);
        super.dispose();
    }

    // Implementación de eventos de herramienta
    onMouseDown(context: IToolContext): void {
        this.isDragging = true;
        this.startPosition = context.canvasPosition;
        this.lastPosition = context.canvasPosition;

        this.emitEvent('drag-start', {
            position: context.canvasPosition
        });
    }

    onMouseMove(context: IToolContext): void {
        if (!this.isDragging || !this.lastPosition) return;

        const delta = {
            x: context.canvasPosition.x - this.lastPosition.x,
            y: context.canvasPosition.y - this.lastPosition.y
        };

        this.lastPosition = context.canvasPosition;

        this.emitEvent('drag-move', {
            position: context.canvasPosition,
            delta
        });
    }

    onMouseUp(context: IToolContext): void {
        if (!this.isDragging || !this.startPosition || !this.lastPosition) return;

        const totalDelta = {
            x: this.lastPosition.x - this.startPosition.x,
            y: this.lastPosition.y - this.startPosition.y
        };

        this.emitEvent('drag-end', {
            startPosition: this.startPosition,
            endPosition: this.lastPosition,
            totalDelta
        });

        this.isDragging = false;
        this.startPosition = null;
        this.lastPosition = null;
    }

    protected onActivate(): void {
        this.emitEvent('activated');
    }

    protected onDeactivate(): void {
        if (this.isDragging) {
            this.isDragging = false;
            this.startPosition = null;
            this.lastPosition = null;
            this.emitEvent('drag-cancelled');
        }
        this.emitEvent('deactivated');
    }

    // Métodos específicos de la herramienta
    isDraggingActive(): boolean {
        return this.isDragging;
    }

    getCurrentDelta(): { x: number; y: number } | null {
        if (!this.isDragging || !this.startPosition || !this.lastPosition) {
            return null;
        }

        return {
            x: this.lastPosition.x - this.startPosition.x,
            y: this.lastPosition.y - this.startPosition.y
        };
    }
} 