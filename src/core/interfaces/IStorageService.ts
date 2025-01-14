import { ProjectData } from '../storage/interfaces';

export interface StorageOptions {
    format?: 'json' | 'yaml';
    pretty?: boolean;
    version?: string;
}

export interface IStorageService {
    /**
     * Inicializa el servicio de almacenamiento
     */
    initialize(): Promise<void>;

    /**
     * Libera recursos del servicio de almacenamiento
     */
    dispose(): Promise<void>;

    /**
     * Guarda el proyecto en el almacenamiento
     * @param data Datos del proyecto a guardar
     * @param options Opciones de guardado
     * @returns Path o identificador del archivo guardado
     */
    saveProject(data: ProjectData, options?: StorageOptions): Promise<string>;

    /**
     * Carga un proyecto desde el almacenamiento
     * @param path Path o identificador del proyecto a cargar
     * @returns Datos del proyecto
     */
    loadProject(path: string): Promise<ProjectData>;

    /**
     * Lista los proyectos disponibles en el almacenamiento
     * @returns Lista de proyectos disponibles
     */
    listProjects(): Promise<Array<{ path: string, name: string, lastModified: Date }>>;

    /**
     * Elimina un proyecto del almacenamiento
     * @param path Path o identificador del proyecto a eliminar
     */
    deleteProject(path: string): Promise<void>;

    /**
     * Verifica si un proyecto existe en el almacenamiento
     * @param path Path o identificador del proyecto
     */
    projectExists(path: string): Promise<boolean>;

    /**
     * Crea una copia de respaldo del proyecto
     * @param path Path o identificador del proyecto
     * @returns Path de la copia de respaldo
     */
    createBackup(path: string): Promise<string>;

    /**
     * Restaura un proyecto desde una copia de respaldo
     * @param backupPath Path de la copia de respaldo
     * @returns Path del proyecto restaurado
     */
    restoreBackup(backupPath: string): Promise<string>;
} 