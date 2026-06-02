/**
 * Módulo base (já existente no main) — serve de baseline de cobertura
 * para o repo ficar verde antes de o pipeline adicionar features.
 */

/** Aplica um imposto percentual a um preço, arredondado a 2 casas. */
export function applyTax(price: number, ratePct: number): number {
  if (price < 0 || ratePct < 0) {
    throw new Error('price e ratePct não podem ser negativos');
  }
  return Math.round(price * (1 + ratePct / 100) * 100) / 100;
}
