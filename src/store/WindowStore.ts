import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';
import { WindowObject } from '../plugins/window-tool/objects/WindowObject';

export class WindowStore {
    private static instance: WindowStore | null = null;
    private windows: Map<string, WindowObject> = new Map();

    private constructor(private eventManager: IEventManager, private logger: ILogger) {}

    public static getInstance(eventManager: IEventManager, logger: ILogger): WindowStore {
        if (!WindowStore.instance) {
            WindowStore.instance = new WindowStore(eventManager, logger);
        }
        return WindowStore.instance;
    }

    public addWindow(window: WindowObject): void {
        this.windows.set(window.id, window);
        this.logger.info(`Window added: ${window.id}`);
    }

    public removeWindow(windowId: string): void {
        if (this.windows.delete(windowId)) {
            this.logger.info(`Window removed: ${windowId}`);
        }
    }

    public getAllWindows(): WindowObject[] {
        return Array.from(this.windows.values());
    }

    public clear(): void {
        const windowIds = Array.from(this.windows.keys());
        windowIds.forEach(id => this.removeWindow(id));
        this.windows.clear();
        this.logger.info('All windows cleared');
    }
} 