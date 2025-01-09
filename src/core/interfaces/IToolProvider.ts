import { IPlugin } from './IPlugin';

export interface Tool {
    id: string;
    name: string;
    icon: string;
    tooltip: string;
    section: string;
    order: number;
}

export interface IToolProvider extends IPlugin {
    getTools(): Tool[];
    activateTool(toolId: string): Promise<void>;
    deactivateTool(toolId: string): Promise<void>;
    isToolActive(toolId: string): boolean;
} 