import { BaseTool } from '../../core/tools/BaseTool';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { CanvasEvent } from '../../core/tools/interfaces/ITool';
import { ToolPlugin } from '../../core/plugins/decorators/Plugin';
import { UIComponentManifest } from '../../core/interfaces/IUIRegion';
import { ProjectStore } from '../../store/ProjectStore';

const toolManifest = {
    id: 'move-tool',
    name: 'Move Tool',
    version: '1.0.0',
    icon: '✋',
    tooltip: 'Move objects',
    section: 'edit',
    order: 2,
    shortcut: 'm'
};

@ToolPlugin({
    id: 'move-tool',
    name: 'Move Tool',
    version: '1.0.0',
    description: 'Tool for moving and transforming objects',
    icon: '✋',
    tooltip: 'Move objects',
    section: 'edit',
    order: 2,
    shortcut: 'm'
})
export class MoveTool extends BaseTool {
    protected readonly store: ProjectStore;

    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager,
        store: ProjectStore
    ) {
        super(eventManager, logger, 'move-tool', toolManifest);
        this.store = store;
    }

    async onCanvasEvent(event: CanvasEvent): Promise<void> {
        // TODO: Implement movement logic
        this.logger.debug('Move tool received canvas event:', event);
    }

    getUIComponents(): UIComponentManifest[] {
        return [{
            id: 'move-tool-button',
            region: 'toolbar',
            order: 2,
            template: `
                <button class="toolbar-button" title="${toolManifest.tooltip} (${toolManifest.shortcut?.toUpperCase()})">${toolManifest.icon}</button>
            `,
            events: {
                click: () => this.activate()
            }
        }];
    }
} 