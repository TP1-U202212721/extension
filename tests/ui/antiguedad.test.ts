import { describe, expect, it } from 'vitest';
import { antiguedadLegible } from '../../src/ui/VerdictPanel.js';

/** "5743 dias" no le dice nada a nadie; en anios y meses, si. */
describe('antiguedad del vendedor, legible', () => {
  it('en anios y meses cuando pasa del anio', () => {
    expect(antiguedadLegible(5743)).toBe('15 años y 8 meses');
    expect(antiguedadLegible(365)).toBe('1 año');
  });

  it('en meses cuando no llega al anio', () => {
    expect(antiguedadLegible(95)).toBe('3 meses');
    expect(antiguedadLegible(31)).toBe('1 mes');
  });

  it('en dias cuando es reciente, que es justo lo que importa vigilar', () => {
    expect(antiguedadLegible(1)).toBe('1 día');
    expect(antiguedadLegible(12)).toBe('12 días');
  });

  it('un valor imposible no se presenta como dato', () => {
    expect(antiguedadLegible(-3)).toBe('No se pudo leer');
  });
});
