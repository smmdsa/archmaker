import { dump } from 'js-yaml';
import { IDataWriter, ProjectData } from './interfaces';

/**
 * Implements project data serialization to YAML format
 */
export class YamlDataWriter implements IDataWriter {
    constructor(private readonly indent: number = 2) {}

    /**
     * Write project data to YAML string
     * @param data The project data to serialize
     * @returns YAML string representation of the project data
     */
    write(data: ProjectData): string {
        try {
            return dump(data, {
                indent: this.indent,
                lineWidth: -1, // Disable line wrapping
                noRefs: true, // Don't output YAML references
                sortKeys: true // Sort object keys for consistency
            });
        } catch (error) {
            throw new Error(`Failed to serialize project data to YAML: ${(error as Error).message}`);
        }
    }

    /**
     * Get the format of this writer
     */
    getFormat(): 'json' | 'yaml' {
        return 'yaml';
    }
} 