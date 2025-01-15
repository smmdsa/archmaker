import { IEventManager } from '../../../core/interfaces/IEventManager';
import { ILogger } from '../../../core/interfaces/ILogger';

type MenuOption = {
    id: string;
    label: string;
    icon?: string;
} | {
    type: 'separator';
};

export class StorageMenu {
    private menu: HTMLElement | null = null;
    private options: MenuOption[] = [
        { id: 'new', label: 'New Project', icon: '📄' },
        { id: 'open', label: 'Open Project', icon: '📂' },
        { id: 'save', label: 'Save Project', icon: '💾' },
        { type: 'separator' },
        { id: 'export', label: 'Export', icon: '📤' },
        { id: 'import', label: 'Import', icon: '📥' }
    ];

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger
    ) {
        this.initialize();
    }

    private initialize(): void {
        // Listen for clicks outside the menu
        document.addEventListener('click', (e) => {
            if (this.menu && !this.menu.contains(e.target as Node)) {
                this.hide();
            }
        });

        // Listen for topbar item clicks
        this.eventManager.on('topbar:item:clicked', (data: { itemId: string }) => {
            if (data.itemId === 'storage') {
                const item = document.querySelector(`[data-item-id="storage"]`);
                if (item) {
                    // Toggle menu visibility
                    if (this.menu) {
                        this.hide();
                    } else {
                        this.show(item as HTMLElement);
                    }
                }
            }
        });

        this.logger.info('StorageMenu initialized');
    }

    private show(anchor: HTMLElement): void {
        this.hide();

        const menu = document.createElement('div');
        menu.className = 'topbar-dropdown-menu';

        this.options.forEach(option => {
            if ('type' in option && option.type === 'separator') {
                const separator = document.createElement('div');
                separator.className = 'topbar-menu-separator';
                menu.appendChild(separator);
            } else if ('id' in option) {
                const item = document.createElement('div');
                item.className = 'topbar-menu-item';
                item.innerHTML = `
                    ${option.icon ? `<span class="menu-icon">${option.icon}</span>` : ''}
                    <span class="menu-label">${option.label}</span>
                `;
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.eventManager.emit(`storage:menu:${option.id}`, {});
                    this.hide();
                });
                menu.appendChild(item);
            }
        });

        // Position the menu
        const rect = anchor.getBoundingClientRect();
        menu.style.position = 'absolute';
        menu.style.top = `${rect.bottom}px`;
        menu.style.left = `${rect.left}px`;
        menu.style.zIndex = '1000';
        menu.style.backgroundColor = 'var(--background-color)';
        menu.style.border = '1px solid var(--border-color)';
        menu.style.borderRadius = '4px';
        menu.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
        menu.style.minWidth = '200px';
        menu.style.padding = '4px 0';

        document.body.appendChild(menu);
        this.menu = menu;
    }

    private hide(): void {
        if (this.menu) {
            this.menu.remove();
            this.menu = null;
        }
    }

    public dispose(): void {
        this.hide();
        // Remove event listeners
        document.removeEventListener('click', this.hide.bind(this));
    }
} 