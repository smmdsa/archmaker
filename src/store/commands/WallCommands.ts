import { Command } from './Command';
import { ProjectStore, Wall, Point } from '../ProjectStore';

export class AddWallCommand implements Command {
    private wallId: string | null = null;

    constructor(
        private store: ProjectStore,
        private start: Point,
        private end: Point,
        private height: number = 2.4
    ) {}

    execute(): void {
        this.wallId = this.store.addWall(this.start, this.end, this.height);
    }

    undo(): void {
        if (this.wallId) {
            this.store.removeWall(this.wallId);
        }
    }
}

export class RemoveWallCommand implements Command {
    private removedWall: Wall | null = null;

    constructor(
        private store: ProjectStore,
        private wallId: string
    ) {}

    execute(): void {
        this.removedWall = this.store.getWall(this.wallId);
        if (this.removedWall) {
            this.store.removeWall(this.wallId);
        }
    }

    undo(): void {
        if (this.removedWall) {
            this.store.addWallWithId(
                this.removedWall.id,
                this.removedWall.start,
                this.removedWall.end,
                this.removedWall.height
            );
        }
    }
} 