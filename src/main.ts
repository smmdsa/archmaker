import './styles/style.css';
import './styles/toolbar.css';
import { LoggerImpl, EventManagerImpl, ConfigManagerImpl } from './core/managers';
import { ToolService } from './core/tools/services/ToolService';
import { UIRegionManager } from './core/ui/UIRegionManager';
import { PluginManager } from './core/managers/PluginManager';
import { BaseTool } from './core/tools/BaseTool';
import { pluginRegistry } from './core/plugins/registry';
import { TopbarService } from './core/topbar/services/TopbarService';
import { Topbar } from './components/Topbar';
import { ProjectStore } from './store/ProjectStore';
import { Canvas2D } from './components/Canvas2D';
import { StoreService } from './store/StoreService';
import { DrawingManager } from './core/drawing/DrawingManager';
import { Viewer3D } from './scenes/Viewer3D';

// Importar plugins (solo para registro)
// Herramientas
import { WallTool } from './plugins/wall-tool/WallTool';
import { RoomTool } from './plugins/room-tool/RoomTool';
import { SelectTool } from './plugins/select-tool/SelectTool';
import { MoveTool } from './plugins/move-tool/MoveTool';
import { RemoveTool } from './plugins/remove-tool/RemoveTool';
import { DoorTool } from './plugins/door-tool/DoorTool';
import { WindowTool } from './plugins/window-tool/WindowTool';

// Servicios y UI
import { StoragePlugin } from './plugins/storage';

// Verificar que los plugins se hayan importado
console.info('Plugins loaded:', {
    WallTool,
    RoomTool,
    SelectTool,
    MoveTool,
    RemoveTool,
    DoorTool,
    WindowTool,
    StoragePlugin
});

async function initializeApp() {
    try {
        // Crear layout principal
        const app = document.createElement('div');
        app.id = 'app';
        document.body.appendChild(app);

        // Crear barra superior
        const topbar = document.createElement('div');
        topbar.id = 'topbar';
        app.appendChild(topbar);

        // Crear contenedor principal
        const mainContent = document.createElement('div');
        mainContent.id = 'main-content';
        app.appendChild(mainContent);

        // Crear contenedor de la barra de herramientas
        const toolbar = document.createElement('div');
        toolbar.id = 'toolbar';
        mainContent.appendChild(toolbar);

        // Crear contenedor del editor y visor 3D
        const editorContainer = document.createElement('div');
        editorContainer.id = 'editor-container';
        mainContent.appendChild(editorContainer);

        // Crear contenedor del editor 2D
        const editor = document.createElement('div');
        editor.id = 'editor';
        editorContainer.appendChild(editor);

        // Crear contenedor del visor 3D
        const viewer3D = document.createElement('div');
        viewer3D.id = 'viewer-3d';
        editorContainer.appendChild(viewer3D);

        // Crear contenedor del panel de propiedades
        const propertiesPanel = document.createElement('div');
        propertiesPanel.id = 'properties-panel';
        mainContent.appendChild(propertiesPanel);

        // Inicializar servicios core
        console.info('Initializing core services...');
        
        const logger = new LoggerImpl();
        logger.info('Logger initialized');
        
        const eventManager = new EventManagerImpl(logger);
        logger.info('Event Manager initialized');
        
        const configManager = new ConfigManagerImpl(logger);
        await configManager.initialize();
        logger.info('Config Manager initialized');

        // Initialize store
        logger.info('Initializing store services...');
        const storeService = new StoreService();
        await storeService.initialize();
        storeService.setDependencies(eventManager, logger);
        const projectStore = new ProjectStore(eventManager, logger, configManager);
        logger.info('Store services initialized');

        // Inicializar managers
        logger.info('Initializing managers...');
        const uiManager = new UIRegionManager(logger, eventManager);
        const pluginManager = new PluginManager(logger, eventManager, uiManager);
        const toolService = new ToolService(eventManager, logger);
        const topbarService = new TopbarService(eventManager, logger, configManager);
        const drawingManager = new DrawingManager(eventManager, logger);
        logger.info('Drawing Manager initialized');

        // Inicializar servicios en orden
        logger.info('Starting service initialization sequence...');
        await uiManager.initialize();
        logger.info('UI Manager initialized');
        await toolService.initialize();
        logger.info('Tool Service initialized');
        await pluginManager.initialize();
        logger.info('Plugin Manager initialized');

        // Registrar listeners para eventos de plugins
        eventManager.on('plugin:registered', (event) => {
            logger.info('Plugin registered:', event);
        });

        eventManager.on('tool:registered', (event) => {
            logger.info('Tool registered:', event);
        });

        // Verificar plugins registrados antes de crearlos
        logger.info('Plugins registered in registry:', pluginRegistry.getAllPlugins().map(p => ({
            id: p.metadata.id,
            type: p.metadata.type
        })));

        // Crear y registrar plugins
        logger.info('Creating plugins from registry...');
        const plugins = pluginRegistry.createPlugins(eventManager, logger, configManager, projectStore);
        logger.info(`Created ${plugins.length} plugins`);
        
        for (const plugin of plugins) {
            logger.info(`Registering plugin: ${plugin.manifest.id}`, {
                type: plugin.manifest.type,
                name: plugin.manifest.name,
                version: plugin.manifest.version
            });
            
            await pluginManager.registerPlugin(plugin);
            
            if (plugin instanceof BaseTool) {
                logger.info(`Registering tool: ${plugin.manifest.id}`);
                toolService.registerPlugin(plugin);
            }
        }

        // Inicializar componente Topbar
        logger.info('Initializing Topbar component...');
        new Topbar('topbar', topbarService, eventManager, logger);
        logger.info('Topbar component initialized');

        // Initialize Canvas2D
        logger.info('Initializing Canvas2D component...');
        new Canvas2D('editor', eventManager, logger);
        logger.info('Canvas2D component initialized');

        // Initialize Viewer3D
        logger.info('Initializing Viewer3D component...');
        const viewer3dContainer = document.getElementById('viewer-3d');
        if (!viewer3dContainer) {
            throw new Error('Viewer3D container not found');
        }
        new Viewer3D(viewer3dContainer, storeService.getCanvasStore(), eventManager);
        logger.info('Viewer3D component initialized');

        logger.info('Application initialized successfully');
        
        // Log final status
        const registeredPlugins = plugins.length;
        const registeredTools = plugins.filter(p => p instanceof BaseTool).length;
        logger.info('Final initialization status:', {
            totalPlugins: registeredPlugins,
            tools: registeredTools,
            services: registeredPlugins - registeredTools
        });
        
    } catch (error) {
        const logger = new LoggerImpl();
        logger.error('Failed to initialize application:', error as Error);
        throw error;
    }
}

// Iniciar la aplicación
initializeApp().catch(error => {
    const logger = new LoggerImpl();
    logger.error('Application initialization failed:', error as Error);
});
