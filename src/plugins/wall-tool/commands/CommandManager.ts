import { ICommand } from './Command';
import { ILogger } from '../../../core/interfaces/ILogger';

export class CommandManager {
    private undoStack: ICommand[] = [];
    private redoStack: ICommand[] = [];
    private maxHistorySize: number = 50;
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    async execute(command: ICommand): Promise<void> {
        try {
            this.logger.info('Executing command:', { 
                commandType: command.constructor.name,
                undoStackSize: this.undoStack.length,
                redoStackSize: this.redoStack.length
            });

            await command.execute();
            this.undoStack.push(command);
            this.redoStack = []; // Clear redo stack on new command

            // Trim history if it exceeds max size
            if (this.undoStack.length > this.maxHistorySize) {
                this.undoStack.shift();
            }

            this.logger.info('Command executed successfully', {
                commandType: command.constructor.name,
                newUndoStackSize: this.undoStack.length
            });
        } catch (error) {
            this.logger.error('Failed to execute command', error as Error);
            throw error;
        }
    }

    async undo(): Promise<void> {
        const command = this.undoStack.pop();
        if (command) {
            try {
                this.logger.info('Undoing command:', { 
                    commandType: command.constructor.name,
                    remainingUndoStackSize: this.undoStack.length
                });

                await command.undo();
                this.redoStack.push(command);

                this.logger.info('Command undone successfully', {
                    commandType: command.constructor.name,
                    newRedoStackSize: this.redoStack.length
                });
            } catch (error) {
                this.logger.error('Failed to undo command', error as Error);
                // Put the command back on the undo stack if it failed
                this.undoStack.push(command);
                throw error;
            }
        } else {
            this.logger.info('No commands to undo');
        }
    }

    async redo(): Promise<void> {
        const command = this.redoStack.pop();
        if (command) {
            try {
                this.logger.info('Redoing command:', { 
                    commandType: command.constructor.name,
                    remainingRedoStackSize: this.redoStack.length
                });

                await command.execute();
                this.undoStack.push(command);

                this.logger.info('Command redone successfully', {
                    commandType: command.constructor.name,
                    newUndoStackSize: this.undoStack.length
                });
            } catch (error) {
                this.logger.error('Failed to redo command', error as Error);
                // Put the command back on the redo stack if it failed
                this.redoStack.push(command);
                throw error;
            }
        } else {
            this.logger.info('No commands to redo');
        }
    }

    clear(): void {
        this.logger.info('Clearing command history', {
            previousUndoStackSize: this.undoStack.length,
            previousRedoStackSize: this.redoStack.length
        });
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