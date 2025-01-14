import { IDataLoader, ProjectData } from './interfaces';

/**
 * Implements project data loading from JSON format
 */
export class JsonDataLoader implements IDataLoader {
    /**
     * Load project data from JSON string
     * @param data The JSON string to parse
     * @returns Parsed project data
     */
    load(data: string): ProjectData {
        try {
            const parsed = JSON.parse(data);
            this.validateProjectData(parsed);
            return parsed;
        } catch (error) {
            throw new Error(`Failed to parse JSON project data: ${(error as Error).message}`);
        }
    }

    /**
     * Validate if the string is valid JSON and contains required project data
     * @param data The string to validate
     * @returns true if valid, false otherwise
     */
    validate(data: string): boolean {
        try {
            const parsed = JSON.parse(data);
            this.validateProjectData(parsed);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate the structure of parsed project data
     * @throws Error if validation fails
     */
    private validateProjectData(data: any): void {
        // Check required top-level properties
        if (!data || typeof data !== 'object') {
            throw new Error('Project data must be an object');
        }

        if (!data.metadata || typeof data.metadata !== 'object') {
            throw new Error('Project data must contain metadata object');
        }

        if (!data.settings || typeof data.settings !== 'object') {
            throw new Error('Project data must contain settings object');
        }

        if (!data.canvas || typeof data.canvas !== 'object') {
            throw new Error('Project data must contain canvas object');
        }

        // Validate metadata
        const requiredMetadataFields = ['id', 'name', 'version', 'created', 'lastModified'];
        for (const field of requiredMetadataFields) {
            if (typeof data.metadata[field] !== 'string') {
                throw new Error(`Metadata must contain string field: ${field}`);
            }
        }

        // Validate canvas data arrays
        const requiredCanvasArrays = ['walls', 'doors', 'windows', 'rooms'];
        for (const arrayName of requiredCanvasArrays) {
            if (!Array.isArray(data.canvas[arrayName])) {
                throw new Error(`Canvas must contain array: ${arrayName}`);
            }
        }

        // Validate settings
        const requiredNumberSettings = [
            'scale', 'gridSize', 'defaultWallHeight', 'defaultWallThickness',
            'defaultDoorHeight', 'defaultDoorWidth', 'defaultWindowHeight',
            'defaultWindowWidth', 'defaultWindowSillHeight'
        ];
        
        for (const field of requiredNumberSettings) {
            if (typeof data.settings[field] !== 'number') {
                throw new Error(`Settings must contain number field: ${field}`);
            }
        }

        if (typeof data.settings.units !== 'string') {
            throw new Error('Settings must contain string field: units');
        }

        if (typeof data.settings.snapToGrid !== 'boolean') {
            throw new Error('Settings must contain boolean field: snapToGrid');
        }
    }
} 