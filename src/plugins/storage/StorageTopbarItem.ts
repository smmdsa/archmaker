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
    private menu!: StorageMenu;
    private storagePlugin: StoragePlugin;
    private canvasStore: CanvasStore;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager
    ) {
        this.storagePlugin = new StoragePlugin(eventManager, logger, configManager);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    async initialize(): Promise<void> {
        try {
            // Initialize the plugin first
            await this.storagePlugin.initialize();
            this.logger.info('StoragePlugin initialized');

            // Create menu after plugin is initialized
            this.menu = new StorageMenu(this.eventManager, this.logger);
            
            // Bind event handlers
            this.eventManager.on('storage:menu:new', this.handleNewProject.bind(this));
            this.eventManager.on('storage:menu:open', this.handleOpenProject.bind(this));
            this.eventManager.on('storage:menu:save', this.handleSaveProject.bind(this));
            this.eventManager.on('storage:menu:export', this.handleExport.bind(this));
            this.eventManager.on('storage:menu:import', this.handleImport.bind(this));
            
            this.logger.info('StorageTopbarItem initialized');
        } catch (error) {
            this.logger.error('Failed to initialize StorageTopbarItem:', error as Error);
            throw error;
        }
    }

    private async handleNewProject(): Promise<void> {
        try {
            await this.storagePlugin.handleNewProject();
        } catch (error) {
            this.logger.error('Failed to handle new project:', error as Error);
        }
    }

    private async handleOpenProject(): Promise<void> {
        try {
            await this.storagePlugin.handleOpenProject();
        } catch (error) {
            this.logger.error('Failed to handle open project:', error as Error);
        }
    }

    private async handleSaveProject(): Promise<void> {
        try {
            await this.storagePlugin.handleSaveProject();
        } catch (error) {
            this.logger.error('Failed to handle save project:', error as Error);
        }
    }

    private async handleExport(): Promise<void> {
        try {
            await this.storagePlugin.handleExport();
        } catch (error) {
            this.logger.error('Failed to handle export:', error as Error);
        }
    }

    private async handleImport(): Promise<void> {
        try {
            await this.storagePlugin.handleImport();
        } catch (error) {
            this.logger.error('Failed to handle import:', error as Error);
        }
    }

    async dispose(): Promise<void> {
        try {
            await this.storagePlugin.dispose();
            this.menu.dispose();
        } catch (error) {
            this.logger.error('Failed to dispose StorageTopbarItem:', error as Error);
        }
    }
} 