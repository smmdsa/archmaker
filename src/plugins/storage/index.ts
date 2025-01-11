import { IPlugin, PluginManifest } from '../../core/interfaces/IPlugin';
import { IEventManager } from '../../core/interfaces/IEventManager';
import { ILogger } from '../../core/interfaces/ILogger';
import { IConfigManager } from '../../core/interfaces/IConfig';
import { LocalStorageService } from './LocalStorageService';
import { IStorageService } from '../../core/interfaces/IStorageService';
import { UIComponentManifest } from '../../core/interfaces/IUIRegion';

// Exportar StorageTopbarItem para que se registre
export * from './StorageTopbarItem';

export class StoragePlugin implements IPlugin {
    private storageService: IStorageService;
    
    readonly manifest: PluginManifest = {
        id: 'storage-plugin',
        name: 'Storage Plugin',
        version: '1.0.0',
        type: 'service',
        description: 'Provides project storage capabilities',
        author: 'ArchMaker',
        uiComponents: [
            {
                id: 'storage-menu',
                region: 'topbar',
                order: 0,
                template: `
                    <div class="topbar-menu">
                        <div class="topbar-menu-trigger">File</div>
                        <div class="topbar-menu-content">
                            <div class="topbar-menu-item" data-action="new">
                                <i>📄</i> New Project
                            </div>
                            <div class="topbar-menu-item" data-action="open">
                                <i>📂</i> Open Project
                            </div>
                            <div class="topbar-menu-item" data-action="save">
                                <i>💾</i> Save Project
                            </div>
                            <div class="topbar-menu-separator"></div>
                            <div class="topbar-menu-item" data-action="export">
                                <i>📤</i> Export
                            </div>
                            <div class="topbar-menu-item" data-action="import">
                                <i>📥</i> Import
                            </div>
                        </div>
                    </div>
                `,
                events: {
                    click: this.handleMenuClick.bind(this)
                }
            }
        ]
    };

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager
    ) {
        this.storageService = new LocalStorageService(logger, eventManager, configManager);
    }

    async initialize(): Promise<void> {
        this.logger.info('Initializing Storage Plugin...');
        await this.storageService.initialize();

        // Suscribirse a eventos del menú
        this.eventManager.on('storage:menu:new', this.handleNewProject.bind(this));
        this.eventManager.on('storage:menu:open', this.handleOpenProject.bind(this));
        this.eventManager.on('storage:menu:save', this.handleSaveProject.bind(this));
        this.eventManager.on('storage:menu:export', this.handleExport.bind(this));
        this.eventManager.on('storage:menu:import', this.handleImport.bind(this));
    }

    async dispose(): Promise<void> {
        this.logger.info('Disposing Storage Plugin...');
        await this.storageService.dispose();
    }

    getStorageService(): IStorageService {
        return this.storageService;
    }

    getUIComponents(): UIComponentManifest[] {
        return this.manifest.uiComponents || [];
    }

    private handleMenuClick(event: Event): void {
        const target = event.target as HTMLElement;
        const menuItem = target.closest('[data-action]');
        if (!menuItem) return;

        const action = (menuItem as HTMLElement).dataset.action;
        if (action) {
            this.eventManager.emit(`storage:menu:${action}`, {});
            
            // Cerrar el menú
            const menu = target.closest('.topbar-menu');
            if (menu) {
                menu.classList.remove('open');
            }
        }
    }

    private async handleNewProject(): Promise<void> {
        this.logger.info('Creating new project...');
        // TODO: Implementar creación de nuevo proyecto
    }

    private async handleOpenProject(): Promise<void> {
        this.logger.info('Opening project selector...');
        // TODO: Implementar selector de proyectos
    }

    private async handleSaveProject(): Promise<void> {
        this.logger.info('Saving current project...');
        // TODO: Implementar guardado de proyecto
    }

    private async handleExport(): Promise<void> {
        this.logger.info('Opening export dialog...');
        // TODO: Implementar exportación
    }

    private async handleImport(): Promise<void> {
        this.logger.info('Opening import dialog...');
        // TODO: Implementar importación
    }
} 