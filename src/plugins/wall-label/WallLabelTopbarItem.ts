import type { IEventManager } from '../../core/interfaces/IEventManager';
import type { ILogger } from '../../core/interfaces/ILogger';
import type { IConfigManager } from '../../core/interfaces/IConfig';
import type { ITopbarItem, ITopbarManifest } from '../../core/topbar/interfaces/ITopbarItem';
import { TopbarItem } from '../../core/topbar/decorators/TopbarItem';
import { WallLabelPlugin } from './WallLabelPlugin';

@TopbarItem({
    id: 'wall-label-toggle',
    name: 'Wall Labels',
    icon: `<span class="material-icons">🏷️</span>`,
    section: 'view',
    order: 100,
    tooltip: 'Toggle Wall Labels'
})
export class WallLabelTopbarItem implements ITopbarItem {
    private element: HTMLElement | null = null;
    private toggleButton: HTMLButtonElement | null = null;
    private isVisible: boolean = true;
    private wallLabelPlugin: WallLabelPlugin | null = null;
    private boundClickHandler: (event: MouseEvent) => void;

    // Remove these as they're set by the decorator via TopbarRegistry
    readonly id!: string;
    readonly manifest!: ITopbarManifest;

    constructor(
        private readonly eventManager: IEventManager,
        private readonly logger: ILogger,
        private readonly configManager: IConfigManager
    ) {
        this.boundClickHandler = this.handleClick.bind(this);
    }

    async initialize(): Promise<void> {
        // Create UI elements first
        this.eventManager.on('canvas:initialized', (event: { canvas: any }) => {
            
            // Wait for canvas to be initialized
            this.logger.info('WallLabelTopbarItem: Canvas initialized, creating plugin');
            // Initialize plugin with the main scene
            this.wallLabelPlugin = new WallLabelPlugin(
                this.eventManager,
                this.logger,
                this.configManager,
                event.canvas.scene
            );
            this.wallLabelPlugin.initialize();
            this.createUIElements();

            this.updateButtonState();
            this.logger.info('WallLabelTopbarItem: Initialized');

        });
    }

    private createUIElements(): void {
        // Create container
        this.element = document.createElement('div');
        this.element.className = 'topbar-item';
        this.element.setAttribute('data-item-id', this.id); // Use the id set by registry

        // Create button
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'topbar-button'; // Use topbar-button class
        this.toggleButton.type = 'button';
        this.toggleButton.title = this.manifest.tooltip || 'Toggle Wall Labels';

        // Create button content
        const buttonContent = document.createElement('div');
        buttonContent.className = 'button-content';
        buttonContent.innerHTML = `
            ${this.manifest.icon}
            <span class="button-text">Labels ${this.isVisible ? 'ON' : 'OFF'}</span>
        `;

        this.toggleButton.appendChild(buttonContent);
        this.element.appendChild(this.toggleButton);

        // Add click handler

        this.eventManager.on('topbar:item:clicked', (data: { itemId: string }) => {
            if (data.itemId === this.id) {
                this.handleClick();
            }
        });

        this.logger.info('WallLabelTopbarItem: Button click handler attached');

    }

    async dispose(): Promise<void> {
        if (this.wallLabelPlugin) {
            await this.wallLabelPlugin.dispose();
        }
        if (this.toggleButton) {
            this.logger.info('WallLabelTopbarItem: Disposing, removing click handler');
            this.toggleButton.removeEventListener('click', this.boundClickHandler);
        }
    }

    getElement(): HTMLElement | null {
        return this.element;
    }

    private handleClick(): void {
        this.logger.info(`WallLabelTopbarItem: Button clicked, toggling visibility from ${this.isVisible} to ${!this.isVisible}`);
        this.isVisible = !this.isVisible;
        this.updateButtonState();
        this.logger.info('WallLabelTopbarItem: Emitting wall-label:toggle event');
        this.eventManager.emit('wall-label:toggle', { visible: this.isVisible });
    }

    private updateButtonState(): void {
        if (!this.toggleButton) return;

        this.logger.info(`WallLabelTopbarItem: Updating button state, visible=${this.isVisible}`);
        this.toggleButton.title = `Wall Labels ${this.isVisible ? 'ON' : 'OFF'}`;

        const buttonContent = this.toggleButton.querySelector('.button-content');
        if (buttonContent) {
            buttonContent.innerHTML = `
                ${this.manifest.icon}
                <span class="button-text">Labels ${this.isVisible ? 'ON' : 'OFF'}</span>
            `;
        }

        this.toggleButton.classList.toggle('active', this.isVisible);
    }
} 