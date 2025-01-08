import { Command, CommandManager } from './commands/Command';

export interface Point {
    x: number;
    y: number;
}

export interface Wall {
    id: string;
    start: Point;
    end: Point;
    height: number;  // en centímetros
    thickness: number;  // en centímetros
}

export interface Opening {
    id: string;
    type: 'door' | 'window';
    position: Point;
    width: number;
    height: number;
    wallId: string;
}

export class ProjectStore {
    private walls: Map<string, Wall> = new Map();
    private openings: Map<string, Opening> = new Map();
    private listeners: Array<() => void> = [];
    private commandManager: CommandManager;

    constructor() {
        this.commandManager = new CommandManager();
    }

    public addWall(start: Point, end: Point, height: number = 240, thickness: number = 15): string {
        const id = crypto.randomUUID();
        const wall: Wall = { id, start, end, height, thickness };
        this.walls.set(id, wall);
        this.notifyListeners();
        return id;
    }

    public addWallWithId(id: string, start: Point, end: Point, height: number, thickness: number): void {
        const wall: Wall = { id, start, end, height, thickness };
        this.walls.set(id, wall);
        this.notifyListeners();
    }

    public removeWall(id: string): void {
        this.walls.delete(id);
        // Remove any openings associated with this wall
        for (const [openingId, opening] of this.openings.entries()) {
            if (opening.wallId === id) {
                this.openings.delete(openingId);
            }
        }
        this.notifyListeners();
    }

    public getWall(id: string): Wall | undefined {
        return this.walls.get(id);
    }

    public addOpening(type: 'door' | 'window', position: Point, width: number, height: number, wallId: string): string {
        const id = crypto.randomUUID();
        const opening: Opening = {
            id,
            type,
            position,
            width,
            height,
            wallId
        };
        this.openings.set(id, opening);
        this.notifyListeners();
        return id;
    }

    public removeOpening(id: string): void {
        this.openings.delete(id);
        this.notifyListeners();
    }

    public getWalls(): Wall[] {
        return Array.from(this.walls.values());
    }

    public getOpenings(): Opening[] {
        return Array.from(this.openings.values());
    }

    public subscribe(listener: () => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener());
    }

    public clear(): void {
        this.walls.clear();
        this.openings.clear();
        this.commandManager.clear();
        this.notifyListeners();
    }

    public undo(): void {
        if (this.commandManager.canUndo()) {
            this.commandManager.undo();
        }
    }

    public redo(): void {
        if (this.commandManager.canRedo()) {
            this.commandManager.redo();
        }
    }

    public canUndo(): boolean {
        return this.commandManager.canUndo();
    }

    public canRedo(): boolean {
        return this.commandManager.canRedo();
    }

    public executeCommand(command: Command): void {
        this.commandManager.execute(command);
    }

    // Export project data
    public exportProject(): string {
        const projectData = {
            walls: Array.from(this.walls.values()),
            openings: Array.from(this.openings.values())
        };
        return JSON.stringify(projectData, null, 2);
    }

    // Import project data
    public importProject(jsonData: string): void {
        try {
            const data = JSON.parse(jsonData);
            this.walls.clear();
            this.openings.clear();
            
            if (data.walls && Array.isArray(data.walls)) {
                data.walls.forEach((wall: Wall) => {
                    this.walls.set(wall.id, wall);
                });
            }
            
            if (data.openings && Array.isArray(data.openings)) {
                data.openings.forEach((opening: Opening) => {
                    this.openings.set(opening.id, opening);
                });
            }
            
            this.commandManager.clear();
            this.notifyListeners();
        } catch (error) {
            console.error('Error importing project data:', error);
            throw new Error('Invalid project data format');
        }
    }
} 