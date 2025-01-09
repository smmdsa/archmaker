# Room Tool Plugin

## Descripción
Plugin para crear y editar habitaciones rectangulares en ArchMaker. Permite dibujar habitaciones completas con cuatro paredes en un solo gesto, con propiedades configurables como altura, grosor de paredes y material.

## Estructura del Plugin
```
room-tool/
├── __tests__/                     # Tests del plugin
│   ├── RoomTool.test.ts          # Tests principales
│   ├── commands/                  # Tests de comandos
│   └── renderers/                 # Tests de renderizadores
├── commands/                      # Comandos del plugin
│   ├── AddRoomCommand.ts         # Comando para crear habitaciones
│   └── RemoveRoomCommand.ts      # Comando para eliminar habitaciones
├── properties/                    # Propiedades y configuración
│   └── RoomProperties.ts         # Definición de propiedades
├── renderers/                     # Renderizadores
│   ├── RoomRenderer2D.ts         # Renderizado Konva (2D)
│   └── RoomRenderer3D.ts         # Renderizado Three.js (3D)
├── types/                        # Tipos e interfaces
│   └── room.ts                   # Definiciones de tipos
├── utils/                        # Utilidades
│   └── roomCalculations.ts       # Cálculos geométricos
├── RoomTool.ts                   # Clase principal
└── README.md                     # Esta documentación
```

## Instalación

1. Registrar el plugin en el PluginManager:
```typescript
// En src/main.ts
import { RoomTool } from './plugins/room-tool/RoomTool';

// Crear y registrar el plugin
const roomTool = new RoomTool();
toolService.registerTool(roomTool);
```

2. Configuración (opcional):
```json
{
  "room-tool": {
    "enabled": true,
    "settings": {
      "defaultHeight": 2.8,
      "defaultWallThickness": 0.2,
      "defaultMaterial": "concrete",
      "gridSnapping": true,
      "angleSnapping": true
    }
  }
}
```

## Uso

### Activación
- Hacer clic en el ícono de habitación en la barra de herramientas
- O presionar la tecla 'R'

### Creación de Habitaciones
1. Activar la herramienta
2. Hacer clic para el punto inicial
3. Arrastrar para definir el ancho y alto
4. Soltar para finalizar

### Eventos Disponibles

| Evento | Descripción | Payload |
|--------|-------------|---------|
| room:created | Se crea una nueva habitación | { room: Room } |
| room:updated | Se actualiza una habitación | { roomId: string, properties: RoomUpdateProperties } |
| room:deleted | Se elimina una habitación | { roomId: string } |
| room:selected | Se selecciona una habitación | { roomId: string } |
| room:drawing:start | Comienza el dibujo | { point: Point } |
| room:drawing:update | Actualización durante el dibujo | { startPoint: Point, currentPoint: Point } |
| room:drawing:finish | Finaliza el dibujo | { room: Room } |

## API

### Interfaces Principales

```typescript
interface RoomProperties {
    wallHeight: number;
    wallThickness: number;
    material: string;
    name?: string;
    color?: string;
}

interface Room {
    id: string;
    walls: Wall[];
    startPoint: Point;
    width: number;
    height: number;
    properties: RoomProperties;
}
```

### Métodos Públicos

```typescript
class RoomTool {
    activate(): Promise<void>;
    deactivate(): Promise<void>;
    isActive(): boolean;
    getProperties(): RoomProperties;
    setProperties(props: RoomProperties): void;
}
```

## Desarrollo

### Setup del Entorno
1. Instalar dependencias
2. Configurar TypeScript
3. Configurar Jest para testing

### Convenciones de Código
- Usar TypeScript strict mode
- Documentar interfaces y métodos públicos
- Seguir principios SOLID
- Tests para cada funcionalidad

### Testing
```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests específicos del plugin
npm test -- room-tool

# Ver cobertura
npm test -- --coverage
```

## Contribución
1. Crear branch feature/fix
2. Implementar cambios con tests
3. Crear Pull Request
4. Code Review

## Licencia
MIT License 