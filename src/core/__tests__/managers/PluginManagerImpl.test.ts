import { PluginManagerImpl } from '../../managers/PluginManagerImpl';
import { IPlugin } from '../../interfaces/IPlugin';
import { IEventManager } from '../../managers/EventManager';
import { ILogger } from '../../interfaces/ILogger';
import { IConfigManager } from '../../interfaces/IConfig';

describe('PluginManagerImpl', () => {
    let pluginManager: PluginManagerImpl;
    let eventManager: jest.Mocked<IEventManager>;
    let logger: jest.Mocked<ILogger>;
    let configManager: jest.Mocked<IConfigManager>;

    function createMockPlugin(id: string, deps: string[] = []): IPlugin {
        return {
            id,
            manifest: {
                id,
                name: `${id} Plugin`,
                version: '1.0.0',
                description: `Test plugin ${id}`,
                dependencies: deps
            },
            initialize: jest.fn().mockResolvedValue(undefined),
            dispose: jest.fn().mockResolvedValue(undefined)
        } as unknown as jest.Mocked<IPlugin>;
    }

    beforeEach(() => {
        eventManager = {
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn(),
            getListenerCount: jest.fn(),
            clearAllListeners: jest.fn()
        } as unknown as jest.Mocked<IEventManager>;

        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            setPluginContext: jest.fn(),
            clearPluginContext: jest.fn()
        } as jest.Mocked<ILogger>;

        configManager = {
            getPluginConfig: jest.fn().mockReturnValue({ enabled: true, settings: {} }),
            updatePluginConfig: jest.fn(),
            saveConfig: jest.fn(),
            loadConfig: jest.fn(),
            subscribe: jest.fn()
        } as unknown as jest.Mocked<IConfigManager>;

        pluginManager = new PluginManagerImpl(eventManager, logger, configManager);
    });

    it('should register a plugin successfully', () => {
        const plugin = createMockPlugin('test-plugin');
        pluginManager.register(plugin);
        expect(pluginManager.getPlugin('test-plugin')).toBeDefined();
    });

    it('should handle plugin dependencies', async () => {
        const dependency = createMockPlugin('dep-plugin');
        const mainPlugin = createMockPlugin('main-plugin', ['dep-plugin']);
        
        pluginManager.register(dependency);
        pluginManager.register(mainPlugin);
        
        await pluginManager.activatePlugins();
        
        expect(dependency.initialize).toHaveBeenCalled();
        expect(mainPlugin.initialize).toHaveBeenCalled();
    });

    it('should handle missing dependencies', () => {
        const plugin = createMockPlugin('test-plugin', ['missing-dep']);
        
        expect(() => {
            pluginManager.register(plugin);
        }).toThrow('Dependency missing-dep not found');
        
        expect(plugin.initialize).not.toHaveBeenCalled();
    });

    it('should handle disabled plugins', () => {
        const plugin = createMockPlugin('test-plugin');
        configManager.getPluginConfig.mockReturnValue({ enabled: false, settings: {} });
        
        pluginManager.register(plugin);
        
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('disabled'));
        expect(pluginManager.getPlugin('test-plugin')).toBeUndefined();
    });
}); 