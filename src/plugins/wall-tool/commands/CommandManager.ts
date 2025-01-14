import { ICommand } from './Command';

export class CommandManager {
    private undoStack: ICommand[] = [];
    private redoStack: ICommand[] = [];
    private maxHistorySize: number = 50;

    execute(command: ICommand): void {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = []; // Clear redo stack on new command

        // Trim history if it exceeds max size
        if (this.undoStack.length > this.maxHistorySize) {
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

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    getUndoStackSize(): number {
        return this.undoStack.length;
    }

    getRedoStackSize(): number {
        return this.redoStack.length;
    }
} 