# Window Tool Plugin

A plugin for placing and managing windows on walls in the architectural design system.

## Features

- Place windows on existing walls
- Move and adjust window positions
- Flip window orientation
- Automatic window alignment to walls
- Collision detection with other windows and doors
- Visual feedback during placement and movement
- Keyboard shortcuts for common operations

## Usage

1. Select the Window Tool (shortcut: 'N')
2. Click on a wall to place a window
3. Drag windows to move them along walls
4. Use 'F' key or right-click to flip window orientation

## Technical Details

### Components

- `WindowTool.ts`: Main tool implementation
- `WindowObject.ts`: Window object representation
- `WindowStore.ts`: Window state management
- `types/window.ts`: Type definitions

### Events

| Event | Description | Payload |
|-------|-------------|---------|
| window:created | Window is created | { window: WindowData } |
| window:updated | Window properties updated | { windowId: string, properties: WindowProperties } |
| window:deleted | Window is deleted | { windowId: string } |
| window:moved | Window position changed | { windowId: string, newPosition: Point } |
| window:flipped | Window orientation flipped | { windowId: string } |

### Properties

```typescript
interface WindowProperties {
    color: string;
    width: number;
    height: number;
    isOpen: boolean;
    openDirection: 'left' | 'right';
    label?: string;
}
```

### Validation Rules

- Windows must be placed on valid walls
- Windows cannot overlap with other windows or doors
- Windows must maintain minimum distance from wall ends
- Windows cannot exceed wall length

## Integration

The Window Tool integrates with:
- Wall Tool for wall interactions
- Door Tool for collision detection
- Canvas Store for rendering
- Selection system for object manipulation

## Development

### Setup
1. Install dependencies
2. Import required modules
3. Register the tool plugin

### Best Practices
- Follow TypeScript strict mode
- Maintain clean code principles
- Add appropriate logging
- Handle errors gracefully
- Test all functionality

### Testing
- Unit tests for core functionality
- Integration tests with wall system
- Validation tests
- Event handling tests 