import { IEventManager } from '../core/interfaces/IEventManager';
import { ILogger } from '../core/interfaces/ILogger';
import { TopbarService } from '../core/topbar/services/TopbarService';
import { ITopbarItem } from '../core/topbar/interfaces/ITopbarItem';

export class Topbar {
    private container: HTMLElement;
    private items: Map<string, HTMLElement> = new Map();

    constructor(
        containerId: string,
        private readonly topbarService: TopbarService,
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Topbar container not found: ${containerId}`);
        }
        this.container = container;
        this.initialize();
    }

    private initialize(): void {
        this.logger.info('Initializing topbar...');
        this.createTopbar();
        this.setupEventListeners();
    }

    private createTopbar(): void {
        this.container.innerHTML = '';
        this.container.className = 'topbar';

        // Obtener secciones y elementos
        const sections = this.topbarService.getSections();
        
        // Crear secciones y elementos
        sections.forEach(sectionName => {
            const section = this.createSection(sectionName);
            const sectionItems = this.topbarService.getItemsBySection(sectionName);
            
            // Crear elementos para cada item
            sectionItems.forEach(item => {
                const element = this.createTopbarItem(item);
                this.items.set(item.id, element);
                section.appendChild(element);
            });

            this.container.appendChild(section);
        });
    }

    private createSection(name: string): HTMLDivElement {
        const section = document.createElement('div');
        section.className = 'topbar-section';
        section.dataset.section = name;
        return section;
    }

    private setupEventListeners(): void {
        this.eventManager.on('topbar:updated', () => {
            this.updateTopbar();
        });
    }

    private updateTopbar(): void {
        this.logger.debug('Updating topbar...');
        this.items.clear();
        this.container.innerHTML = '';
        this.createTopbar();
    }

    private createTopbarItem(item: ITopbarItem): HTMLElement {
        const element = document.createElement('div');
        element.className = 'topbar-item';
        element.innerHTML = item.manifest.icon;
        element.title = item.manifest.tooltip || item.manifest.name;
        if (item.manifest.shortcut) {
            element.title += ` (${item.manifest.shortcut})`;
        }
        element.dataset.itemId = item.id;
        
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                this.eventManager.emit('topbar:item:clicked', { itemId: item.id });
            } catch (error) {
                this.logger.error(`Failed to handle topbar item click: ${item.id}`, error as Error);
            }
        });

        return element;
    }

    public dispose(): void {
        this.logger.info('Disposing topbar...');
        this.items.clear();
        this.container.innerHTML = '';
    }
} 