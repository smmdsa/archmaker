import { Point } from '../../../core/types/geometry';
import { NodeObject } from '../objects/NodeObject';
import { WallObject } from '../objects/WallObject';
import { WallCommandService } from '../services/WallCommandService';

export interface ICommand {
    execute(): Promise<void>;
    undo(): Promise<void>;
}

export interface ICommandContext {
    commandService: WallCommandService;
}

// Base command class to handle common functionality
export abstract class BaseCommand implements ICommand {
    constructor(protected context: ICommandContext) {}
    abstract execute(): Promise<void>;
    abstract undo(): Promise<void>;
}

// Command to create a wall
export class CreateWallCommand extends BaseCommand {
    private createdWall: WallObject | null = null;
    private createdStartNode: boolean = false;
    private createdEndNode: boolean = false;

    constructor(
        context: ICommandContext,
        private readonly startNode: NodeObject,
        private readonly endNode: NodeObject,
        private readonly properties?: any,
        private readonly isNewStartNode: boolean = false,
        private readonly isNewEndNode: boolean = false
    ) {
        super(context);
        this.createdStartNode = isNewStartNode;
        this.createdEndNode = isNewEndNode;
    }

    async execute(): Promise<void> {
        this.createdWall = await this.context.commandService.createWall(
            this.startNode,
            this.endNode,
            this.properties
        );
    }

    async undo(): Promise<void> {
        if (this.createdWall) {
            await this.context.commandService.deleteWall(this.createdWall);
            this.createdWall = null;

            // Delete nodes only if they were created for this wall and have no other connections
            if (this.createdStartNode && this.startNode.getConnectedWalls().length === 0) {
                await this.context.commandService.deleteNode(this.startNode);
            }
            if (this.createdEndNode && this.endNode.getConnectedWalls().length === 0) {
                await this.context.commandService.deleteNode(this.endNode);
            }
        }
    }
}

// Command to delete a wall
export class DeleteWallCommand extends BaseCommand {
    private deletedWallData: any;
    private startNode: NodeObject | null = null;
    private endNode: NodeObject | null = null;
    private startNodeData: any = null;
    private endNodeData: any = null;
    private startNodeDeleted: boolean = false;
    private endNodeDeleted: boolean = false;

    constructor(
        context: ICommandContext,
        private readonly wall: WallObject
    ) {
        super(context);
    }

    async execute(): Promise<void> {
        // Store the wall and node data before deletion
        this.deletedWallData = this.wall.getData();
        
        // Get the nodes
        const graph = this.context.commandService.getWallGraph();
        this.startNode = graph.getNode(this.deletedWallData.startNodeId);
        this.endNode = graph.getNode(this.deletedWallData.endNodeId);

        // Store node data if they exist
        if (this.startNode) {
            this.startNodeData = this.startNode.getData();
            // Check if node will be isolated after wall deletion
            this.startNodeDeleted = this.startNode.getConnectedWalls().length === 1;
        }
        if (this.endNode) {
            this.endNodeData = this.endNode.getData();
            // Check if node will be isolated after wall deletion
            this.endNodeDeleted = this.endNode.getConnectedWalls().length === 1;
        }

        // Delete the wall
        await this.context.commandService.deleteWall(this.wall);

        // Delete isolated nodes
        if (this.startNodeDeleted && this.startNode) {
            await this.context.commandService.deleteNode(this.startNode);
        }
        if (this.endNodeDeleted && this.endNode) {
            await this.context.commandService.deleteNode(this.endNode);
        }
    }

    async undo(): Promise<void> {
        // Recreate nodes if they were deleted
        let startNode = this.startNode;
        let endNode = this.endNode;

        if (this.startNodeDeleted && this.startNodeData) {
            startNode = await this.context.commandService.createNode(this.startNodeData.position);
        }
        if (this.endNodeDeleted && this.endNodeData) {
            endNode = await this.context.commandService.createNode(this.endNodeData.position);
        }

        // Recreate the wall
        if (startNode && endNode) {
            await this.context.commandService.createWall(startNode, endNode, {
                thickness: this.deletedWallData.thickness,
                height: this.deletedWallData.height
            });
        }
    }
}

// Command to move a node
export class MoveNodeCommand extends BaseCommand {
    private oldPosition: Point;

    constructor(
        context: ICommandContext,
        private readonly node: NodeObject,
        private readonly newPosition: Point
    ) {
        super(context);
        this.oldPosition = { ...node.position };
    }

    async execute(): Promise<void> {
        await this.context.commandService.updateNode(this.node, this.newPosition);
    }

    async undo(): Promise<void> {
        await this.context.commandService.updateNode(this.node, this.oldPosition);
    }
}

// Command to split a wall
export class SplitWallCommand extends BaseCommand {
    private originalWall: WallObject;
    private newNode: NodeObject | null = null;
    private newWalls: WallObject[] = [];
    private originalWallData: any;

