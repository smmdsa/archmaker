import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';

export interface SelectionState {
    nodes: Set<string>;
    walls: Set<string>;
}

interface SelectionChangedEvent {
    selectedNodes: string[];
    selectedWalls: string[];
    source: string;
}

export class SelectionStore {
    private static instance: SelectionStore | null = null;
    private selectedNodes: Set<string> = new Set();
    private selectedWalls: Set<string> = new Set();

    private constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        // Listen for selection changes from any tool
        this.eventManager.on<SelectionChangedEvent>('selection:changed', (event) => {
            this.selectedNodes = new Set(event.selectedNodes || []);
            this.selectedWalls = new Set(event.selectedWalls || []);
            this.logger.info('Selection store updated:', {
                selectedNodes: Array.from(this.selectedNodes),
                selectedWalls: Array.from(this.selectedWalls),
                source: event.source
            });
        });
    }

    static getInstance(eventManager: IEventManager, logger: ILogger): SelectionStore {
        if (!SelectionStore.instance) {
            SelectionStore.instance = new SelectionStore(eventManager, logger);
        }
        return SelectionStore.instance;
    }

    // Node selection methods
    getSelectedNodes(): Set<string> {
        return new Set(this.selectedNodes);
    }

    hasSelectedNodes(): boolean {
        return this.selectedNodes.size > 0;
    }

    isNodeSelected(nodeId: string): boolean {
        return this.selectedNodes.has(nodeId);
    }

    // Wall selection methods
    getSelectedWalls(): Set<string> {
        return new Set(this.selectedWalls);
    }

    hasSelectedWalls(): boolean {
        return this.selectedWalls.size > 0;
    }

    isWallSelected(wallId: string): boolean {
        return this.selectedWalls.has(wallId);
    }

    // Combined selection methods
    hasSelection(): boolean {
        return this.hasSelectedNodes() || this.hasSelectedWalls();
    }

    getSelectionState(): SelectionState {
        return {
            nodes: new Set(this.selectedNodes),
            walls: new Set(this.selectedWalls)
        };
    }

    clearSelection(): void {
        if (this.hasSelection()) {
            this.selectedNodes.clear();
            this.selectedWalls.clear();
            this.eventManager.emit('selection:changed', {
                selectedNodes: [],
                selectedWalls: [],
                source: 'selection-store'
            });
        }
    }
} 