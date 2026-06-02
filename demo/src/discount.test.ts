import { describe, it, expect } from 'vitest';
import { applyDiscount } from './discount';

// Testes derivados dos EXEMPLOS do spec "apply-discount" — validação não-circular:
// os casos vêm da especificação, não de quem gerou a implementação.
describe('applyDiscount — spec apply-discount', () => {
  it('applyDiscount(100, 10) => 90', () => { expect(applyDiscount(100, 10)).toBe(90); });
  it('applyDiscount(50, 0) => 50', () => { expect(applyDiscount(50, 0)).toBe(50); });
  it('applyDiscount(200, 100) => 0', () => { expect(applyDiscount(200, 100)).toBe(0); });
  it('applyDiscount(-1, 10) => throws', () => { expect(() => applyDiscount(-1, 10)).toThrow(); });
});
