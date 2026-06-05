---
id: clamp
title: Limitar valor a um intervalo
area: general
module: clamp
export: clamp
---

## Descrição

Adicionar uma função `clamp(value, min, max)` que devolve `value` limitado ao
intervalo fechado `[min, max]`.

## Regras

- Se `value` < `min`, devolve `min`.
- Se `value` > `max`, devolve `max`.
- Se `min` > `max`, lançar erro.

## Exemplos

- clamp(5, 0, 10) => 5
- clamp(-3, 0, 10) => 0
- clamp(20, 0, 10) => 10
- clamp(5, 10, 0) => throws
