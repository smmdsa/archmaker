# Core Plugin System

## Overview
The Core Plugin System provides a robust and extensible architecture for managing plugins in the application. It follows the principles of modularity, dependency injection, and event-driven architecture.

## Key Components

### Plugin Manager
The Plugin Manager is responsible for:
- Registering and unregistering plugins
- Managing plugin lifecycle (initialization, activation, deactivation)
- Handling plugin dependencies
- Managing plugin metadata and state

### Event Manager
The Event Manager provides:
- Event subscription and unsubscription
- Synchronous and asynchronous event emission
- Error handling for event listeners
- Plugin-specific event contexts

### Logger
The Logger system offers:
- Different log levels (debug, info, warn, error)
- Plugin context awareness
- Log history management
- Formatted console output

### Service Provider
The Service Provider enables:
- Service registration and discovery
- Dependency injection for plugins
- Type-safe service access

## Plugin Development

### Creating a Plugin
A plugin must implement the `IPlugin` interface:

```typescript
interface IPlugin {
    manifest: IPluginManifest;
    initialize(): Promise<void>;
    activate(): Promise<void>;
    deactivate(): Promise<void>;
    dispose(): Promise<void>;
}
```

### Plugin Manifest
Each plugin requires a manifest:

```typescript
interface IPluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    dependencies?: Record<string, string>;
    tools?: string[];
    commands?: string[];
    renderers?: string[];
}
```

### Plugin Lifecycle
1. Registration
2. Initialization
3. Activation
4. Deactivation
5. Disposal

### Example Plugin

```typescript
export class ExamplePlugin implements IPlugin {
    manifest: IPluginManifest = {
        id: 'example-plugin',
        name: 'Example Plugin',
        version: '1.0.0',
        description: 'An example plugin',
        author: 'Your Name'
    };

    async initialize(): Promise<void> {
        // Setup plugin resources
    }

    async activate(): Promise<void> {
        // Start plugin functionality
    }

    async deactivate(): Promise<void> {
        // Stop plugin functionality
    }

    async dispose(): Promise<void> {
        // Cleanup resources
    }
}
```

## Event System

### Publishing Events
```typescript
await eventManager.emit('example-event', { data: 'example' });
```

### Subscribing to Events
```typescript
eventManager.on('example-event', (data) => {
    // Handle event
});
```

## Error Handling
The system includes a robust error handling mechanism:

```typescript
try {
    await pluginManager.activatePlugin('example-plugin');
} catch (error) {
    if (error instanceof PluginError) {
        switch (error.code) {
            case PluginErrorCode.INITIALIZATION_FAILED:
                // Handle initialization error
                break;
            case PluginErrorCode.DEPENDENCY_NOT_FOUND:
                // Handle missing dependency
                break;
            // ...
        }
    }
}
```

## Best Practices

1. **Plugin Development**
   - Keep plugins focused and single-purpose
   - Handle cleanup properly in dispose()
   - Use type-safe interfaces
   - Document plugin requirements

2. **Event Handling**
   - Use typed event data
   - Handle async operations properly
   - Clean up event listeners

3. **Error Handling**
   - Use specific error types
   - Log errors appropriately
   - Provide meaningful error messages

4. **Configuration**
   - Use the configuration system for plugin settings
   - Validate configurations
   - Provide sensible defaults

## Testing
The system includes comprehensive test coverage:
- Unit tests for core components
- Integration tests for plugin lifecycle
- Mock implementations for testing

## Contributing
1. Follow the TypeScript coding standards
2. Include tests for new features
3. Update documentation
4. Use conventional commits 