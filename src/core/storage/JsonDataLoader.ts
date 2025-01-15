import { IDataLoader } from '../interfaces/IStorageService';
import { ProjectData } from './interfaces';

export class JsonDataLoader implements IDataLoader {
    load(data: string): ProjectData {
        try {
            const parsed = JSON.parse(data);
            
            // Validate basic structure
            if (!parsed || typeof parsed !== 'object') {
                throw new Error('Invalid project data format');
            }

            // Check for required metadata
            if (!parsed.metadata || !parsed.metadata.id) {
                throw new Error('Project data must contain metadata with id');
            }

            // Handle both old and new formats
            if (parsed.canvas && !parsed.scene) {
                // Old format - convert canvas to scene
                return {
                    metadata: parsed.metadata,
                    settings: parsed.settings || {
                        units: 'cm',
                        gridSize: 20,
                        snapToGrid: true,
                        defaultWallHeight: 280,
                        defaultWallThickness: 10
                    },
                    scene: {
                        walls: (parsed.canvas.walls || []).map((wall: any) => ({
                            id: wall.id,
                            startPoint: wall.startPoint || { x: 0, y: 0 },
                            endPoint: wall.endPoint || { x: 0, y: 0 },
                            height: wall.height || 280,
                            thickness: wall.thickness || 10
                        })),
                        doors: (parsed.canvas.doors || []).map((door: any) => ({
                            id: door.id,
                            wallId: door.wallId,
                            position: door.position || { x: 0, y: 0 },
                            angle: door.angle || 0,
                            properties: {
                                width: door.width || 100,
                                height: door.height || 200,
                                isFlipped: door.isFlipped || false
                            }
                        })),
                        windows: (parsed.canvas.windows || []).map((window: any) => ({
                            id: window.id,
                            wallId: window.wallId,
                            position: window.position || { x: 0, y: 0 },
                            angle: window.angle || 0,
                            properties: {
                                width: window.width || 100,
                                height: window.height || 150,
                                sillHeight: window.sillHeight || 100
                            }
                        })),
                        rooms: (parsed.canvas.rooms || []).map((room: any) => ({
                            id: room.id,
                            name: room.name || 'Room',
                            area: room.area || 0,
                            wallIds: room.wallIds || []
                        }))
                    },
                    viewer: {
                        camera: {
                            position: { x: 500, y: 500, z: 500 },
                            target: { x: 0, y: 0, z: 0 },
                            zoom: 1
                        },
                        showGrid: true,
                        showAxes: true,
                        showGround: true
                    }
                };
            }

            // New format - validate scene data
            if (!parsed.scene) {
                parsed.scene = {
                    walls: [],
                    doors: [],
                    windows: [],
                    rooms: []
                };
            }

            // Ensure viewer settings exist
            if (!parsed.viewer) {
                parsed.viewer = {
                    camera: {
                        position: { x: 500, y: 500, z: 500 },
                        target: { x: 0, y: 0, z: 0 },
                        zoom: 1
                    },
                    showGrid: true,
                    showAxes: true,
                    showGround: true
                };
            }

            // Ensure settings exist
            if (!parsed.settings) {
                parsed.settings = {
                    units: 'cm',
                    gridSize: 20,
                    snapToGrid: true,
                    defaultWallHeight: 280,
                    defaultWallThickness: 10
                };
            }

            return parsed as ProjectData;
        } catch (error) {
            throw new Error(`Failed to parse JSON project data: ${(error as Error).message}`);
        }
    }

    validate(data: string): boolean {
        try {
            const parsed = JSON.parse(data);
            return (
                parsed &&
                typeof parsed === 'object' &&
                parsed.metadata &&
                parsed.metadata.id &&
                (parsed.canvas || parsed.scene) // Accept both old and new formats
            );
        } catch {
            return false;
        }
    }
} 