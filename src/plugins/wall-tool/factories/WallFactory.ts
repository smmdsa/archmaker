import { IDrawableMetadata } from '../../../core/interfaces/IDrawable';
import { WallDrawable } from '../drawables/WallDrawable';
import { Point } from '../../../core/types/geometry';

export class WallFactory {
    static createWall(metadata: IDrawableMetadata, onGizmoMove?: (id: string, point: Point, isStart: boolean) => void): WallDrawable {
        console.info('Creating wall with metadata:', metadata);
        
        if (metadata.type !== 'wall') {
            console.error('Invalid metadata type:', metadata.type);
            throw new Error('Invalid metadata type for wall creation');
        }

        // Validar que los campos requeridos estén presentes
        if (!metadata.startPoint || !metadata.endPoint || !metadata.thickness || !metadata.height) {
            console.error('Missing required fields in metadata:', metadata);
            throw new Error('Missing required fields in wall metadata');
        }

        const wall = new WallDrawable(metadata as any, onGizmoMove);
        console.info('Created wall:', {
            id: wall.id,
            type: wall.type,
            metadata: wall.metadata
        });
        
        return wall;
    }
} 