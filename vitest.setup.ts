import { beforeEach } from 'vitest';
import { vi } from 'vitest';

// Mock HTMLElement
class MockElement {
    children: any[] = [];
    classList = {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
        toggle: vi.fn()
    };
    style = {};
    innerHTML = '';
    className = '';
    private _title = '';
    private _button: MockElement | null = null;
    
    get title(): string {
        return this._title;
    }
    
    set title(value: string) {
        this._title = value;
    }
    
    // Event handling
    private eventHandlers: { [key: string]: Function[] } = {};
    
    addEventListener(event: string, handler: Function): void {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(handler);
    }
    
    removeEventListener(event: string, handler: Function): void {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
        }
    }
    
    click(): void {
        if (this.eventHandlers['click']) {
            this.eventHandlers['click'].forEach(handler => handler.call(this));
        }
    }
    
    appendChild(child: any): void {
        this.children.push(child);
        if (child instanceof MockElement) {
            this._button = child;
        }
    }
    
    querySelector(selector: string): MockElement | null {
        // Return the actual button instance if it exists
        if (selector === 'button' && this._button) {
            return this._button;
        }
        return null;
    }
}

// Setup global mocks before each test
beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock document
    global.document = {
        createElement: vi.fn((tag: string) => {
            const element = new MockElement();
            if (tag === 'button') {
                element.className = 'topbar-button';
                element.title = 'Toggle Wall Labels';
            }
            return element;
        }),
        querySelector: vi.fn()
    } as any;

    // Mock window
    global.window = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
    } as any;
}); 