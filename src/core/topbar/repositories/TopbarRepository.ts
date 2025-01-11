import { ITopbarItem } from '../interfaces/ITopbarItem';

export class TopbarRepository {
    private static instance: TopbarRepository;
    private items: Map<string, ITopbarItem>;

    private constructor() {
        this.items = new Map();
    }

    static getInstance(): TopbarRepository {
        if (!TopbarRepository.instance) {
            TopbarRepository.instance = new TopbarRepository();
        }
        return TopbarRepository.instance;
    }

    registerItem(item: ITopbarItem): void {
        if (this.items.has(item.id)) {
            console.warn(`Topbar item with id ${item.id} is already registered. Skipping registration.`);
            return;
        }
        console.log('Topbar item registered', item);
        this.items.set(item.id, item);
    }

    unregisterItem(itemId: string): void {
        const item = this.items.get(itemId);
        if (item) {
            item.dispose();
            this.items.delete(itemId);
        }
    }

    getItem(itemId: string): ITopbarItem | undefined {
        return this.items.get(itemId);
    }

    getAllItems(): ITopbarItem[] {
        return Array.from(this.items.values());
    }

    getItemsBySection(section: string): ITopbarItem[] {
        return this.getAllItems()
            .filter(item => item.manifest.section === section)
            .sort((a, b) => a.manifest.order - b.manifest.order);
    }

    getSections(): string[] {
        const sections = new Set<string>();
        this.getAllItems().forEach(item => sections.add(item.manifest.section));
        return Array.from(sections);
    }

    clear(): void {
        this.items.forEach(item => item.dispose());
        this.items.clear();
    }
} 