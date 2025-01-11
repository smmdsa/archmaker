export interface ITopbarManifest {
    id: string;
    name: string;
    icon: string;
    section: string;
    order: number;
    tooltip?: string;
    shortcut?: string;
}

export interface ITopbarItem {
    id: string;
    manifest: ITopbarManifest;
    initialize(): void;
    dispose(): void;
} 