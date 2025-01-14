import { CanvasStore } from './CanvasStore';
import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';

export class StoreService {
    private canvasStore: CanvasStore | null = null;
    private eventManager: IEventManager | null = null;
    private logger: ILogger | null = null;

    async initialize(): Promise<void> {
        // Initialize will be called with dependencies later
    }

    setDependencies(eventManager: IEventManager, logger: ILogger): void {
        this.eventManager = eventManager;
        this.logger = logger;
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    getCanvasStore(): CanvasStore {
        if (!this.canvasStore) {
            throw new Error('CanvasStore not initialized. Call setDependencies first.');
        }
        return this.canvasStore;
    }
} 