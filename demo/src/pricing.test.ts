import { describe, it, expect } from 'vitest';
import { applyTax } from './pricing';

describe('applyTax', () => {
  it('aplica imposto percentual', () => {
    expect(applyTax(100, 10)).toBe(110);
  });
  it('imposto zero mantém o preço', () => {
    expect(applyTax(50, 0)).toBe(50);
  });
  it('rejeita valores negativos', () => {
    expect(() => applyTax(-1, 10)).toThrow();
  });
});
