import './style.css';
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
toolbar.selectTool(ToolType.WALL);

// Add styles
const style = document.createElement('style');
style.textContent = `
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    #app {
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: #f5f5f5;
    }

    #main-content {
        flex: 1;
        display: flex;
        overflow: hidden;
        gap: 1px;
        background: #ccc;
        height: calc(100vh - 1px);
    }

    #toolbar {
        width: 60px;
        background: #ffffff;
        padding: 10px;
        border-right: 1px solid #ccc;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 2px 0 5px rgba(0,0,0,0.1);
    }

    #editor {
        flex: 1;
        overflow: hidden;
        position: relative;
        min-width: 0;
        background: #ffffff;
        display: flex;
        flex-direction: column;
    }

    #viewer {
        flex: 1;
        overflow: hidden;
        position: relative;
        min-width: 0;
        background: #f0f0f0;
    }

    #properties-panel {
        position: absolute;
        top: 20px;
        left: 20px;
        z-index: 100;
        min-width: 200px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .konvajs-content {
        position: absolute !important;
        top: 0;
        left: 0;
        width: 100% !important;
        height: 100% !important;
    }

    .konvajs-content canvas {
        width: 100% !important;
        height: 100% !important;
    }

    /* Cursor styles */
    #editor[data-tool="wall"] {
        cursor: crosshair;
    }
    #editor[data-tool="select"] {
        cursor: pointer;
    }
    #editor[data-tool="move"] {
        cursor: move;
    }

    /* Debug overlay */
    .debug-overlay {
        position: fixed;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
    }
`;
document.head.appendChild(style);

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
