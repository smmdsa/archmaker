export interface Point {
    x: number;
    y: number;
}

export interface Wall {
    id: string;
    start: Point;
    end: Point;
    height: number;
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
    private walls: Wall[] = [];
    private openings: Opening[] = [];
    private listeners: Array<() => void> = [];

    public addWall(start: Point, end: Point, height: number = 2.4): void {
        const wall: Wall = {
            id: crypto.randomUUID(),
            start,
            end,
            height
        };
        this.walls.push(wall);
        this.notifyListeners();
    }

    public addOpening(type: 'door' | 'window', position: Point, width: number, height: number, wallId: string): void {
        const opening: Opening = {
            id: crypto.randomUUID(),
            type,
            position,
            width,
            height,
            wallId
        };
        this.openings.push(opening);
        this.notifyListeners();
    }

    public getWalls(): Wall[] {
        return [...this.walls];
    }

    public getOpenings(): Opening[] {
        return [...this.openings];
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
        this.walls = [];
        this.openings = [];
        this.notifyListeners();
    }

    // Export project data
    public exportProject(): string {
        const projectData = {
            walls: this.walls,
            openings: this.openings
        };
        return JSON.stringify(projectData, null, 2);
    }

    // Import project data
    public importProject(jsonData: string): void {
        try {
            const data = JSON.parse(jsonData);
            if (data.walls && Array.isArray(data.walls)) {
                this.walls = data.walls;
            }
            if (data.openings && Array.isArray(data.openings)) {
                this.openings = data.openings;
            }
            this.notifyListeners();
        } catch (error) {
            console.error('Error importing project data:', error);
            throw new Error('Invalid project data format');
        }
    }
} 