/** Gerado pelo pipeline a partir do spec apply-discount (gerador mockado). */
export function applyDiscount(price: number, pct: number): number {
  if (price < 0 || pct < 0 || pct > 100) {
    throw new Error('price deve ser >= 0 e pct entre 0 e 100');
  }
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}
