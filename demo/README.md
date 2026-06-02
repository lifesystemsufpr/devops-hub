# pipeline-demo

Demonstração do pipeline de automação da plataforma `lifesystemsufpr`:
**spec → geração de código → validação → PR → CI** — com automação por risco.

```
specs/*.md  ──▶  pipeline/run-pipeline.ts  ──▶  src/<feature>.ts + testes  ──▶  PR  ──▶  CI (devops-hub)
   (o quê)         (orquestrador)               (geração MOCKADA)             (gh)     (hub-and-spoke)
```

## O que é real e o que é mockado

| Parte | Estado |
|---|---|
| Spec como fonte da verdade | real (markdown com frontmatter + exemplos) |
| Geração do código | **mockada** — `pipeline/generator.ts` tem o seam p/ Claude/Cursor SDK |
| Testes derivados do spec | real (gerados a partir dos exemplos — validação não-circular) |
| Branch, commit, PR | real (via `gh`) |
| CI | real — consome o workflow reutilizável do `devops-hub` (`.github/workflows/ci.yml`) |
| Guard-rail de saúde | real — specs `area: clinical/auth/schema` param o pipeline |

## Rodar

```bash
npm install

# rotineiro: gera, testa, abre PR e acompanha o CI
npm run pipeline -- specs/001-apply-discount.md

# só validar local (sem PR)
npm run pipeline -- specs/001-apply-discount.md --dry

# clínico: guard-rail PARA antes de gerar
npm run pipeline -- specs/002-ivcf-frailty-score.md
```

## Produção (seam)

Trocar o mapa `CANNED_IMPLS` em `pipeline/generator.ts` por uma chamada ao agente
(Claude Agent SDK ou Cursor SDK), passando o spec + as regras do `ai-toolkit` como
contexto. O disparo, em produção, vem de uma task do ClickUp (integração nativa
ClickUp↔Cursor) em vez de `npm run pipeline`.
