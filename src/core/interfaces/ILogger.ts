export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    pluginId?: string;
    error?: Error;
    data?: unknown;
}

export interface ILogger {
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, error?: Error): void;
    setPluginContext(pluginId: string): void;
    clearPluginContext(): void;
} 