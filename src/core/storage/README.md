# Storage System Architecture

The storage system is designed to handle serialization and deserialization of all objects in the application, with a focus on extensibility and type safety.

## Core Components

### 1. Storage Interfaces (`interfaces.ts`)
- `ProjectData`: The root interface that defines the complete project structure
- Object-specific interfaces (e.g., `WallData`, `DoorData`, `WindowData`, `NodeData`)
- `ProjectMetadata` and `ProjectSettings` for project configuration

### 2. Data Writers/Loaders
- `JsonDataWriter/JsonDataLoader`: Handle JSON format
- `YamlDataWriter/YamlDataLoader`: Handle YAML format

### 3. Integration Points
- `CanvasStore`: Central manager for serialization/deserialization
- Individual stores (e.g., `WallStore`, `DoorStore`): Handle object-specific storage

## Adding New Objects

To add a new object type to the storage system:

1. Define the Storage Interface:
```typescript
// In interfaces.ts
export interface NewObjectData {
    id: string;
    // Required properties
    requiredProp: Type;
    // Optional properties
    optionalProp?: Type;
    // Metadata for extensibility
    metadata?: Record<string, any>;
}

// Update ProjectData interface
export interface ProjectData {
    metadata: ProjectMetadata;
    settings: ProjectSettings;
    canvas: {
        nodes: NodeData[];
        walls: WallData[];
        // Add your new object type
        newObjects: NewObjectData[];
        // ... other objects
    };
}
```

2. Implement Storage Methods in Object Class:
```typescript
export class NewObject extends BaseObject {
    // Convert to storage format
    toStorageData(): NewObjectData {
        return {
            id: this.id,
            requiredProp: this.requiredProp,
            optionalProp: this.optionalProp,
            metadata: {
                // Additional data
            }
        };
    }

    // Create from storage format
    static fromStorageData(data: NewObjectData, ...dependencies): NewObject {
        const obj = new NewObject(
            data.id,
            // ... other constructor params
        );
        
        // Restore additional properties
        if (data.optionalProp) {
            obj.setOptionalProp(data.optionalProp);
        }

        return obj;
    }
}
```

3. Create Object Store:
```typescript
export class NewObjectStore extends BaseStore<NewObject> {
    // Load objects from storage
    loadFromStorage(objects: NewObjectData[]): void {
        this.clear();
        objects.forEach(data => {
            const obj = NewObject.fromStorageData(data);
            this.add(obj);
            this.eventManager?.emit('newobject:created', { object: obj });
        });
    }

    // Get objects in storage format
    toStorage(): NewObjectData[] {
        return this.getAll().map(obj => obj.toStorageData());
    }
}
```

4. Update CanvasStore:
```typescript
export class CanvasStore {
    private readonly graphs: GraphRegistry = {
        // ... existing stores
        newObjects: NewObjectStore.getInstance()
    };

    serialize(): ProjectData {
        return {
            // ... existing data
            canvas: {
                // ... existing objects
                newObjects: this.graphs.newObjects.toStorage()
            }
        };
    }

    deserialize(data: ProjectData): void {
        // ... restore other objects
        
        // Restore new objects
        data.canvas.newObjects?.forEach(objData => {
            const obj = NewObject.fromStorageData(objData);
            this.graphs.newObjects.add(obj);
        });

        // If objects need post-load synchronization
        this.synchronizeNewObjects();
    }

    private synchronizeNewObjects(): void {
        const objects = this.graphs.newObjects.getAll();
        objects.forEach(obj => {
            // Update references, positions, etc.
            obj.updateReferences();
        });
    }
}
```

## Best Practices

1. **Type Safety**
   - Always define proper interfaces for your object data
   - Use TypeScript's strict mode to catch type errors
   - Make required properties non-optional in interfaces

2. **Serialization**
   - Include all necessary data to reconstruct the object
   - Use the metadata field for extensibility
   - Handle optional properties gracefully

3. **Deserialization**
   - Restore objects in the correct order (dependencies first)
   - Provide proper default values for optional properties
   - Implement proper error handling for missing/invalid data

4. **Post-Load Synchronization**
   - If objects have dependencies, implement proper sync methods
   - Update positions and references after loading
   - Emit appropriate events to trigger UI updates

5. **Testing**
   - Test serialization/deserialization with various data
   - Verify object integrity after load
   - Test with missing/partial data
   - Verify proper cleanup on clear/reload

## Example: Object Dependencies

If your object depends on other objects (like doors/windows depend on walls):

1. Store references using IDs:
```typescript
interface DependentObjectData {
    id: string;
    parentId: string; // Reference to parent object
    // ... other properties
}
```

2. Handle dependencies in fromStorageData:
```typescript
static fromStorageData(data: DependentObjectData, dependencies: Dependencies): DependentObject {
    const parent = dependencies.getParent(data.parentId);
    if (!parent) throw new Error(`Parent not found: ${data.parentId}`);
    
    return new DependentObject(data.id, parent, ...);
}
```

3. Implement synchronization:
```typescript
updateParentReference(parent: ParentObject): void {
    this.parent = parent;
    this.recalculatePosition();
    // Update other dependent properties
}
``` 