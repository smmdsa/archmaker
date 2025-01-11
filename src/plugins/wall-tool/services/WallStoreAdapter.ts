import { IWall, WallProperties } from '../interfaces/IWall';

export class WallStoreAdapter {
    toStore(wall: IWall): IWall {
        return {
            id: wall.id,
            startPoint: wall.startPoint,
            endPoint: wall.endPoint,
            thickness: wall.thickness,
            height: wall.height,
            properties: {
                material: wall.properties.material || 'default',
                color: wall.properties.color || '#cccccc'
            }
        };
    }

    fromStore(wall: IWall): IWall {
        return {
            id: wall.id,
            startPoint: wall.startPoint,
            endPoint: wall.endPoint,
            thickness: wall.thickness,
            height: wall.height,
            properties: {
                material: wall.properties.material || 'default',
                color: wall.properties.color || '#cccccc'
            }
        };
    }

    updateToStore(updates: Partial<IWall>): Partial<IWall> {
        const result: Partial<IWall> = {};
        
        if (updates.startPoint) result.startPoint = updates.startPoint;
        if (updates.endPoint) result.endPoint = updates.endPoint;
        if (updates.height) result.height = updates.height;
        if (updates.thickness) result.thickness = updates.thickness;
        if (updates.properties) result.properties = updates.properties;

        return result;
    }
} 