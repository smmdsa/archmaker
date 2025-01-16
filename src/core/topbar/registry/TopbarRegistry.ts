import { ITopbarItem, ITopbarManifest } from '../interfaces/ITopbarItem';
import { IEventManager } from '../../interfaces/IEventManager';
import { ILogger } from '../../interfaces/ILogger';
import { IConfigManager } from '../../interfaces/IConfig';

type TopbarItemConstructor = new (
    eventManager: IEventManager,
    logger: ILogger,
    configManager: IConfigManager
) => ITopbarItem;

class TopbarRegistry {
    private static instance: TopbarRegistry;
    private items: Map<string, { constructor: TopbarItemConstructor, manifest: ITopbarManifest }> = new Map();

    private constructor() {}

    static getInstance(): TopbarRegistry {
        if (!TopbarRegistry.instance) {
            TopbarRegistry.instance = new TopbarRegistry();
        }
        return TopbarRegistry.instance;
    }

    register(manifest: ITopbarManifest, itemConstructor: TopbarItemConstructor): void {
        if (this.items.has(manifest.id)) {
            throw new Error(`Topbar item ${manifest.id} already registered`);
        }
        this.items.set(manifest.id, { constructor: itemConstructor, manifest });
    }

    createItems(
        eventManager: IEventManager,
        logger: ILogger,
        configManager: IConfigManager
    ): ITopbarItem[] {
        return Array.from(this.items.values()).map(
            ({ constructor: Constructor, manifest }) => {
                logger.info(`TopbarRegistry: Creating ${manifest.id} topbar item`);
                const instance = new Constructor(eventManager, logger, configManager);
                Object.defineProperty(instance, 'manifest', { value: manifest });
                Object.defineProperty(instance, 'id', { value: manifest.id });
                return instance;
            }
        );
    }
}

export const topbarRegistry = TopbarRegistry.getInstance(); 