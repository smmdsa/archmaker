# Wall Tool Plugin

## Descripción
Plugin para crear y editar paredes en ArchMaker. Permite dibujar paredes en el espacio 2D y visualizarlas en 3D, con propiedades configurables como altura, grosor y material.

## Estructura del Plugin
```
wall-tool/
├── __tests__/                     # Tests del plugin
│   ├── WallTool.test.ts          # Tests principales
│   ├── commands/                  # Tests de comandos
│   └── renderers/                 # Tests de renderizadores
├── commands/                      # Comandos del plugin
│   ├── AddWallCommand.ts         # Comando para crear paredes
│   └── RemoveWallCommand.ts      # Comando para eliminar paredes
├── properties/                    # Propiedades y configuración
│   └── WallProperties.ts         # Definición de propiedades
├── renderers/                     # Renderizadores
│   ├── WallRenderer2D.ts         # Renderizado Konva (2D)
│   └── WallRenderer3D.ts         # Renderizado Three.js (3D)
├── types/                        # Tipos y interfaces
│   └── wall.ts                   # Definiciones de tipos
├── utils/                        # Utilidades
│   └── wallCalculations.ts       # Cálculos geométricos
├── WallTool.ts                   # Clase principal
└── README.md                     # Esta documentación
```

## Instalación

1. Registrar el plugin en el PluginManager:
```typescript
const wallTool = new WallTool(eventManager, logger);
pluginManager.register(wallTool);
```

2. Configuración (opcional):
```json
{
  "wall-tool": {
    "enabled": true,
    "settings": {
      "defaultHeight": 2.4,
      "defaultThickness": 0.15,
      "defaultMaterial": "concrete"
    }
  }
}
```

## Uso

### Activación
```typescript
await pluginManager.activatePlugin('wall-tool');
```

### Creación de Paredes
1. Activar la herramienta
2. Hacer clic para el punto inicial
3. Arrastrar para definir la dirección y longitud
4. Hacer clic para finalizar

### Eventos Disponibles

| Evento | Descripción | Payload |
|--------|-------------|---------|
| wall:created | Se crea una nueva pared | { wall: Wall } |
| wall:updated | Se actualiza una pared | { wallId: string, properties: WallUpdateProperties } |
| wall:deleted | Se elimina una pared | { wallId: string } |
| wall:selected | Se selecciona una pared | { wallId: string } |
| wall:drawing:start | Comienza el dibujo | { point: Point } |
| wall:drawing:update | Actualización durante el dibujo | { startPoint: Point, endPoint: Point } |
| wall:drawing:finish | Finaliza el dibujo | { startPoint: Point, endPoint: Point } |

## API

### Interfaces Principales

```typescript
interface WallProperties {
    height: number;
    thickness: number;
    material: string;
    startPoint: Point;
    endPoint: Point;
}

interface Wall extends WallProperties {
    id: string;
    length: number;
    angle: number;
}
```

### Métodos Públicos

```typescript
class WallTool {
    startDrawing(point: Point): void;
    updateDrawing(point: Point): void;
    finishDrawing(point: Point): void;
    cancelDrawing(): void;
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
npm test -- wall-tool

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