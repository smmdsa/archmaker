import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { WindowObject } from '../objects/WindowObject';

export class WindowStore {
    private static instance: WindowStore | null = null;
    private windows: Map<string, WindowObject> = new Map();

    private constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {}

    static getInstance(eventManager: IEventManager, logger: ILogger): WindowStore {
        if (!WindowStore.instance) {
            WindowStore.instance = new WindowStore(eventManager, logger);
        }
        return WindowStore.instance;
    }

    addWindow(window: WindowObject): void {
        this.windows.set(window.id, window);
        this.eventManager.emit('window:added', { window });
        this.eventManager.emit('window:changed', {});
    }

    removeWindow(id: string): void {
        const window = this.windows.get(id);
        if (window) {
            window.destroy();
            this.windows.delete(id);
            this.eventManager.emit('window:removed', { windowId: id });
            this.eventManager.emit('window:changed', {});
        }
    }

    getWindow(id: string): WindowObject | undefined {
        return this.windows.get(id);
    }

    getAllWindows(): WindowObject[] {
        return Array.from(this.windows.values());
    }

    clear(): void {
        this.windows.forEach(window => window.destroy());
        this.windows.clear();
        this.eventManager.emit('window:changed', {});
    }
} 