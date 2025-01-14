// Jest setup file
import '@testing-library/jest-dom';

// Extend expect matchers if needed
expect.extend({
    toBeWithinRange(received: number, floor: number, ceiling: number) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () =>
                    `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true,
            };
        } else {
            return {
                message: () =>
                    `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false,
            };
        }
    },
});

// Global test setup
beforeAll(() => {
    // Setup global test environment
    jest.useFakeTimers();
});

afterAll(() => {
    // Cleanup global test environment
    jest.useRealTimers();
});

// Global mocks
const consoleMock = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
};

// @ts-ignore
global.console = {
    ...console,
    ...consoleMock
}; 