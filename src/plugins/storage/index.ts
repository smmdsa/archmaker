import { IPlugin, PluginManifest } from '../../core/interfaces/IPlugin';
import { IEventManager } from '../../core/interfaces/IEventManager';
import { ILogger } from '../../core/interfaces/ILogger';
import { IConfigManager } from '../../core/interfaces/IConfig';
import { LocalStorageService } from './LocalStorageService';
import { IStorageService } from '../../core/interfaces/IStorageService';
import { UIComponentManifest } from '../../core/interfaces/IUIRegion';
import { CanvasStore } from '../../store/CanvasStore';
import { JsonDataWriter, YamlDataWriter, JsonDataLoader, YamlDataLoader } from '../../core/storage';
import './styles.css';

// Export StorageTopbarItem for registration
export * from './StorageTopbarItem';

export class StoragePlugin implements IPlugin {
    private storageService: IStorageService;
    private canvasStore: CanvasStore;
    private jsonWriter = new JsonDataWriter();
    private yamlWriter = new YamlDataWriter();
    private jsonLoader = new JsonDataLoader();
    private yamlLoader = new YamlDataLoader();
    
    readonly manifest: PluginManifest = {
        id: 'storage-plugin',
        name: 'Storage Plugin',
        version: '1.0.0',
        type: 'service',
        description: 'Provides project storage capabilities',
        author: 'ArchMaker',
        uiComponents: [
            {
                id: 'storage-menu',
                region: 'topbar',
                order: 0,
                template: `
                    <div class="topbar-menu">
                        <div class="topbar-menu-trigger">File</div>
                        <div class="topbar-menu-content">
                            <div class="topbar-menu-item" data-action="new">
                                <i>📄</i> New Project
                            </div>
                            <div class="topbar-menu-item" data-action="open">
                                <i>📂</i> Open Project
                            </div>
                            <div class="topbar-menu-item" data-action="save">
                                <i>💾</i> Save Project
                            </div>
                            <div class="topbar-menu-separator"></div>
                            <div class="topbar-menu-item" data-action="export">
                                <i>📤</i> Export
                            </div>
                            <div class="topbar-menu-item" data-action="import">
                                <i>📥</i> Import
                            </div>
                        </div>
                    </div>
                `,
                events: {
                    click: this.handleMenuClick.bind(this)
                }
            }
        ]
    };

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager
    ) {
        this.storageService = new LocalStorageService(logger, eventManager, configManager);
        this.canvasStore = CanvasStore.getInstance(eventManager, logger);
    }

    async initialize(): Promise<void> {
        this.logger.info('Initializing Storage Plugin...');
        await this.storageService.initialize();
        // Event subscriptions moved to StorageTopbarItem
    }

    async dispose(): Promise<void> {
        this.logger.info('Disposing Storage Plugin...');
        await this.storageService.dispose();
    }

    getStorageService(): IStorageService {
        return this.storageService;
    }

    getUIComponents(): UIComponentManifest[] {
        return this.manifest.uiComponents || [];
    }

    private handleMenuClick(event: Event): void {
        const target = event.target as HTMLElement;
        const menuItem = target.closest('[data-action]');
        if (!menuItem) return;

        const action = (menuItem as HTMLElement).dataset.action;
        if (action) {
            this.eventManager.emit(`storage:menu:${action}`, {});
            
            // Close menu
            const menu = target.closest('.topbar-menu');
            if (menu) {
                menu.classList.remove('open');
            }
        }
    }

    private async hasUnsavedChanges(): Promise<boolean> {
        // TODO: Implement proper change tracking
        return false;
    }

    private showDialog(title: string, content: string, buttons: { label: string; value: any }[]): Promise<any> {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'dialog-overlay';
            dialog.innerHTML = `
                <div class="dialog">
                    <div class="dialog-header">${title}</div>
                    <div class="dialog-content">${content}</div>
                    <div class="dialog-buttons">
                        ${buttons.map(btn => `
                            <button class="dialog-button" data-value="${btn.value}">${btn.label}</button>
                        `).join('')}
                    </div>
                </div>
            `;

            // Prevent clicks on overlay from bubbling
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    e.stopPropagation();
                }
            });

            // Handle button clicks
            dialog.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.classList.contains('dialog-button')) {
                    const value = target.dataset.value;
                    document.body.removeChild(dialog);
                    resolve(value === 'null' ? null : value);
                }
            });

            document.body.appendChild(dialog);
        });
    }

    private showProjectSelector(title: string, projects: string[]): Promise<number | null> {
        const content = `
            <div class="project-list">
                ${projects.map((project, index) => `
                    <div class="project-item" data-value="${index}">
                        ${project}
                    </div>
                `).join('')}
            </div>
        `;

        const dialog = document.createElement('div');
        dialog.className = 'dialog-overlay';
        dialog.innerHTML = `
            <div class="dialog">
                <div class="dialog-header">${title}</div>
                <div class="dialog-content">${content}</div>
                <div class="dialog-buttons">
                    <button class="dialog-button" data-value="null">Cancel</button>
                    <button class="dialog-button" data-value="select" disabled>Open</button>
                </div>
            </div>
        `;

        return new Promise((resolve) => {
            let selectedItem: HTMLElement | null = null;

            // Handle project item clicks
            dialog.addEventListener('click', (e) => {
                const target = e.target instanceof HTMLElement ? e.target : null;
                const projectItem = target?.closest('.project-item') as HTMLElement | null;
                
                if (projectItem) {
                    // Remove previous selection
                    dialog.querySelectorAll('.project-item').forEach(item => 
                        item.classList.remove('selected')
                    );
                    
                    // Add selection to clicked item
                    projectItem.classList.add('selected');
                    selectedItem = projectItem;
                    
                    // Enable the Open button
                    const openButton = dialog.querySelector('.dialog-button[data-value="select"]') as HTMLButtonElement;
                    if (openButton) {
                        openButton.disabled = false;
                    }
                }
            });

            // Handle button clicks
            dialog.addEventListener('click', (e) => {
                const target = e.target instanceof HTMLElement ? e.target : null;
                if (target?.classList.contains('dialog-button')) {
                    const value = target.dataset.value;
                    document.body.removeChild(dialog);
                    
                    if (value === 'select' && selectedItem) {
                        const index = parseInt(selectedItem.dataset.value || '-1');
                        resolve(index);
                    } else {
                        resolve(null);
                    }
                }
            });

            document.body.appendChild(dialog);
        });
    }

    private showFormatSelector(title: string, formats: string[]): Promise<string | null> {
        const content = `
            <div class="format-list">
                ${formats.map(format => `
                    <div class="format-item">
                        <input type="radio" name="format" value="${format.toLowerCase()}" id="format-${format.toLowerCase()}">
                        <label for="format-${format.toLowerCase()}">${format}</label>
                    </div>
                `).join('')}
            </div>
        `;

        const dialog = document.createElement('div');
        dialog.className = 'dialog-overlay';
        dialog.innerHTML = `
            <div class="dialog">
                <div class="dialog-header">${title}</div>
                <div class="dialog-content">${content}</div>
                <div class="dialog-buttons">
                    <button class="dialog-button" data-value="null">Cancel</button>
                    <button class="dialog-button" data-value="select" disabled>Select</button>
                </div>
            </div>
        `;

        return new Promise((resolve) => {
            // Handle radio button changes
            dialog.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                if (target.type === 'radio') {
                    // Enable the Select button
                    const selectButton = dialog.querySelector('.dialog-button[data-value="select"]') as HTMLButtonElement;
                    if (selectButton) {
                        selectButton.disabled = false;
                    }
                }
            });

            // Handle button clicks
            dialog.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.classList.contains('dialog-button')) {
                    const value = target.dataset.value;
                    document.body.removeChild(dialog);
                    
                    if (value === 'select') {
                        const selected = dialog.querySelector('input[name="format"]:checked') as HTMLInputElement;
                        resolve(selected ? selected.value : null);
                    } else {
                        resolve(null);
                    }
                }
            });

            document.body.appendChild(dialog);
        });
    }

    public async handleNewProject(): Promise<void> {
        this.logger.info('Creating new project...');
        
        // Confirm with user if there are unsaved changes
        if (await this.hasUnsavedChanges()) {
            const confirmed = await this.showDialog(
                'Unsaved Changes',
                'You have unsaved changes. Are you sure you want to create a new project?',
                [
                    { label: 'Cancel', value: false },
                    { label: 'Continue', value: true }
                ]
            );
            if (!confirmed) return;
        }

        // Clear canvas and create new project
        this.canvasStore.clear();
        
        // Update project metadata
        this.canvasStore.updateProjectMetadata({
            name: 'New Project',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString()
        });

        this.eventManager.emit('project:created', {
            projectId: this.canvasStore.getProjectMetadata().id
        });
    }

    public async handleOpenProject(): Promise<void> {
        try {
            const projects = await this.storageService.listProjects();
            if (projects.length === 0) {
                await this.showDialog(
                    'No Projects',
                    'No saved projects found. Create a new project first.',
                    [{ label: 'OK', value: null }]
                );
                return;
            }

            const projectList = projects.map(p => `${p.name} (Last modified: ${p.lastModified.toLocaleString()})`);
            const selectedIndex = await this.showProjectSelector('Open Project', projectList);
            
            if (selectedIndex !== null) {
                const project = projects[selectedIndex];
                const projectData = await this.storageService.loadProject(project.path);
                
                // Clear current project and load new one
                this.canvasStore.clear();
                this.canvasStore.deserialize(projectData);
                
                this.logger.info('Project opened successfully', { projectId: projectData.metadata.id });
                await this.eventManager.emit('project:opened', { projectId: projectData.metadata.id });
            }
        } catch (error) {
            this.logger.error('Failed to open project', error as Error);
            await this.showDialog(
                'Error',
                `Failed to open project: ${(error as Error).message}`,
                [{ label: 'OK', value: null }]
            );
        }
    }

    public async handleSaveProject(): Promise<void> {
        try {
            // Get current project data
            const projectData = this.canvasStore.serialize();
            
            // Save project
            const key = await this.storageService.saveProject(projectData);
            
            this.logger.info('Project saved successfully', { projectId: projectData.metadata.id });
            await this.eventManager.emit('project:saved', { projectId: projectData.metadata.id });
            
            await this.showDialog(
                'Success',
                'Project saved successfully',
                [{ label: 'OK', value: null }]
            );
        } catch (error) {
            this.logger.error('Failed to save project', error as Error);
            await this.showDialog(
                'Error',
                `Failed to save project: ${(error as Error).message}`,
                [{ label: 'OK', value: null }]
            );
        }
    }

    public async handleExport(): Promise<void> {
        this.logger.info('Opening export dialog...');
        
        try {
            // Get current project data
            const projectData = this.canvasStore.serialize();
            
            // Let user choose format
            const format = await this.showFormatSelector('Select export format:', ['JSON', 'YAML']);
            if (!format) return;
            
            // Serialize data in chosen format
            const serializedData = format === 'json' 
                ? this.jsonWriter.write(projectData)
                : this.yamlWriter.write(projectData);
            
            // Create download link
            const blob = new Blob([serializedData], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${projectData.metadata.name}.${format}`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.eventManager.emit('project:exported', {
                projectId: projectData.metadata.id,
                format
            });
        } catch (error) {
            this.logger.error('Failed to export project', error as Error);
            await this.showDialog(
                'Error',
                'Failed to export project: ' + (error as Error).message,
                [{ label: 'OK', value: null }]
            );
        }
    }

    public async handleImport(): Promise<void> {
        this.logger.info('Opening import dialog...');
        
        try {
            // Create file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.yaml,.yml';
            
            // Handle file selection
            input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;

                // Confirm if there are unsaved changes
                if (await this.hasUnsavedChanges()) {
                    const confirmed = await this.showDialog(
                        'Unsaved Changes',
                        'You have unsaved changes. Are you sure you want to import another project?',
                        [
                            { label: 'Cancel', value: false },
                            { label: 'Continue', value: true }
                        ]
                    );
                    if (!confirmed) return;
                }

                try {
                    // Read file
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const content = e.target?.result as string;
                        const format = file.name.toLowerCase().endsWith('.json') ? 'json' : 'yaml';
                        
                        // Load project data
                        const projectData = format === 'json' 
                            ? this.jsonLoader.load(content)
                            : this.yamlLoader.load(content);
                        this.canvasStore.deserialize(projectData);

                        this.eventManager.emit('project:imported', {
                            projectId: projectData.metadata.id,
                            format
                        });
                    };
                    reader.readAsText(file);
                } catch (error) {
                    this.logger.error('Failed to import project', error as Error);
                    await this.showDialog(
                        'Error',
                        'Failed to import project: ' + (error as Error).message,
                        [{ label: 'OK', value: null }]
                    );
                }
            };
            
            input.click();
        } catch (error) {
            this.logger.error('Failed to import project', error as Error);
            await this.showDialog(
                'Error',
                'Failed to import project: ' + (error as Error).message,
                [{ label: 'OK', value: null }]
            );
        }
    }
} 