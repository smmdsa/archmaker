import { Vector2 } from 'three';
import { Command } from './Command';
import { Wall, WallProperties } from '../models/Wall';
import { WallNode } from '../models/WallNode';
import { WallGraph } from '../models/WallGraph';

export class CreateWallCommand extends Command {
    private wall: Wall | null = null;
    private readonly startNode: WallNode;
    private readonly endNode: WallNode;
    private readonly properties: WallProperties;

    constructor(graph: WallGraph, startNode: WallNode, endNode: WallNode, properties: WallProperties) {
        super(graph);
        this.startNode = startNode;
        this.endNode = endNode;
        this.properties = { ...properties };
    }

    execute(): void {
        this.wall = this.graph.createWall(this.startNode, this.endNode, this.properties);
    }

    undo(): void {
        if (this.wall) {
            this.graph.removeWall(this.wall.getId());
            this.wall = null;
        }
    }
}

export class MoveNodeCommand extends Command {
    private readonly node: WallNode;
    private readonly oldPosition: Vector2;
    private readonly newPosition: Vector2;

    constructor(graph: WallGraph, node: WallNode, newPosition: Vector2) {
        super(graph);
        this.node = node;
        this.oldPosition = node.getPosition();
        this.newPosition = newPosition.clone();
    }

    execute(): void {
        this.node.setPosition(this.newPosition.x, this.newPosition.y);
    }

    undo(): void {
        this.node.setPosition(this.oldPosition.x, this.oldPosition.y);
    }
}

export class SplitWallCommand extends Command {
    private readonly wall: Wall;
    private readonly splitPoint: Vector2;
    private newNode: WallNode | null = null;
    private newWalls: [Wall, Wall] | null = null;

    constructor(graph: WallGraph, wall: Wall, splitPoint: Vector2) {
        super(graph);
        this.wall = wall;
        this.splitPoint = splitPoint.clone();
    }

    execute(): void {
        const result = this.graph.splitWall(this.wall, this.splitPoint);
        this.newNode = result.node;
        this.newWalls = result.walls;
    }

    undo(): void {
        if (!this.newNode || !this.newWalls) return;

        // Remove the new walls
        this.graph.removeWall(this.newWalls[0].getId());
        this.graph.removeWall(this.newWalls[1].getId());

        // Remove the split node
        this.graph.removeNode(this.newNode.getId());

        // Recreate the original wall
        this.graph.createWall(
            this.wall.getStartNode(),
            this.wall.getEndNode(),
            this.wall.getProperties()
        );
    }
}

export class DeleteWallCommand extends Command {
    private readonly wall: Wall;
    private readonly properties: WallProperties;
    private readonly startNode: WallNode;
    private readonly endNode: WallNode;

    constructor(graph: WallGraph, wall: Wall) {
        super(graph);
        this.wall = wall;
        this.properties = wall.getProperties();
        this.startNode = wall.getStartNode();
        this.endNode = wall.getEndNode();
    }

    execute(): void {
        this.graph.removeWall(this.wall.getId());
    }

    undo(): void {
        this.graph.createWall(this.startNode, this.endNode, this.properties);
    }
}

export class DeleteNodeCommand extends Command {
    private readonly node: WallNode;
    private connectedWalls: Array<{
        wall: Wall;
        properties: WallProperties;
        startNode: WallNode;
        endNode: WallNode;
    }> = [];

    constructor(graph: WallGraph, node: WallNode) {
        super(graph);
        this.node = node;
        
        // Store information about connected walls for undo
        node.getConnectedWalls().forEach(wall => {
            this.connectedWalls.push({
                wall,
                properties: wall.getProperties(),
                startNode: wall.getStartNode(),
                endNode: wall.getEndNode()
            });
        });
    }

    execute(): void {
        this.graph.removeNode(this.node.getId());
    }

    undo(): void {
        // Recreate the node
        const position = this.node.getPosition();
        const newNode = this.graph.addNode(position.x, position.y);

        // Recreate all connected walls
        this.connectedWalls.forEach(({ properties, startNode, endNode }) => {
            const actualStartNode = startNode === this.node ? newNode : startNode;
            const actualEndNode = endNode === this.node ? newNode : endNode;
            this.graph.createWall(actualStartNode, actualEndNode, properties);
        });
    }
} 