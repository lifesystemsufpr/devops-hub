---
id: apply-discount
title: Aplicar desconto percentual
area: general
module: discount
export: applyDiscount
---

## Descrição

Adicionar uma função `applyDiscount(price, pct)` que devolve o preço com um
desconto percentual aplicado, arredondado a 2 casas decimais.

## Regras

- `price` deve ser >= 0.
- `pct` deve estar entre 0 e 100.
- Fora disso, lançar erro.

## Exemplos

- applyDiscount(100, 10) => 90
- applyDiscount(50, 0) => 50
- applyDiscount(200, 100) => 0
- applyDiscount(-1, 10) => throws
