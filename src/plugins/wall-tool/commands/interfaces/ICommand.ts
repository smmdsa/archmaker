export interface ICommand {
    execute(): Promise<void>;
    undo(): Promise<void>;
    redo(): Promise<void>;
}

export interface ICommandContext {
    graphService: any; // Will be properly typed once we import WallGraphService
    eventEmitter: any; // Will be properly typed once we import EventEmitter
}

export interface ICommandMetadata {
    description: string;
    timestamp: number;
    userId?: string;
} 