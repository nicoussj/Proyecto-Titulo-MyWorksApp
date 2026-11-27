/**
 * Las pruebas de src/**\/*.test.ts usan node:test y siguen corriendo con node --test.
 * Vitest las vuelve a correr con este puente para medir toda la cobertura con la misma herramienta.
 */
import { describe, it, test } from 'vitest';

export { describe, it, test };
export default test;
