import { TopbarItem } from '../../core/topbar/decorators/TopbarItem';
import type { ITopbarItem, ITopbarManifest } from '../../core/topbar/interfaces/ITopbarItem';
import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import { StorageMenu } from './components/StorageMenu';
import { StoragePlugin } from './index';
import { CanvasStore } from '../../store/CanvasStore';

@TopbarItem({
    id: 'storage',
    name: 'File',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24">
            <path d="M0 0h24v24H0z" fill="none"/>
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
          </svg>`,
    section: 'main',
    order: 0,
    tooltip: 'File Menu'
})
export class StorageTopbarItem implements ITopbarItem {
    declare readonly id: string;
    declare readonly manifest: ITopbarManifest;
    private menu: StorageMenu;
    private storagePlugin: StoragePlugin;
    private canvasStore: CanvasStore;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager
    ) {
        this.menu = new StorageMenu(eventManager, logger);
        this.storagePlugin = new StoragePlugin(eventManager, logger, configManager);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    async initialize(): Promise<void> {
        await this.storagePlugin.initialize();
        
        this.eventManager.on('storage:menu:new', this.handleNewProject.bind(this));
        this.eventManager.on('storage:menu:open', this.handleOpenProject.bind(this));
        this.eventManager.on('storage:menu:save', this.handleSaveProject.bind(this));
        this.eventManager.on('storage:menu:export', this.handleExport.bind(this));
        this.eventManager.on('storage:menu:import', this.handleImport.bind(this));
        
        this.logger.info('StorageTopbarItem initialized');
    }

    private async handleNewProject(): Promise<void> {
        await this.storagePlugin.handleNewProject();
    }

    private async handleOpenProject(): Promise<void> {
        await this.storagePlugin.handleOpenProject();
    }

    private async handleSaveProject(): Promise<void> {
        await this.storagePlugin.handleSaveProject();
    }

    private async handleExport(): Promise<void> {
        await this.storagePlugin.handleExport();
    }

    private async handleImport(): Promise<void> {
        await this.storagePlugin.handleImport();
    }

    async dispose(): Promise<void> {
        await this.storagePlugin.dispose();
        this.menu.dispose();
    }
} 