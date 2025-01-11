import { IDrawable, IDrawableMetadata } from '../interfaces/IDrawable';
import { DrawEvent, DrawEventType } from '../events/DrawEvents';
import { IEventManager } from '../interfaces/IEventManager';
import { ILogger } from '../interfaces/ILogger';

export class DrawingManager {
    private drawableObjects: Map<string, IDrawable> = new Map();
    private drawableFactories: Map<string, (metadata: IDrawableMetadata) => IDrawable> = new Map();

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.eventManager.on<DrawEvent>('draw:event', (event) => {
            this.logger.info('Received draw event:', {
                type: event.type,
                objectType: event.objectType,
                id: event.id
            });

            switch (event.type) {
                case DrawEventType.CREATE:
                    this.createDrawable(event.objectType, event.metadata, event.id);
                    break;
                case DrawEventType.UPDATE:
                    this.updateDrawable(event.id, event.metadata);
                    break;
                case DrawEventType.DELETE:
                    this.deleteDrawable(event.id);
                    break;
            }
        });

        this.eventManager.on('drawing:register-factory', (event: { type: string, factory: (metadata: IDrawableMetadata) => IDrawable }) => {
            this.logger.info('Registering factory:', event);
            this.registerDrawableFactory(event.type, event.factory);
        });
    }

    registerDrawableFactory(type: string, factory: (metadata: IDrawableMetadata) => IDrawable): void {
        this.logger.info(`Registering factory for type: ${type}`);
        this.drawableFactories.set(type, factory);
        this.logger.info('Available factories:', Array.from(this.drawableFactories.keys()));
    }

    private createDrawable(type: string, metadata: IDrawableMetadata, id: string): void {
        this.logger.info('Creating drawable:', { type, id, metadata });
        
        const factory = this.drawableFactories.get(type);
        if (!factory) {
            this.logger.error(`No factory registered for drawable type: ${type}`);
            this.logger.info('Available factories:', Array.from(this.drawableFactories.keys()));
            return;
        }

        try {
            const drawable = factory(metadata);
            this.drawableObjects.set(id, drawable);
            this.logger.info(`Created drawable object: ${id} of type ${type}`);
        } catch (error) {
            this.logger.error(`Error creating drawable object of type ${type}:`, error as Error);
        }
    }

    private updateDrawable(id: string, metadata: IDrawableMetadata): void {
        const drawable = this.drawableObjects.get(id);
        if (drawable) {
            drawable.update(metadata);
            this.logger.info(`Updated drawable object: ${id}`);
        } else {
            this.logger.warn(`Drawable object not found for update: ${id}`);
        }
    }

    private deleteDrawable(id: string): void {
        const drawable = this.drawableObjects.get(id);
        if (drawable) {
            drawable.destroy();
            this.drawableObjects.delete(id);
            this.logger.info(`Deleted drawable object: ${id}`);
        } else {
            this.logger.warn(`Drawable object not found for deletion: ${id}`);
        }
    }

    getDrawable(id: string): IDrawable | undefined {
        const drawable = this.drawableObjects.get(id);
        if (!drawable) {
            this.logger.warn(`Drawable object not found: ${id}`);
            this.logger.info('Available drawables:', Array.from(this.drawableObjects.keys()));
        }
        return drawable;
    }

    getAllDrawables(): IDrawable[] {
        return Array.from(this.drawableObjects.values());
    }

    getRegisteredFactoryTypes(): string[] {
        return Array.from(this.drawableFactories.keys());
    }
} 