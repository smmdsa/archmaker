export enum WallToolState {
    IDLE = 'idle',
    DRAWING = 'drawing',
    EDITING = 'editing',
    DELETING = 'deleting'
}

export class ToolState {
    private currentState: WallToolState;

    constructor() {
        this.currentState = WallToolState.IDLE;
    }

    setState(state: WallToolState): void {
        this.currentState = state;
    }

    getState(): WallToolState {
        return this.currentState;
    }

    isDrawing(): boolean {
        return this.currentState === WallToolState.DRAWING;
    }

    isEditing(): boolean {
        return this.currentState === WallToolState.EDITING;
    }

    isDeleting(): boolean {
        return this.currentState === WallToolState.DELETING;
    }

    isIdle(): boolean {
        return this.currentState === WallToolState.IDLE;
    }

    reset(): void {
        this.currentState = WallToolState.IDLE;
    }
} 