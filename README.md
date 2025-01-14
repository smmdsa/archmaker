
# ArchMaker

## Overview
ArchMaker is a versatile application designed for creating and managing architectural designs. It leverages a plugin-based system to offer extensibility, allowing users to add custom functionalities.

## Core Plugin System
The core plugin system provides a robust architecture for managing plugins, following principles of modularity and dependency injection. Key components include:
- **Plugin Manager**: Manages plugin lifecycle, dependencies, and metadata.
- **Event Manager**: Handles event subscription, emission, and error handling.
- **Logger**: Provides logging with different levels and context awareness.
- **Service Provider**: Enables service registration and type-safe access.

## Storage System
The storage system handles serialization and deserialization of project objects, with a focus on type safety. Core components include:
- **Storage Interfaces**: Define structures for project data.
- **Data Writers/Loaders**: Support JSON and YAML formats.
- **Integration Points**: Manage serialization through central stores.

## Plugin Example
--
## Room Tool Plugin
A plugin for creating and editing rectangular rooms. Features include:
- Drawing rooms with configurable properties like height and wall thickness.
- Event-driven system for room creation, updates, and deletion.
- API for room properties and management.

## Installation
1. Register the plugin in `PluginManager`.
2. Configure settings (optional).

## Usage
- Activate the tool via toolbar or 'R' key.
- Click to start and drag to define room dimensions.

--

## High-Level Overview

This application is a modular and extensible floor plan (and possibly broader architectural) editor called “ArchMaker.” It’s built in TypeScript, using an event-driven architecture to manage various core services (like plugins, drawing, configuration, and UI regions).

Key characteristics of the project:

1. **Plugins & Modules**  
   - The codebase is structured around a core plugin system and multiple service managers.  
   - Each plugin can register tools, UI components, or enhanced functionalities in a decoupled manner.  
   - A Plugin Manager handles plugin initialization, life cycle, dependencies, and event integration.

2. **Event-Driven Architecture**  
   - The app has a robust event system (e.g., EventBus, EventEmitter) that decouples modules.  
   - Plugins and core modules communicate via emitting and subscribing to events.  
   - Drawing actions, tool activations, and UI updates all rely heavily on these events.

3. **Canvas & Drawing Layers**  
   - Utilizes Konva (Canvas2D library) for rendering architectural elements in the 2D canvas.  
   - A layered approach (main layer, temp layer, grid layer) allows organized drawing and interactivity.  
   - The DrawingManager coordinates IDrawable objects, factories, and implements CREATE/UPDATE/DELETE logic.

4. **Tools & Services**  
   - A central ToolService manages selectable tools (e.g., window tool, wall tool, room tool).  
   - Tools handle user interactions (mouse down/move/up, keyboard, etc.) by receiving “context” objects with canvas position and scale.  
   - Other services (e.g., TopbarService, StoreService, ConfigManager) each focus on a separate concern but also hook into the EventManager.

5. **UI Components**  
   - Independent UI modules such as Toolbar, Topbar, PropertiesPanel, and custom Canvas classes.  
   - Each component (e.g., Toolbar) listens to tool or plugin events to dynamically update the UI (e.g. active tool).  
   - The PropertiesPanel listens to events about the currently active tool or object selection, then displays relevant properties.

6. **Project/Store**  
   - The “ProjectStore” or “CanvasStore” manages architectural objects and app state (e.g., walls, rooms, selected elements).  
   - “DrawingManager” references the store’s data for rendering.  
   - Storage functionality is abstracted behind interfaces (IStorageService) for saving/loading projects.

7. **Testing & Coverage**  
   - There are Jest-based unit tests for UI components (e.g., Toolbar.test.ts), verifying activation, updates, and tool switching.  
   - Coverage reports exist in coverage/lcov-report, reflecting lines, functions, and branches tested.

## Architecture Summary

1. **Core Layer**  
   - Contains abstractions (interfaces, event classes, plugin registry, config management).  
   - Couples with the “App” class to bootstrap and connect high-level modules.

2. **UI Layer**  
   - Multiple UI components (Canvas2D, PropertiesPanel, Toolbar, Topbar, etc.) each in “src/components/.”  
   - These components build HTML structures, attach event listeners, and integrate with services or managers.

3. **Services & Managers**  
   - Examples: DrawingManager, ToolService, TopbarService.  
   - Register with the EventManager, handle specialized logic like drawing or tool states, and dispatch events to update the UI.

4. **Plugins**  
   - Each plugin has a manifest (id, name, version, type, etc.) and an initialization entry point.  
   - The PluginManager dynamically loads or unloads these plugins, bridging them to the event system.

5. **Event Flow**  
   - The application fires events on user actions (e.g., mouse events on Canvas2D), which are listened to by relevant managers or tools.  
   - Tools or managers further emit “update” events when something changes, so UI can react accordingly.

## Key Areas of Focus

1. **Plugin System**  
   - The plugin architecture is critical for extending the application. Pay special attention to the PluginManager, the IPlugin interface, and how they register themselves with the rest of the system.

2. **Canvas & Drawing**  
   - Canvas2D (Konva integration) is a key part of user interaction. The DrawingManager, IDrawable, and the event-driven drawing logic are central to the actual editing features.

3. **Tool Service & Event Flow**  
   - Tools rely on the ToolService and event subscriptions to handle mouse movements, keyboard input, and to maintain a consistent state (e.g., active tool, selected tool).  

4. **UI Components**  
   - The Toolbar, Topbar, and PropertiesPanel harness events to display and update dynamic content. Understanding how they connect to tools, events, and managers is essential for UI customization.

5. **Configuration & Store**  
   - The ConfigManager handles plugin settings, user preferences, or other persistent configurations. The ProjectStore (and similarly the CanvasStore) manage domain data, ensuring consistent application state.

Overall, this system aims to be scalable, plugin-friendly, and performance-optimized for architectural asset editing. It uses a layered approach with event-driven interactions, giving each module clear separation of concerns.

## Development & Contributing
- Follow TypeScript coding standards and strict mode.
- Include tests for new features and update documentation.
- Use conventional commits for clarity.

## License
This project is licensed under the MIT License.

---
