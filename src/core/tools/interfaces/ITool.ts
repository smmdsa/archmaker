import Konva from 'konva';
import { Point } from '../../../store/ProjectStore';

/**
 * Contexto proporcionado a las herramientas durante eventos del canvas
 */
export interface IToolContext {
    canvasPosition: Point;
    event: Event;
    stage: Konva.Stage;
    layer: Konva.Layer;        // Capa temporal para previsualizaciones
    mainLayer: Konva.Layer;    // Capa principal para elementos permanentes
}

/**
 * Interfaz principal para todas las herramientas en la aplicación.
 * Define el contrato que todas las herramientas deben implementar.
 */
export interface ITool {
    // Propiedades de identificación
    readonly id: string;
    readonly type: string;
    readonly name: string;
    readonly icon: string;
    readonly shortcut?: string;

    // Lifecycle methods
    initialize(): void;
    dispose(): void;

    // Tool state management
    isActive(): boolean;
    activate(): Promise<void>;
    deactivate(): Promise<void>;

    // Event handlers
    onMouseDown(context: IToolContext): void;
    onMouseMove(context: IToolContext): void;
    onMouseUp(context: IToolContext): void;
    onKeyDown(event: KeyboardEvent): void;
    onKeyUp(event: KeyboardEvent): void;

    // Properties management
    getProperties?(): unknown;
    setProperties?(props: unknown): void;
    
    // Event registration
    registerEventHandlers?(): void;
} 