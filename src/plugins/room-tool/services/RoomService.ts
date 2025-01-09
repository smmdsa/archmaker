import { v4 as uuidv4 } from 'uuid';
import { Point } from '../../../store/ProjectStore';
import { IRoom } from '../interfaces/IRoom';
import { WallService } from '../../wall-tool/services/WallService';
import { EventBus } from '../../../core/events/EventBus';

export class RoomService {
    private static instance: RoomService;
    private rooms: Map<string, IRoom> = new Map();
    private wallService: WallService;
    private eventBus: EventBus;

    private constructor() {
        this.wallService = WallService.getInstance();
        this.eventBus = EventBus.getInstance();
    }

    static getInstance(): RoomService {
        if (!RoomService.instance) {
            RoomService.instance = new RoomService();
        }
        return RoomService.instance;
    }

    async createRoom(startPoint: Point, width: number, height: number, properties: any): Promise<IRoom> {
        const id = uuidv4();
        
        // Calcular los puntos de las esquinas
        const corners = this.calculateCorners(startPoint, width, height);
        
        // Crear las paredes usando WallService
        const walls = await Promise.all([
            // Pared inferior
            this.wallService.createWall({
                startPoint: corners[0],
                endPoint: corners[1],
                thickness: properties.wallThickness,
                height: properties.wallHeight
            }),
            // Pared derecha
            this.wallService.createWall({
                startPoint: corners[1],
                endPoint: corners[2],
                thickness: properties.wallThickness,
                height: properties.wallHeight
            }),
            // Pared superior
            this.wallService.createWall({
                startPoint: corners[2],
                endPoint: corners[3],
                thickness: properties.wallThickness,
                height: properties.wallHeight
            }),
            // Pared izquierda
            this.wallService.createWall({
                startPoint: corners[3],
                endPoint: corners[0],
                thickness: properties.wallThickness,
                height: properties.wallHeight
            })
        ]);

        const room: IRoom = {
            id,
            walls,
            startPoint,
            width,
            height,
            properties
        };

        this.rooms.set(id, room);
        this.eventBus.emit('room:created', room);
        
        return room;
    }

    getRoom(id: string): IRoom | undefined {
        return this.rooms.get(id);
    }

    getAllRooms(): IRoom[] {
        return Array.from(this.rooms.values());
    }

    async deleteRoom(id: string): Promise<void> {
        const room = this.rooms.get(id);
        if (room) {
            // Eliminar todas las paredes asociadas
            await Promise.all(room.walls.map(wall => this.wallService.deleteWall(wall.id)));
            this.rooms.delete(id);
            this.eventBus.emit('room:deleted', id);
        }
    }

    private calculateCorners(startPoint: Point, width: number, height: number): Point[] {
        return [
            startPoint, // Esquina inferior izquierda
            { x: startPoint.x + width, y: startPoint.y }, // Esquina inferior derecha
            { x: startPoint.x + width, y: startPoint.y + height }, // Esquina superior derecha
            { x: startPoint.x, y: startPoint.y + height } // Esquina superior izquierda
        ];
    }

    // Método para obtener puntos de snap (esquinas de todas las habitaciones)
    getSnapPoints(): Point[] {
        const snapPoints: Point[] = [];
        this.rooms.forEach(room => {
            const corners = this.calculateCorners(room.startPoint, room.width, room.height);
            snapPoints.push(...corners);
        });
        return snapPoints;
    }
} 