import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';
import { CanvasStore } from './CanvasStore';

export interface SelectionState {
    nodes: Set<string>;
    walls: Set<string>;
    doors: Set<string>;
    windows: Set<string>;
}

interface SelectionChangedEvent {
    selectedNodes: string[];
    selectedWalls: string[];
    selectedDoors: string[];
    selectedWindows: string[];
    source: string;
}

export class SelectionStore {
    private static instance: SelectionStore | null = null;
    private selectedNodes: Set<string> = new Set();
    private selectedWalls: Set<string> = new Set();
    private selectedDoors: Set<string> = new Set();
    private selectedWindows: Set<string> = new Set();
    private readonly canvasStore: CanvasStore;

    private constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);

        // Listen for selection changes from any tool
        this.eventManager.on<SelectionChangedEvent>('selection:changed', (event) => {
            this.selectedNodes = new Set(event.selectedNodes || []);
            this.selectedWalls = new Set(event.selectedWalls || []);
            this.selectedDoors = new Set(event.selectedDoors || []);
            this.selectedWindows = new Set(event.selectedWindows || []);
            
            // Update visual state of all objects
            this.updateObjectsVisualState();
            
            this.logger.info('Selection store updated:', {
                selectedNodes: Array.from(this.selectedNodes),
                selectedWalls: Array.from(this.selectedWalls),
                selectedDoors: Array.from(this.selectedDoors),
                selectedWindows: Array.from(this.selectedWindows),
                source: event.source
            });
        });

        // Listen for object deletion events to clean up selection
        this.eventManager.on('object:deleted', (event: { objectId: string, type: string }) => {
            switch (event.type) {
                case 'node':
                    this.selectedNodes.delete(event.objectId);
                    break;
                case 'wall':
                    this.selectedWalls.delete(event.objectId);
                    break;
                case 'door':
                    this.selectedDoors.delete(event.objectId);
                    break;
                case 'window':
                    this.selectedWindows.delete(event.objectId);
                    break;
            }
            this.emitSelectionChanged();
        });
    }

    // Helper method to update visual state of all objects
    private updateObjectsVisualState(): void {
        const graph = this.canvasStore.getWallGraph();
        const doorStore = this.canvasStore.getDoorStore();
        const windowStore = this.canvasStore.getWindowStore();

        // Update nodes
        graph.getAllNodes().forEach(node => {
            node.setSelected(this.selectedNodes.has(node.id));
        });

        // Update walls
        graph.getAllWalls().forEach(wall => {
            wall.setSelected(this.selectedWalls.has(wall.id));
        });

        // Update doors
        doorStore.getAllDoors().forEach(door => {
            door.setSelected(this.selectedDoors.has(door.id));
        });

        // Update windows
        windowStore.getAllWindows().forEach(window => {
            window.setSelected(this.selectedWindows.has(window.id));
        });
    }

    // Helper method to emit selection changed event
    private emitSelectionChanged(): void {
        this.eventManager.emit('selection:changed', {
            selectedNodes: Array.from(this.selectedNodes),
            selectedWalls: Array.from(this.selectedWalls),
            selectedDoors: Array.from(this.selectedDoors),
            selectedWindows: Array.from(this.selectedWindows),
            source: 'selection-store'
        });
    }

    // Method to add a single object to selection
    addToSelection(objectId: string, type: string): void {
        switch (type) {
            case 'node':
                this.selectedNodes.add(objectId);
                break;
            case 'wall':
                this.selectedWalls.add(objectId);
                break;
            case 'door':
                this.selectedDoors.add(objectId);
                break;
            case 'window':
                this.selectedWindows.add(objectId);
                break;
        }
        this.emitSelectionChanged();
    }

    // Method to remove a single object from selection
    removeFromSelection(objectId: string, type: string): void {
        switch (type) {
            case 'node':
                this.selectedNodes.delete(objectId);
                break;
            case 'wall':
                this.selectedWalls.delete(objectId);
                break;
            case 'door':
                this.selectedDoors.delete(objectId);
                break;
            case 'window':
                this.selectedWindows.delete(objectId);
                break;
        }
        this.emitSelectionChanged();
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

    // Door selection methods
    getSelectedDoors(): Set<string> {
        return new Set(this.selectedDoors);
    }

    hasSelectedDoors(): boolean {
        return this.selectedDoors.size > 0;
    }

    isDoorSelected(doorId: string): boolean {
        return this.selectedDoors.has(doorId);
    }

    // Window selection methods
    getSelectedWindows(): Set<string> {
        return new Set(this.selectedWindows);
    }

    hasSelectedWindows(): boolean {
        return this.selectedWindows.size > 0;
    }

    isWindowSelected(windowId: string): boolean {
        return this.selectedWindows.has(windowId);
    }

    // Combined selection methods
    hasSelection(): boolean {
        return this.hasSelectedNodes() || this.hasSelectedWalls() || 
               this.hasSelectedDoors() || this.hasSelectedWindows();
    }

    getSelectionState(): SelectionState {
        return {
            nodes: new Set(this.selectedNodes),
            walls: new Set(this.selectedWalls),
            doors: new Set(this.selectedDoors),
            windows: new Set(this.selectedWindows)
        };
    }

    clearSelection(): void {
        if (this.hasSelection()) {
            this.selectedNodes.clear();
            this.selectedWalls.clear();
            this.selectedDoors.clear();
            this.selectedWindows.clear();
            this.eventManager.emit('selection:changed', {
                selectedNodes: [],
                selectedWalls: [],
                selectedDoors: [],
                selectedWindows: [],
                source: 'selection-store'
            });
        }
    }
} 