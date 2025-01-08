import './styles/style.css';
import { Canvas2D } from './components/Canvas2D';
import { Toolbar, ToolType } from './components/Toolbar';
import { ProjectStore } from './store/ProjectStore';
import { Viewer3D } from './scenes/Viewer3D';
import { PropertiesPanel, WallProperties } from './components/PropertiesPanel';

// Create main layout
const app = document.createElement('div');
app.id = 'app';
document.body.appendChild(app);

// Create main content container
const mainContent = document.createElement('div');
mainContent.id = 'main-content';
app.appendChild(mainContent);

// Create toolbar container
const toolbarContainer = document.createElement('div');
toolbarContainer.id = 'toolbar';
mainContent.appendChild(toolbarContainer);

// Create editor container
const editorContainer = document.createElement('div');
editorContainer.id = 'editor';
mainContent.appendChild(editorContainer);

// Create viewer container first
const viewerContainer = document.createElement('div');
viewerContainer.id = 'viewer';
mainContent.appendChild(viewerContainer);

// Create properties panel container and add it to viewer
const propertiesContainer = document.createElement('div');
propertiesContainer.id = 'properties-panel';
viewerContainer.appendChild(propertiesContainer);

// Initialize store
const store = new ProjectStore();

// Initialize components
const canvas2D = new Canvas2D('editor', store);

// Initialize toolbar with callback
const toolbar = new Toolbar('toolbar', (tool: ToolType) => {
    console.log('Selected tool:', tool);
    canvas2D.setTool(tool);
    editorContainer.setAttribute('data-tool', tool);
    propertiesPanel.updateForTool(tool);
});

// Initialize properties panel AFTER containers are added to DOM
const propertiesPanel = new PropertiesPanel('properties-panel', (props: WallProperties) => {
    canvas2D.updateWallProperties(props);
});

// Initialize 3D viewer after 2D canvas
const viewer3D = new Viewer3D('viewer', store);

// Set initial tool to wall
toolbar.selectTool(ToolType.MOVE);

// Add debug overlay
const debugOverlay = document.createElement('div');
debugOverlay.className = 'debug-overlay';
document.body.appendChild(debugOverlay);

// Debug event handling
editorContainer.addEventListener('mousedown', (e) => {
    debugOverlay.textContent = `Mouse down at: ${e.clientX}, ${e.clientY}`;
});

editorContainer.addEventListener('mousemove', (e) => {
    if (e.buttons === 1) { // Left mouse button is pressed
        debugOverlay.textContent = `Drawing at: ${e.clientX}, ${e.clientY}`;
    }
});
