import { ILogger, LogLevel, LogEntry } from '../interfaces/ILogger';

export class LoggerImpl implements ILogger {
    private currentPluginId?: string;
    private logEntries: LogEntry[] = [];
    private readonly MAX_LOG_ENTRIES = 1000;
    private readonly isDebugEnabled: boolean;

    constructor(isDebugEnabled: boolean = false) {
        this.isDebugEnabled = isDebugEnabled;
    }

    public debug(message: string, ...args: any[]): void {
        if (this.isDebugEnabled) {
            this.log('debug', message, args);
        }
    }

    public info(message: string, ...args: any[]): void {
        this.log('info', message, args);
    }

    public warn(message: string, ...args: any[]): void {
        this.log('warn', message, args);
    }

    public error(message: string, error?: Error): void {
        this.log('error', message, [], error);
    }

    public setPluginContext(pluginId: string): void {
        this.currentPluginId = pluginId;
    }

    public clearPluginContext(): void {
        this.currentPluginId = undefined;
    }

    public getLogEntries(): LogEntry[] {
        return [...this.logEntries];
    }

    public clearLogEntries(): void {
        this.logEntries = [];
    }

    private log(level: LogLevel, message: string, args: any[] = [], error?: Error): void {
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date(),
            pluginId: this.currentPluginId,
            error,
            data: args.length > 0 ? args : undefined
        };

        // Añadir entrada al registro
        this.logEntries.push(entry);

        // Mantener un límite de entradas
        if (this.logEntries.length > this.MAX_LOG_ENTRIES) {
            this.logEntries.shift();
        }

        // Formatear mensaje para consola
        let consoleMessage = `[${entry.timestamp.toISOString()}] ${level.toUpperCase()}`;
        if (entry.pluginId) {
            consoleMessage += ` [${entry.pluginId}]`;
        }
        consoleMessage += `: ${message}`;

        // Imprimir en consola según el nivel
        switch (level) {
            case 'debug':
                console.debug(consoleMessage, ...args);
                break;
            case 'info':
                console.info(consoleMessage, ...args);
                break;
            case 'warn':
                console.warn(consoleMessage, ...args);
                break;
            case 'error':
                console.error(consoleMessage, error || '', ...args);
                break;
        }
    }
} 