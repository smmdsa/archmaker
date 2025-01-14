
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

## Development & Contributing
- Follow TypeScript coding standards and strict mode.
- Include tests for new features and update documentation.
- Use conventional commits for clarity.

## License
This project is licensed under the MIT License.

---
