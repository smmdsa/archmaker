import { WallGraph } from '../models/WallGraph';

export interface ICommand {
    execute(): void;
    undo(): void;
}

export abstract class Command implements ICommand {
    protected graph: WallGraph;

    constructor(graph: WallGraph) {
        this.graph = graph;
    }

    abstract execute(): void;
    abstract undo(): void;
} 