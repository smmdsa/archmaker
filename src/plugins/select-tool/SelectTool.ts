import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { UIComponentManifest } from '../../core/interfaces/IUIRegion';
import { ProjectStore } from '../../store/ProjectStore';

const toolManifest = {
    id: 'select-tool',
    name: 'Select Tool',
    version: '1.0.0',
    icon: '🔍',
    tooltip: 'Select objects',
    section: 'edit',
    order: 1,
    shortcut: 's'
};

@ToolPlugin({
    id: 'select-tool',
    name: 'Select Tool',
    version: '1.0.0',
    description: 'Tool for selecting and editing objects',
    icon: '🔍',
    tooltip: 'Select objects',
    section: 'edit',
    order: 1,
    shortcut: 's'
})
export class SelectTool extends BaseTool {
    protected readonly store: ProjectStore;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager,
        store: ProjectStore
    ) {
        super(eventManager, logger, 'select-tool', toolManifest);
        this.store = store;
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        // TODO: Implement selection logic
        this.logger.debug('Select tool received canvas event:', event);
    }

    getUIComponents(): UIComponentManifest[] {
        return [{
            id: 'select-tool-button',
            region: 'toolbar',
            order: 1,
            template: `
                <button class="toolbar-button" title="${toolManifest.tooltip} (${toolManifest.shortcut?.toUpperCase()})">${toolManifest.icon}</button>
            `,
            events: {
                click: () => this.activate()
            }
        }];
    }
} 