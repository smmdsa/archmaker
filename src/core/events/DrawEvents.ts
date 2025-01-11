import { IDrawableMetadata } from '../interfaces/IDrawable';

export enum DrawEventType {
    CREATE = 'draw:create',
    UPDATE = 'draw:update',
    DELETE = 'draw:delete'
}

export interface DrawEvent {
    type: DrawEventType;
    objectType: string;  // 'wall', 'room', etc.
    metadata: IDrawableMetadata;
    id: string;
}

export interface CreateDrawEvent extends DrawEvent {
    type: DrawEventType.CREATE;
}

export interface UpdateDrawEvent extends DrawEvent {
    type: DrawEventType.UPDATE;
}

export interface DeleteDrawEvent extends DrawEvent {
    type: DrawEventType.DELETE;
} 