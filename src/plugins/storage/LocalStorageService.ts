import { IStorageService, StorageOptions } from '../../core/interfaces/IStorageService';
import { ProjectData } from '../../core/types/project';
import { ILogger } from '../../core/interfaces/ILogger';
import { IEventManager } from '../../core/interfaces/IEventManager';
import { IConfigManager } from '../../core/interfaces/IConfig';
import yaml from 'js-yaml';

export class LocalStorageService implements IStorageService {
    private readonly STORAGE_KEY_PREFIX = 'archmaker2_';
    private readonly BACKUP_PREFIX = 'backup_';
    private initialized: boolean = false;

    constructor(
        private readonly logger: ILogger,
        private readonly eventManager: IEventManager,
        private readonly configManager: IConfigManager
    ) {}

    async initialize(): Promise<void> {
        if (this.initialized) {
            this.logger.warn('LocalStorageService already initialized');
            return;
        }

        try {
            // Verificar si localStorage está disponible
            if (!window.localStorage) {
                throw new Error('LocalStorage is not available');
            }

            this.initialized = true;
            this.logger.info('LocalStorageService initialized');

            // Emitir evento de inicialización
            await this.eventManager.emit('storage:initialized', { provider: 'local' });
        } catch (error) {
            this.logger.error('Failed to initialize LocalStorageService', error as Error);
            throw error;
        }
    }

    async dispose(): Promise<void> {
        if (!this.initialized) {
            this.logger.warn('LocalStorageService not initialized or already disposed');
            return;
        }

        try {
            this.initialized = false;
            this.logger.info('LocalStorageService disposed');

            // Emitir evento de disposición
            await this.eventManager.emit('storage:disposed', { provider: 'local' });
        } catch (error) {
            this.logger.error('Failed to dispose LocalStorageService', error as Error);
            throw error;
        }
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('LocalStorageService not initialized');
        }
    }

    private serializeData(data: ProjectData, options?: StorageOptions): string {
        if (options?.format === 'yaml') {
            return yaml.dump(data, { indent: options.pretty ? 2 : 0 });
        }
        return JSON.stringify(data, null, options?.pretty ? 2 : 0);
    }

    private deserializeData(data: string, format: 'json' | 'yaml' = 'json'): ProjectData {
        try {
            if (format === 'yaml') {
                return yaml.load(data) as ProjectData;
            }
            return JSON.parse(data);
        } catch (error) {
            throw new Error(`Failed to parse ${format.toUpperCase()} data: ${(error as Error).message}`);
        }
    }

    async saveProject(data: ProjectData, options?: StorageOptions): Promise<string> {
        this.ensureInitialized();

        try {
            const key = `${this.STORAGE_KEY_PREFIX}${data.metadata.id}`;
            const serializedData = this.serializeData(data, options);
            localStorage.setItem(key, serializedData);

            // Guardar metadata para búsqueda rápida
            const metadata = {
                id: data.metadata.id,
                name: data.metadata.name,
                lastModified: new Date().toISOString(),
                format: options?.format || 'json'
            };
            localStorage.setItem(`${key}_meta`, JSON.stringify(metadata));

            this.logger.info('Project saved', { projectId: data.metadata.id });
            await this.eventManager.emit('project:saved', { projectId: data.metadata.id });

            return key;
        } catch (error) {
            this.logger.error('Failed to save project', error as Error);
            throw error;
        }
    }

    async loadProject(path: string): Promise<ProjectData> {
        this.ensureInitialized();

        try {
            const data = localStorage.getItem(path);
            if (!data) {
                throw new Error(`Project not found: ${path}`);
            }

            // Obtener el formato del metadata
            const metaStr = localStorage.getItem(`${path}_meta`);
            const meta = metaStr ? JSON.parse(metaStr) : { format: 'json' };

            const project = this.deserializeData(data, meta.format as 'json' | 'yaml');
            
            this.logger.info('Project loaded', { projectId: project.metadata.id });
            await this.eventManager.emit('project:loaded', { projectId: project.metadata.id });

            return project;
        } catch (error) {
            this.logger.error('Failed to load project', error as Error);
            throw error;
        }
    }

    async listProjects(): Promise<Array<{ path: string; name: string; lastModified: Date; }>> {
        this.ensureInitialized();

        try {
            const projects: Array<{ path: string; name: string; lastModified: Date; }> = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith(this.STORAGE_KEY_PREFIX) && !key.endsWith('_meta')) {
                    const metaStr = localStorage.getItem(`${key}_meta`);
                    if (metaStr) {
                        const meta = JSON.parse(metaStr);
                        projects.push({
                            path: key,
                            name: meta.name,
                            lastModified: new Date(meta.lastModified)
                        });
                    }
                }
            }

            return projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
        } catch (error) {
            this.logger.error('Failed to list projects', error as Error);
            throw error;
        }
    }

    async deleteProject(path: string): Promise<void> {
        this.ensureInitialized();

        try {
            if (!localStorage.getItem(path)) {
                throw new Error(`Project not found: ${path}`);
            }

            localStorage.removeItem(path);
            localStorage.removeItem(`${path}_meta`);

            this.logger.info('Project deleted', { path });
            await this.eventManager.emit('project:deleted', { path });
        } catch (error) {
            this.logger.error('Failed to delete project', error as Error);
            throw error;
        }
    }

    async projectExists(path: string): Promise<boolean> {
        this.ensureInitialized();
        return !!localStorage.getItem(path);
    }

    async createBackup(path: string): Promise<string> {
        this.ensureInitialized();

        try {
            const data = localStorage.getItem(path);
            if (!data) {
                throw new Error(`Project not found: ${path}`);
            }

            const backupPath = `${this.BACKUP_PREFIX}${path}_${Date.now()}`;
            localStorage.setItem(backupPath, data);

            const metaStr = localStorage.getItem(`${path}_meta`);
            if (metaStr) {
                localStorage.setItem(`${backupPath}_meta`, metaStr);
            }

            this.logger.info('Backup created', { originalPath: path, backupPath });
            await this.eventManager.emit('project:backup:created', { originalPath: path, backupPath });

            return backupPath;
        } catch (error) {
            this.logger.error('Failed to create backup', error as Error);
            throw error;
        }
    }

    async restoreBackup(backupPath: string): Promise<string> {
        this.ensureInitialized();

        try {
            const data = localStorage.getItem(backupPath);
            if (!data) {
                throw new Error(`Backup not found: ${backupPath}`);
            }

            // Extraer el path original del backup
            const originalPath = backupPath.replace(this.BACKUP_PREFIX, '').split('_')[0];
            
            localStorage.setItem(originalPath, data);

            const metaStr = localStorage.getItem(`${backupPath}_meta`);
            if (metaStr) {
                localStorage.setItem(`${originalPath}_meta`, metaStr);
            }

            this.logger.info('Backup restored', { backupPath, originalPath });
            await this.eventManager.emit('project:backup:restored', { backupPath, originalPath });

            return originalPath;
        } catch (error) {
            this.logger.error('Failed to restore backup', error as Error);
            throw error;
        }
    }
} 