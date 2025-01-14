export class GlobalStyles {
    private static instance: GlobalStyles;
    private styleElement: HTMLStyleElement;

    private constructor() {
        this.styleElement = document.createElement('style');
        document.head.appendChild(this.styleElement);
        this.initializeStyles();
    }

    static getInstance(): GlobalStyles {
        if (!GlobalStyles.instance) {
            GlobalStyles.instance = new GlobalStyles();
        }
        return GlobalStyles.instance;
    }

    private initializeStyles(): void {
        this.styleElement.textContent = `
            /* Variables globales */
            :root {
                --primary-color: #007bff;
                --secondary-color: #6c757d;
                --success-color: #28a745;
                --danger-color: #dc3545;
                --background-color: #ffffff;
                --border-color: #ddd;
                --text-primary: #333;
                --text-secondary: #666;
                --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
                --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
                --radius-sm: 4px;
                --radius-md: 8px;
                --spacing-xs: 4px;
                --spacing-sm: 8px;
                --spacing-md: 12px;
                --spacing-lg: 16px;
                --font-size-sm: 12px;
                --font-size-md: 14px;
                --font-size-lg: 16px;
            }

            /* Estilos base para paneles */
            .base-panel {
                padding: var(--spacing-lg);
                background: var(--background-color);
                border-radius: var(--radius-md);
                box-shadow: var(--shadow-sm);
            }

            /* Estilos para grupos de propiedades */
            .property-group {
                margin-bottom: var(--spacing-md);
            }

            .property-group label {
                display: flex;
                flex-direction: column;
                gap: var(--spacing-xs);
                font-size: var(--font-size-md);
                color: var(--text-secondary);
            }

            /* Estilos para inputs y selects */
            .input-base {
                padding: var(--spacing-sm);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-sm);
                font-size: var(--font-size-md);
                background: var(--background-color);
            }

            .input-base:focus {
                outline: none;
                border-color: var(--primary-color);
            }

            /* Estilos para títulos */
            .title-lg {
                margin: 0 0 var(--spacing-lg) 0;
                font-size: var(--font-size-lg);
                color: var(--text-primary);
            }

            .title-md {
                margin: 0 0 var(--spacing-md) 0;
                font-size: var(--font-size-md);
                color: var(--text-secondary);
            }

            /* Estilos para grupos de configuración */
            .config-group {
                padding: var(--spacing-md);
                background: #f8f9fa;
                border-radius: var(--radius-sm);
                margin-bottom: var(--spacing-lg);
            }
        `;
    }

    // Método para añadir estilos adicionales en tiempo de ejecución
    addStyles(styles: string): void {
        this.styleElement.textContent += styles;
    }

    // Método para obtener variables CSS
    getVariable(name: string): string {
        return getComputedStyle(document.documentElement).getPropertyValue(name);
    }

    // Método para establecer variables CSS
    setVariable(name: string, value: string): void {
        document.documentElement.style.setProperty(name, value);
    }
} 