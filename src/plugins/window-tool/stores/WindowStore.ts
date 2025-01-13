import { BehaviorSubject } from 'rxjs';
import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';
import { WindowObject } from '../objects/WindowObject';

interface WindowStoreState {
    windows: Map<string, WindowObject>;
    windowCount: number;
    windowNumbers: Map<string, number>;
}

export class WindowStore {
    private static instance: WindowStore | null = null;
    private readonly state$ = new BehaviorSubject<WindowStoreState>({
        windows: new Map(),
        windowCount: 0,
        windowNumbers: new Map()
    });

    private constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.logger.info('WindowStore singleton initialized');
    }

    static getInstance(eventManager: IEventManager, logger: ILogger): WindowStore {
        if (!WindowStore.instance) {
            WindowStore.instance = new WindowStore(eventManager, logger);
        }
        return WindowStore.instance;
    }

    private updateState(newState: Partial<WindowStoreState>): void {
        const currentState = this.state$.getValue();
        this.state$.next({
            ...currentState,
            ...newState
        });
    }

    addWindow(window: WindowObject): void {
        const currentState = this.state$.getValue();
        const newWindows = new Map(currentState.windows);
        const newWindowNumbers = new Map(currentState.windowNumbers);
        
        newWindows.set(window.id, window);
        newWindowNumbers.set(window.id, currentState.windowCount + 1);
        
        this.updateState({
            windows: newWindows,
            windowCount: currentState.windowCount + 1,
            windowNumbers: newWindowNumbers
        });
        
        window.setWindowNumber(currentState.windowCount + 1);
        
        this.eventManager.emit('window:added', { 
            window, 
            windowNumber: currentState.windowCount + 1 
        });
        
        this.logger.info('Window added to store', {
            windowId: window.id,
            wallId: window.getData().wallId,
            windowNumber: currentState.windowCount + 1
        });
    }

    removeWindow(windowId: string): void {
        const currentState = this.state$.getValue();
        const window = currentState.windows.get(windowId);
        
        if (window) {
            const newWindows = new Map(currentState.windows);
            const newWindowNumbers = new Map(currentState.windowNumbers);
            
            window.destroy();
            newWindows.delete(windowId);
            newWindowNumbers.delete(windowId);
            
            this.updateState({
                windows: newWindows,
                windowNumbers: newWindowNumbers
            });
            
            this.eventManager.emit('window:removed', { windowId });
            this.logger.info('Window removed from store', { windowId });
        }
    }

    getWindow(windowId: string): WindowObject | undefined {
        return this.state$.getValue().windows.get(windowId);
    }

    getAllWindows(): WindowObject[] {
        const state = this.state$.getValue();
        const windows = Array.from(state.windows.values());
        
        this.logger.info('WindowStore state:', {
            totalWindows: windows.length,
            windowCount: state.windowCount,
            storedWindowIds: Array.from(state.windows.keys()),
            windowNumbers: Object.fromEntries(state.windowNumbers),
            windowsWithLabels: windows.map(window => ({
                id: window.id,
                number: state.windowNumbers.get(window.id),
                wallId: window.getData().wallId
            }))
        });
        
        windows.forEach(window => {
            const number = state.windowNumbers.get(window.id);
            if (number) {
                window.setWindowNumber(number);
                this.logger.info('Restoring window number:', { windowId: window.id, number });
            } else {
                this.logger.warn('Window missing number:', { windowId: window.id });
            }
        });
        
        return windows;
    }

    getWindowsByWall(wallId: string): WindowObject[] {
        return this.getAllWindows().filter(window => window.getData().wallId === wallId);
    }

    clear(): void {
        const currentState = this.state$.getValue();
        currentState.windows.forEach(window => window.destroy());
        
        this.updateState({
            windows: new Map(),
            windowCount: 0,
            windowNumbers: new Map()
        });
        
        this.logger.info('WindowStore cleared');
    }
} 