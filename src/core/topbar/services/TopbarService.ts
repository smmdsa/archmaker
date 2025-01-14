import { ITopbarItem } from '../interfaces/ITopbarItem';
import { TopbarRepository } from '../repositories/TopbarRepository';
import { topbarRegistry } from '../registry/TopbarRegistry';
import { IEventManager } from '../../interfaces/IEventManager';
import { ILogger } from '../../interfaces/ILogger';
import { IConfigManager } from '../../interfaces/IConfig';

export class TopbarService {
    private repository: TopbarRepository;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager
    ) {
        this.repository = TopbarRepository.getInstance();
        this.initialize();
    }

    private initialize(): void {
        // Crear instancias de todos los items registrados
        const items = topbarRegistry.createItems(this.eventManager, this.logger, this.configManager);
        items.forEach(item => this.registerItem(item));
    }

    registerItem(item: ITopbarItem): void {
        try {
            this.repository.registerItem(item);
            item.initialize();
            this.eventManager.emit('topbar:updated', { items: this.getAllItems() });
            this.logger.debug(`Registered topbar item: ${item.id}`);
        } catch (error) {
            this.logger.error(`Failed to register topbar item: ${item.id}`, error as Error);
            throw error;
        }
    }

    unregisterItem(itemId: string): void {
        try {
            this.repository.unregisterItem(itemId);
            this.eventManager.emit('topbar:updated', { items: this.getAllItems() });
            this.logger.debug(`Unregistered topbar item: ${itemId}`);
        } catch (error) {
            this.logger.error(`Failed to unregister topbar item: ${itemId}`, error as Error);
            throw error;
        }
    }

    getItem(itemId: string): ITopbarItem | undefined {
        return this.repository.getItem(itemId);
    }

    getAllItems(): ITopbarItem[] {
        return this.repository.getAllItems();
    }

    getItemsBySection(section: string): ITopbarItem[] {
        return this.repository.getItemsBySection(section);
    }

    getSections(): string[] {
        return this.repository.getSections();
    }

    clear(): void {
        try {
            this.repository.clear();
            this.eventManager.emit('topbar:updated', { items: [] });
            this.logger.debug('Cleared all topbar items');
        } catch (error) {
            this.logger.error('Failed to clear topbar items', error as Error);
            throw error;
        }
    }
} 