// Mock HTMLElement for DOM testing
class MockElement {
    constructor() {
        this.children = [];
        this.classList = {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn(),
            toggle: jest.fn()
        };
        this.style = {};
        this.addEventListener = jest.fn();
        this.removeEventListener = jest.fn();
        this.appendChild = jest.fn(child => this.children.push(child));
        this.querySelector = jest.fn();
    }
}

// Mock document methods
global.document = {
    createElement: jest.fn(() => new MockElement()),
    querySelector: jest.fn()
};

// Mock window methods
global.window = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
}; 