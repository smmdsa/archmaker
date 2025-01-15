import { EventManager } from './events/EventManager';
import { Logger } from './logging/Logger';
import { ConfigManager } from './config/ConfigManager';
import { pluginRegistry, PluginRegistry } from './plugins/registry';
import { DrawingManager } from './drawing/DrawingManager';
import { Canvas2D } from '../components/Canvas2D';
import { ProjectStore } from '../store/ProjectStore';
import { ToolService } from './tools/services/ToolService';

export class App {
    private readonly eventManager: EventManager;
    private readonly logger: Logger;
    private readonly configManager: ConfigManager;
    
    private readonly drawingManager: DrawingManager;
    private readonly store: ProjectStore;
    private readonly toolService: ToolService;
    private canvas: Canvas2D | null = null;

    constructor() {
        this.eventManager = new EventManager();
        this.logger = new Logger();
        this.configManager = new ConfigManager();
        this.store = new ProjectStore();
        this.toolService = new ToolService(this.eventManager, this.logger);
        this.drawingManager = new DrawingManager(this.eventManager, this.logger);

        // Configurar el sistema de eventos para el registro de fábricas
        this.eventManager.on('drawing:register-factory', ({ type, factory }) => {
            this.drawingManager.registerDrawableFactory(type, factory);
        });
    }

    async initialize(): Promise<void> {
        this.logger.info('Initializing application...');
        
        try {
            await this.configManager.initialize();
            
            
            this.logger.info('Application initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize application:', error as Error);
            throw error;
        }
    }

    initializeCanvas(containerId: string): void {
        if (this.canvas) {
            this.canvas.dispose();
        }

        this.canvas = new Canvas2D(
            containerId,
            this.eventManager,
            this.logger
        );
    }

    getEventManager(): EventManager {
        return this.eventManager;
    }

    getLogger(): Logger {
        return this.logger;
    }

    getConfigManager(): ConfigManager {
        return this.configManager;
    }

    getPluginRegistry(): PluginRegistry {
        return pluginRegistry;
    }

    getDrawingManager(): DrawingManager {
        return this.drawingManager;
    }

    getStore(): ProjectStore {
        return this.store;
    }

    getToolService(): ToolService {
        return this.toolService;
    }

    getCanvas(): Canvas2D | null {
        return this.canvas;
    }
} 