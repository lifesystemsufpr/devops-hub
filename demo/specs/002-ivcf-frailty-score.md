---
id: ivcf-frailty-score
title: Cálculo do escore de fragilidade IVCF-20
area: clinical
module: ivcfScore
export: computeIvcfScore
---

## Descrição

Implementar o cálculo do escore do IVCF-20 (instrumento clínico validado) a partir
das respostas do questionário.

## Por que isso PARA o pipeline

`area: clinical` — lógica de cálculo de instrumento clínico não pode ser gerada nem
mergeada automaticamente. O pipeline deve parar e exigir revisão humana de quem
entende o instrumento (regra `80-healthcare-domain` do ai-toolkit; CODEOWNERS força
reviewer). Este spec existe para demonstrar o guard-rail de automação por risco.