    constructor(
        context: ICommandContext,
        wall: WallObject,
        private readonly splitPoint: Point
    ) {
        super(context);
        this.originalWall = wall;
    }

    async execute(): Promise<void> {
        // Store original wall data before any changes
        this.originalWallData = this.originalWall.getData();
        
        // Create new node at split point using CreateNodeCommand
        const createNodeCommand = new CreateNodeCommand(
            this.context,
            this.splitPoint
        );
        await createNodeCommand.execute();
        this.newNode = createNodeCommand.getNode();
        
        if (!this.newNode) {
            throw new Error('Failed to create node at split point');
        }

        // Get original nodes
        const graph = this.context.commandService.getWallGraph();
        const startNode = graph.getNode(this.originalWallData.startNodeId);
        const endNode = graph.getNode(this.originalWallData.endNodeId);

        if (!startNode || !endNode) {
            throw new Error('Failed to find original wall nodes');
        }

        // Create two new walls
        const wall1 = await this.context.commandService.createWall(
            startNode,
            this.newNode,
            {
                thickness: this.originalWallData.thickness,
                height: this.originalWallData.height
            }
        );

        const wall2 = await this.context.commandService.createWall(
            this.newNode,
            endNode,
            {
                thickness: this.originalWallData.thickness,
                height: this.originalWallData.height
            }
        );

        if (!wall1 || !wall2) {
            throw new Error('Failed to create new walls');
        }

        this.newWalls = [wall1, wall2];

        // Delete original wall
        await this.context.commandService.deleteWall(this.originalWall);
    }

    async undo(): Promise<void> {
        // Delete the new walls
        for (const wall of this.newWalls) {
            await this.context.commandService.deleteWall(wall);
        }

        // Delete the new node
        if (this.newNode) {
            await this.context.commandService.deleteNode(this.newNode);
        }

        // Get original nodes that should still exist
        const graph = this.context.commandService.getWallGraph();
        const startNode = graph.getNode(this.originalWallData.startNodeId);
        const endNode = graph.getNode(this.originalWallData.endNodeId);

        if (!startNode || !endNode) {
            throw new Error('Failed to find original nodes during undo');
        }

        // Recreate the original wall between existing nodes
        await this.context.commandService.createWall(startNode, endNode, {
            thickness: this.originalWallData.thickness,
            height: this.originalWallData.height
        });
    }
}

// Command to merge nodes
export class MergeNodesCommand extends BaseCommand {
    private mergedWalls: WallObject[] = [];
    private sourceNodeData: any = null;
    private connectedWallsData: any[] = [];

    constructor(
        context: ICommandContext,
        private readonly sourceNode: NodeObject,
        private readonly targetNode: NodeObject
    ) {
        super(context);
    }

    async execute(): Promise<void> {
        // Store source node data for undo
        this.sourceNodeData = this.sourceNode.getData();
        
        // Store data of all walls connected to source node
        const connectedWalls = this.sourceNode.getConnectedWalls();
        for (const wallId of connectedWalls) {
            const wall = this.context.commandService.getWallGraph().getWall(wallId);
            if (wall) {
                this.connectedWallsData.push({
                    wallData: wall.getData(),
                    isStartNode: wall.getStartNodeId() === this.sourceNode.id
                });
            }
        }

        // Perform the merge
        await this.context.commandService.mergeNodes(this.sourceNode, this.targetNode);
    }

    async undo(): Promise<void> {
        if (!this.sourceNodeData) return;

        // Recreate the source node
        const sourceNode = await this.context.commandService.createNode(this.sourceNodeData.position);

        // Recreate all the original walls
        for (const wallData of this.connectedWallsData) {
            const startNode = wallData.isStartNode ? sourceNode : this.targetNode;
            const endNode = wallData.isStartNode ? this.targetNode : sourceNode;
            
            await this.context.commandService.createWall(
                startNode,
                endNode,
                {
                    thickness: wallData.wallData.thickness,
                    height: wallData.wallData.height
                }
            );
        }
    }
}

// Command to create a node
export class CreateNodeCommand extends BaseCommand {
    private createdNode: NodeObject | null = null;

    constructor(
        context: ICommandContext,
        private readonly position: Point,
        private readonly radius: number = 5,
        private readonly isMovable: boolean = true
    ) {
        super(context);
    }

    async execute(): Promise<void> {
        this.createdNode = await this.context.commandService.createNode(
            this.position,
            this.radius,
            this.isMovable
        );
    }

    async undo(): Promise<void> {
        if (this.createdNode) {
            // Only delete the node if it has no connected walls
            if (this.createdNode.getConnectedWalls().length === 0) {
                await this.context.commandService.deleteNode(this.createdNode);
            }
            this.createdNode = null;
        }
    }

    // Method to get the created node (useful for chaining commands)
    getNode(): NodeObject | null {
        return this.createdNode;
    }
} 