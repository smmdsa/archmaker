import { BaseTool } from '../../core/tools/BaseTool';
import { IToolContext } from '../../core/tools/interfaces/ITool';
import { IPlugin } from '../../core/interfaces/IPlugin';
import { ToolService } from '../../core/tools/services/ToolService';

export class SelectTool extends BaseTool implements IPlugin {
    private selectedElementId: string | null = null;

    constructor() {
        super(
            'select:default',
            'Select',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M13.293 6.293L7.586 12l5.707 5.707 1.414-1.414L10.414 12l4.293-4.293z"/></svg>'
        );
    }

    // Implementación de IPlugin
    initialize(): void {
        // Registrar la herramienta en el servicio
        ToolService.getInstance().registerTool(this);
    }

    dispose(): void {
        // Limpiar recursos y desregistrar la herramienta
        ToolService.getInstance().unregisterTool(this.id);
        super.dispose();
    }

    // Implementación de eventos de herramienta
    onMouseDown(context: IToolContext): void {
        this.emitEvent('selection-start', {
            position: context.canvasPosition
        });
    }

    onMouseUp(context: IToolContext): void {
        this.emitEvent('selection-end', {
            position: context.canvasPosition
        });
    }

    protected onActivate(): void {
        this.emitEvent('activated');
    }

    protected onDeactivate(): void {
        if (this.selectedElementId) {
            this.emitEvent('selection-clear', {
                previousSelection: this.selectedElementId
            });
            this.selectedElementId = null;
        }
        this.emitEvent('deactivated');
    }

    // Métodos específicos de la herramienta
    setSelectedElement(elementId: string): void {
        const previousSelection = this.selectedElementId;
        this.selectedElementId = elementId;
        
        this.emitEvent('selection-changed', {
            previous: previousSelection,
            current: elementId
        });
    }

    clearSelection(): void {
        if (this.selectedElementId) {
            const previousSelection = this.selectedElementId;
            this.selectedElementId = null;
            
            this.emitEvent('selection-clear', {
                previousSelection
            });
        }
    }

    getSelectedElement(): string | null {
        return this.selectedElementId;
    }
} 