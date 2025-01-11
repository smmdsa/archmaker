import { BaseTool, ToolManifest } from './BaseTool';
import type { IEventManager } from '../interfaces/IEventManager';
import type { ILogger } from '../interfaces/ILogger';
import type { IConfigManager } from '../interfaces/IConfig';
import { ProjectStore } from '../../store/ProjectStore';
import { IPlugin } from '../interfaces/IPlugin';

/**
 * Base class for tools that require access to the store
 * This class is designed to work with the Plugin system and store dependency
 */
export abstract class StoreBasedTool extends BaseTool implements IPlugin {
    constructor(
        eventManager: IEventManager,
        logger: ILogger,
        protected readonly configManager: IConfigManager,
        protected readonly store: ProjectStore,
        id: string,
        toolManifest: ToolManifest
    ) {
        super(eventManager, logger, id, toolManifest);
    }

    // Implement required IPlugin methods
    async initialize(): Promise<void> {
        // Base initialization
        return Promise.resolve();
    }

    async dispose(): Promise<void> {
        // Base cleanup
        return Promise.resolve();
    }
} 