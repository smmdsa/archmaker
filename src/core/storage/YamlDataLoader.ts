import { load } from 'js-yaml';
import { IDataLoader, ProjectData } from './interfaces';
import { JsonDataLoader } from './JsonDataLoader';

/**
 * Implements project data loading from YAML format
 */
export class YamlDataLoader implements IDataLoader {
    private readonly jsonLoader: JsonDataLoader;

    constructor() {
        // We'll reuse JSON validation logic since the structure is the same
        this.jsonLoader = new JsonDataLoader();
    }

    /**
     * Load project data from YAML string
     * @param data The YAML string to parse
     * @returns Parsed project data
     */
    load(data: string): ProjectData {
        try {
            const parsed = load(data) as any;
            // Reuse JSON validation since the structure requirements are the same
            this.jsonLoader.validate(JSON.stringify(parsed));
            return parsed as ProjectData;
        } catch (error) {
            throw new Error(`Failed to parse YAML project data: ${(error as Error).message}`);
        }
    }

    /**
     * Validate if the string is valid YAML and contains required project data
     * @param data The string to validate
     * @returns true if valid, false otherwise
     */
    validate(data: string): boolean {
        try {
            const parsed = load(data);
            // Reuse JSON validation since the structure requirements are the same
            return this.jsonLoader.validate(JSON.stringify(parsed));
        } catch {
            return false;
        }
    }
} 