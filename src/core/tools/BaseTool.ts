import { IPlugin, PluginManifest } from '../interfaces/IPlugin';
import { IEventManager } from '../interfaces/IEventManager';
import { ILogger } from '../interfaces/ILogger';
import { CanvasEvent } from './interfaces/ITool';
import { UIComponentManifest } from '../interfaces/IUIRegion';

export interface ToolManifest extends Omit<PluginManifest, 'type'> {
    icon: string;
    tooltip: string;
    section: string;
    order: number;
    shortcut?: string;
}

export abstract class BaseTool implements IPlugin {
    private active: boolean = false;
    /**
     * Manifiesto del plugin
     */
    readonly manifest: PluginManifest;

    constructor(
        protected readonly eventManager: IEventManager,
        protected readonly logger: ILogger,
        id: string,
        toolManifest: ToolManifest
    ) {
        this.manifest = {
            ...toolManifest,
            id,
            type: 'tool',
            uiComponents: [
                {
                    id: `${id}-button`,
                    region: 'toolbar',
                    order: toolManifest.order,
                    template: `
                        <div class="tool-button" title="${toolManifest.tooltip} (${toolManifest.shortcut || ''})" data-tool="${id}">
                            <span class="tool-icon">${toolManifest.icon}</span>
                        </div>
                    `,
                    events: {
                        click: () => this.activate()
                    }
                }
            ],
            shortcut: toolManifest.shortcut
        };

    }

    async initialize(): Promise<void> {
        this.logger.info(`Initializing ${this.manifest.name}...`);
        
        // Suscribirse a eventos de teclado para atajos
        if (this.manifest.shortcut) {
            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === this.manifest.shortcut?.toLowerCase()) {
                    this.activate();
                }
            });
        }
    }

    async dispose(): Promise<void> {
        this.logger.info(`Disposing ${this.manifest.name}...`);
        this.deactivate();
    }

    getUIComponents(): UIComponentManifest[] {
        return this.manifest.uiComponents || [];
    }

    isActive(): boolean {
        return this.active;
    }

    async activate(): Promise<void> {
        if (this.active) return;

        this.active = true;
        this.logger.info(`Tool activated: ${this.manifest.id}`);
        await this.eventManager.emit('tool:activated', { toolId: this.manifest.id });
    }

    async deactivate(): Promise<void> {
        if (!this.active) return;

        this.active = false;
        this.logger.info(`Tool deactivated: ${this.manifest.id}`);
        await this.eventManager.emit('tool:deactivated', { toolId: this.manifest.id });
    }

    abstract onCanvasEvent(event: CanvasEvent): Promise<void>;
} 