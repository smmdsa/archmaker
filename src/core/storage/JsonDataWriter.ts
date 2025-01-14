import { IDataWriter, ProjectData } from './interfaces';

/**
 * Implements project data serialization to JSON format
 */
export class JsonDataWriter implements IDataWriter {
    constructor(private readonly pretty: boolean = true) {}

    /**
     * Write project data to JSON string
     * @param data The project data to serialize
     * @returns JSON string representation of the project data
     */
    write(data: ProjectData): string {
        try {
            return JSON.stringify(data, null, this.pretty ? 2 : 0);
        } catch (error) {
            throw new Error(`Failed to serialize project data to JSON: ${(error as Error).message}`);
        }
    }

    /**
     * Get the format of this writer
     */
    getFormat(): 'json' | 'yaml' {
        return 'json';
    }
} 