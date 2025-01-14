import { LoggerImpl } from '../../managers/LoggerImpl';

describe('LoggerImpl', () => {
    let logger: LoggerImpl;

    beforeEach(() => {
        logger = new LoggerImpl(true);
        jest.spyOn(console, 'debug').mockImplementation();
        jest.spyOn(console, 'info').mockImplementation();
        jest.spyOn(console, 'warn').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should log debug messages when debug is enabled', () => {
        logger.debug('test debug message');
        const call = (console.debug as jest.Mock).mock.calls[0][0];
        expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] DEBUG:/);
    });

    it('should not log debug messages when debug is disabled', () => {
        const prodLogger = new LoggerImpl(false);
        prodLogger.debug('test debug message');
        expect(console.debug).not.toHaveBeenCalled();
    });

    it('should log info messages', () => {
        logger.info('test info message');
        const call = (console.info as jest.Mock).mock.calls[0][0];
        expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] INFO:/);
    });

    it('should log warning messages', () => {
        logger.warn('test warning message');
        const call = (console.warn as jest.Mock).mock.calls[0][0];
        expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] WARN:/);
    });

    it('should log error messages with error object', () => {
        const error = new Error('test error');
        logger.error('test error message', error);
        const call = (console.error as jest.Mock).mock.calls[0];
        expect(call[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] ERROR:/);
        expect(call[1]).toBe(error);
    });

    it('should include plugin context in log messages when set', () => {
        const pluginId = 'test-plugin';
        logger.setPluginContext(pluginId);
        logger.info('test message');
        
        const call = (console.info as jest.Mock).mock.calls[0][0];
        expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] INFO \[test-plugin\]:/);
    });

    it('should clear plugin context', () => {
        logger.setPluginContext('test-plugin');
        logger.clearPluginContext();
        logger.info('test message');
        
        const call = (console.info as jest.Mock).mock.calls[0][0];
        expect(call).not.toMatch(/\[test-plugin\]/);
    });

    it('should maintain log history within MAX_LOG_ENTRIES limit', () => {
        const maxEntries = 1000;
        for (let i = 0; i < maxEntries + 10; i++) {
            logger.info(`test message ${i}`);
        }
        
        expect(logger.getLogEntries().length).toBeLessThanOrEqual(maxEntries);
    });

    it('should clear log entries', () => {
        logger.info('test message');
        logger.clearLogEntries();
        expect(logger.getLogEntries().length).toBe(0);
    });

    it('should format timestamps correctly', () => {
        const mockDate = new Date('2024-01-01T12:00:00Z');
        jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
        
        logger.info('test message');
        
        const call = (console.info as jest.Mock).mock.calls[0][0];
        expect(call).toContain(mockDate.toISOString());
    });
}); 