// Configuración global para tests
beforeEach(() => {
    // Limpiar cualquier estilo global que se haya agregado
    const styles = document.querySelectorAll('style');
    styles.forEach(style => style.remove());
});

// Extender expect para incluir matchers DOM personalizados si es necesario
expect.extend({
    toHaveStyle(element: HTMLElement, style: string) {
        const computedStyle = window.getComputedStyle(element);
        const pass = style.split(';').every(rule => {
            const [property, value] = rule.split(':').map(s => s.trim());
            return computedStyle[property as any] === value;
        });

        return {
            pass,
            message: () =>
                `expected element ${pass ? 'not ' : ''}to have style "${style}"`
        };
    }
}); 