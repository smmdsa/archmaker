import './styles/style.css';
import './styles/toolbar.css';
import { Canvas2D } from './components/Canvas2D';
import { ProjectStore } from './store/ProjectStore';
import { StoreService } from './store/StoreService';
import { Viewer3D } from './scenes/Viewer3D';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ToolService } from './core/tools/services/ToolService';
import { SelectTool } from './plugins/select-tool/SelectTool';
import { MoveTool } from './plugins/move-tool/MoveTool';
import { WallTool } from './plugins/wall-tool/WallTool';
import { WallService } from './plugins/wall-tool/services/WallService';
import { Toolbar } from './components/Toolbar';
import { RoomTool } from './plugins/room-tool/RoomTool';

// Crear layout principal
const app = document.createElement('div');
app.id = 'app';
document.body.appendChild(app);

// Crear contenedor principal
const mainContent = document.createElement('div');
mainContent.id = 'main-content';
app.appendChild(mainContent);

// Crear contenedor de la barra de herramientas
const toolbarContainer = document.createElement('div');
toolbarContainer.id = 'toolbar';
mainContent.appendChild(toolbarContainer);

// Crear contenedor del editor
const editorContainer = document.createElement('div');
editorContainer.id = 'editor';
mainContent.appendChild(editorContainer);

// Crear contenedor del panel de propiedades
const propertiesPanelContainer = document.createElement('div');
propertiesPanelContainer.id = 'properties-panel';
mainContent.appendChild(propertiesPanelContainer);

// Crear contenedor del visor 3D
const viewer3DContainer = document.createElement('div');
viewer3DContainer.id = 'viewer';
mainContent.appendChild(viewer3DContainer);

// Inicializar servicios
const storeService = new StoreService();
await storeService.initialize();
const store = new ProjectStore(storeService);
const toolService = ToolService.getInstance();

// Crear e inicializar herramientas
const selectTool = new SelectTool();
const moveTool = new MoveTool();
const wallTool = new WallTool();
const roomTool = new RoomTool();

// Inicializar herramientas (esto las registrará automáticamente)
selectTool.initialize();
moveTool.initialize();
wallTool.initialize();
roomTool.initialize();

// Inicializar componentes
const canvas2D = new Canvas2D('editor', store);
const propertiesPanel = new PropertiesPanel('properties-panel', (props) => {
    // Las propiedades actualizadas se manejarán a través del sistema de eventos
    console.log('Wall properties updated:', props);
});
const viewer3D = new Viewer3D('viewer', store);
const toolbar = new Toolbar('toolbar');

// Activar herramienta inicial
toolService.activateTool(selectTool.id);

// Agregar overlay de debug
const debugOverlay = document.createElement('div');
debugOverlay.className = 'debug-overlay';
document.body.appendChild(debugOverlay);

// Manejar eventos de debug
editorContainer.addEventListener('mousedown', (e) => {
    debugOverlay.textContent = `Mouse down at: ${e.clientX}, ${e.clientY}`;
});

editorContainer.addEventListener('mousemove', (e) => {
    if (e.buttons === 1) { // Left mouse button is pressed
        debugOverlay.textContent = `Drawing at: ${e.clientX}, ${e.clientY}`;
    }
});

// Cleanup al cerrar
window.addEventListener('beforeunload', () => {
    selectTool.dispose();
    moveTool.dispose();
    wallTool.dispose();
    roomTool.dispose();
    canvas2D.dispose();
    propertiesPanel.dispose();
    viewer3D.dispose();
    toolbar.dispose();
});
