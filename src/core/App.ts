import { LoggerImpl as Logger, EventManagerImpl as EventManager, ConfigManagerImpl as ConfigManager } from './managers';
import { pluginRegistry, PluginRegistry } from './plugins/registry';
import { Canvas2D } from '../components/scenes/Canvas2D';
import { ToolService } from './tools/services/ToolService';

export class App {
    private readonly eventManager: EventManager;
    private readonly logger: Logger;
    private readonly configManager: ConfigManager;
    private readonly toolService: ToolService;
    private canvas: Canvas2D | null = null;

    constructor() {
        this.logger = new Logger();
        this.eventManager = new EventManager(this.logger);
        this.configManager = new ConfigManager(this.logger);
        this.toolService = new ToolService(this.eventManager, this.logger);
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

    getToolService(): ToolService {
        return this.toolService;
    }

    getCanvas(): Canvas2D | null {
        return this.canvas;
    }
} 