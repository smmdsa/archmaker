import { EventManagerImpl } from '../../managers/EventManagerImpl';
import { ILogger } from '../../interfaces/ILogger';

describe('EventManagerImpl', () => {
    let eventManager: EventManagerImpl;
    let mockLogger: jest.Mocked<ILogger>;

    beforeEach(() => {
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            setPluginContext: jest.fn(),
            clearPluginContext: jest.fn()
        };
        eventManager = new EventManagerImpl(mockLogger);
    });

    it('should register event listener', () => {
        const callback = jest.fn();
        eventManager.on('test-event', callback);
        expect(eventManager.getListenerCount('test-event')).toBe(1);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('test-event'));
    });

    it('should remove event listener', () => {
        const callback = jest.fn();
        eventManager.on('test-event', callback);
        eventManager.off('test-event', callback);
        expect(eventManager.getListenerCount('test-event')).toBe(0);
    });

    it('should emit event to all listeners', async () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        const testData = { test: 'data' };

        eventManager.on('test-event', callback1);
        eventManager.on('test-event', callback2);

        await eventManager.emit('test-event', testData);

        expect(callback1).toHaveBeenCalledWith(testData);
        expect(callback2).toHaveBeenCalledWith(testData);
    });

    it('should handle async event listeners', async () => {
        const asyncCallback = jest.fn().mockImplementation(() => Promise.resolve());
        eventManager.on('async-event', asyncCallback);

        await eventManager.emit('async-event', 'test');
        expect(asyncCallback).toHaveBeenCalledWith('test');
    });

    it('should handle errors in event listeners', async () => {
        const errorCallback = jest.fn().mockImplementation(() => {
            throw new Error('Test error');
        });
        eventManager.on('error-event', errorCallback);

        await eventManager.emit('error-event', 'test');
        expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should clear all listeners', () => {
        const callback = jest.fn();
        eventManager.on('test-event-1', callback);
        eventManager.on('test-event-2', callback);

        eventManager.clearAllListeners();

        expect(eventManager.getListenerCount('test-event-1')).toBe(0);
        expect(eventManager.getListenerCount('test-event-2')).toBe(0);
    });
}); 