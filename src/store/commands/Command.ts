export interface Command {
    execute(): void;
    undo(): void;
}

export class CommandManager {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];
    private maxStackSize: number = 50;

    execute(command: Command): void {
        command.execute();
        this.undoStack.push(command);
        // Clear redo stack when new command is executed
        this.redoStack = [];

        // Limit stack size
        if (this.undoStack.length > this.maxStackSize) {
            this.undoStack.shift();
        }
    }

    undo(): void {
        const command = this.undoStack.pop();
        if (command) {
            command.undo();
            this.redoStack.push(command);
        }
    }

    redo(): void {
        const command = this.redoStack.pop();
        if (command) {
            command.execute();
            this.undoStack.push(command);
        }
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }
} 