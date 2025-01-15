import { IEventManager } from '../../interfaces/IEventManager';
import { topbarRegistry } from '../registry/TopbarRegistry';
import { ILogger } from '../../interfaces/ILogger';
import { IConfigManager } from '../../interfaces/IConfig';
import { ITopbarItem } from '../interfaces/ITopbarItem';

export class TopbarService {
    private items: ITopbarItem[] = [];

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager
    ) {}

    async initialize(): Promise<void> {
        try {
            this.logger.info('TopbarService: Initializing Topbar Service');
            
            // Create items
            this.items = topbarRegistry.createItems(this.eventManager, this.logger, this.configManager);
            this.logger.info(`TopbarService: Created ${this.items.length} topbar items`);
            
            // Initialize each item
            for (const item of this.items) {
                try {
                    await item.initialize();
                    this.logger.info(`TopbarService: Initialized item ${item.id}`);
                } catch (error) {
                    this.logger.error(`TopbarService: Failed to initialize item ${item.id}`, error as Error);
                    throw error;
                }
            }
            
            this.logger.info('TopbarService: All items initialized');
        } catch (error) {
            this.logger.error('TopbarService: Failed to initialize Topbar Service', error as Error);
            throw error;
        }
    }

    getItemsBySection(section: string): ITopbarItem[] {
        return this.items
            .filter(item => item.manifest.section === section)
            .sort((a, b) => (a.manifest.order || 0) - (b.manifest.order || 0));
    }

    getSections(): string[] {
        const sections = new Set<string>();
        this.items.forEach(item => sections.add(item.manifest.section));
        return Array.from(sections);
    }

    async dispose(): Promise<void> {
        try {
            for (const item of this.items) {
                await item.dispose();
            }
            this.items = [];
            this.logger.info('Topbar Service disposed');
        } catch (error) {
            this.logger.error('Failed to dispose Topbar Service', error as Error);
            throw error;
        }
    }
} 