import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WallLabelTopbarItem } from '../WallLabelTopbarItem';
import type { IEventManager } from '../../../core/interfaces/IEventManager';
import type { ILogger } from '../../../core/interfaces/ILogger';
import type { IConfigManager } from '../../../core/interfaces/IConfig';

describe('WallLabelTopbarItem', () => {
    let mockEventManager: IEventManager;
    let mockLogger: ILogger;
    let mockConfigManager: IConfigManager;
    let topbarItem: WallLabelTopbarItem;

    beforeEach(async () => {
        // Setup mocks
        mockEventManager = {
            on: vi.fn(),
            emit: vi.fn(),
        } as unknown as IEventManager;

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        } as unknown as ILogger;

        mockConfigManager = {
            getConfig: vi.fn().mockResolvedValue({ wallLabels: { visible: true } }),
            saveConfig: vi.fn(),
        } as unknown as IConfigManager;

        // Create topbar item
        topbarItem = new WallLabelTopbarItem(mockEventManager, mockLogger, mockConfigManager);
        await topbarItem.initialize();
    });

    it('should create DOM elements on construction', () => {
        const element = topbarItem.getElement();
        
        // Check main element
        expect(element).toBeDefined();
        expect(element.className).toBe('topbar-item wall-label-toggle');
        
        // Check button
        const button = element.querySelector('button');
        expect(button).toBeDefined();
        expect(button?.className).toBe('topbar-button');
        expect(button?.title).toBe('Toggle Wall Labels');
    });

    it('should emit toggle event on click', async () => {
        const button = topbarItem.getElement().querySelector('button');
        expect(button).toBeDefined();
        
        // Trigger click
        button?.click();
        
        // Verify event emission
        expect(mockEventManager.emit).toHaveBeenCalledWith('wall-label:toggle', {});
        
        // Verify button state changes
        expect(button?.innerHTML).toContain('Labels OFF');
        
        // Click again
        button?.click();
        expect(button?.innerHTML).toContain('Labels ON');
    });

    it('should initialize and dispose correctly', async () => {
        // Test initialization
        expect(mockLogger.info).toHaveBeenCalledWith('Wall Label Plugin initialized');
        
        // Test disposal
        await topbarItem.dispose();
        // Verify event listener cleanup
        const button = topbarItem.getElement().querySelector('button');
        button?.click();
        expect(mockEventManager.emit).not.toHaveBeenCalled();
    });

    it('should have correct manifest properties', () => {
        expect(topbarItem.id).toBe('wall-label-toggle');
        expect(topbarItem.manifest).toEqual({
            id: 'wall-label-toggle',
            name: 'Wall Labels',
            icon: '<span class="material-icons">straighten</span>',
            section: 'view',
            order: 100
        });
    });
}); 