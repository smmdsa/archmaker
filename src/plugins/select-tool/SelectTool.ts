import { BaseTool } from '../../core/tools/BaseTool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ISelectableObject, SelectableObjectType } from '../../core/interfaces/ISelectableObject';
import { Point } from '../../core/types/geometry';

const toolManifest = {
    id: 'select-tool',
    name: 'Select Tool',
    version: '1.0.0',
    icon: '🔍',
    tooltip: 'Select objects (S)',
    section: 'tools',
    order: 1,
    shortcut: 's'
};

@ToolPlugin({
    id: 'select-tool',
    name: 'Select Tool',
    version: '1.0.0',
    description: 'Tool for selecting objects',
    icon: '🔍',
    tooltip: 'Select objects (S)',
    section: 'tools',
    order: 1,
    shortcut: 's'
})
export class SelectTool extends BaseTool {
    private selectedObjects: Set<ISelectableObject> = new Set();
    private lastClickedObject: ISelectableObject | null = null;

    constructor(
        eventManager: IEventManager,
        logger: ILogger
    ) {
        super(eventManager, logger, 'select-tool', toolManifest);
    }

    // Selection Management Methods
    getSelectedObjects(): ISelectableObject[] {
        return Array.from(this.selectedObjects);
    }

    getSelectedObjectsByType(type: SelectableObjectType): ISelectableObject[] {
        return Array.from(this.selectedObjects).filter(obj => obj.type === type);
    }

    addToSelection(object: ISelectableObject, emitEvent: boolean = true): void {
        if (!this.selectedObjects.has(object)) {
            object.setSelected(true);
            this.selectedObjects.add(object);
            
            if (emitEvent) {
                this.emitSelectionChanged();
                this.eventManager.emit('selection:single', { object });
            }
        }
    }

    removeFromSelection(object: ISelectableObject, emitEvent: boolean = true): void {
        if (this.selectedObjects.has(object)) {
            object.setSelected(false);
            this.selectedObjects.delete(object);
            
            if (emitEvent) {
                this.emitSelectionChanged();
            }
        }
    }

    clearSelection(emitEvent: boolean = true): void {
        this.selectedObjects.forEach(obj => obj.setSelected(false));
        this.selectedObjects.clear();
        this.lastClickedObject = null;
        
        if (emitEvent) {
            this.emitSelectionChanged();
            this.eventManager.emit('selection:cleared');
        }
    }

    isSelected(object: ISelectableObject): boolean {
        return this.selectedObjects.has(object);
    }

    private emitSelectionChanged(): void {
        this.eventManager.emit('selection:changed', {
            selected: this.getSelectedObjects()
        });
    }

    // Event Handling
    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        switch (event.type) {
            case 'mousedown':
                await this.handleMouseDown(event);
                break;
        }
    }

    private async handleMouseDown(event: CanvasEvent): Promise<void> {
        if (!event.position) return;

        // Emit selection:attempt before actually selecting
        this.eventManager.emit('selection:attempt', { position: event.position });

        // Handle multi-select with Ctrl/Cmd key
        const isMultiSelect = event.originalEvent?.ctrlKey || event.originalEvent?.metaKey;

        // Find clicked object through event system
        this.eventManager.emit('object:hit-test', {
            position: event.position,
            callback: (hitObject: ISelectableObject | null) => {
                if (hitObject) {
                    if (isMultiSelect) {
                        // Toggle selection for multi-select
                        if (this.isSelected(hitObject)) {
                            this.removeFromSelection(hitObject);
                        } else {
                            this.addToSelection(hitObject);
                        }
                    } else {
                        // Single select
                        if (!this.isSelected(hitObject)) {
                            this.clearSelection(false);
                            this.addToSelection(hitObject);
                        }
                    }
                    this.lastClickedObject = hitObject;
                } else if (!isMultiSelect) {
                    // Clear selection when clicking empty space
                    this.clearSelection();
                }
            }
        });
    }

    // Tool Lifecycle
    async activate(): Promise<void> {
        await super.activate();
        this.logger.info('Select tool activated');
    }

    async deactivate(): Promise<void> {
        this.clearSelection();
        await super.deactivate();
        this.logger.info('Select tool deactivated');
    }
} 