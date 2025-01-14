/**
 * Generic type for class constructors
 */
export type Constructor<T = any> = new (...args: any[]) => T; 