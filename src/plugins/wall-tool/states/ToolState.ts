export class ToolState {
    private currentState: string;

    constructor() {
        this.currentState = 'idle';
    }

    setState(state: string): void {
        this.currentState = state;
    }

    getState(): string {
        return this.currentState;
    }

    isDrawing(): boolean {
        return this.currentState === 'drawing';
    }

    // Additional state management methods
} 