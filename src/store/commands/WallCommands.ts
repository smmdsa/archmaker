import { Command } from './Command';
import { ProjectStore, Point } from '../ProjectStore';

export class AddWallCommand implements Command {
    private wallId: string | null = null;

    constructor(
        private store: ProjectStore,
        private start: Point,
        private end: Point,
        private height: number = 240,
        private thickness: number = 15
    ) {}

    execute(): void {
        this.wallId = this.store.addWall(this.start, this.end, this.height, this.thickness);
    }

    undo(): void {
        if (this.wallId) {
            this.store.removeWall(this.wallId);
        }
    }
}

export class RemoveWallCommand implements Command {
    private wallData: {
        id: string;
        start: Point;
        end: Point;
        height: number;
        thickness: number;
    } | null = null;

    constructor(private store: ProjectStore, private wallId: string) {
        const wall = store.getWall(wallId);
        if (wall) {
            this.wallData = { ...wall };
        }
    }

    execute(): void {
        if (this.wallData) {
            this.store.removeWall(this.wallData.id);
        }
    }

    undo(): void {
        if (this.wallData) {
            this.store.addWallWithId(
                this.wallData.id,
                this.wallData.start,
                this.wallData.end,
                this.wallData.height,
                this.wallData.thickness
            );
        }
    }
} 