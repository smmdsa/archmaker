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
        // Escuchar clicks fuera del menú
        document.addEventListener('click', (e) => {
            if (this.menu && !this.menu.contains(e.target as Node)) {
                this.hide();
            }
        });

        // Escuchar evento para mostrar el menú
        this.eventManager.on('topbar:item:clicked', (data: { itemId: string }) => {
            if (data.itemId === 'storage') {
                const item = document.querySelector(`[data-item-id="storage"]`);
                if (item) {
                    this.show(item as HTMLElement);
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

        // Posicionar el menú
        const rect = anchor.getBoundingClientRect();
        menu.style.position = 'absolute';
        menu.style.top = `${rect.bottom}px`;
        menu.style.left = `${rect.left}px`;

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
    }
} 