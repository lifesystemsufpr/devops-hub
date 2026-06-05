# demo — pipeline de automação

Demonstração do pipeline de automação da plataforma `lifesystemsufpr`:
**spec → geração de código → validação → PR → CI** — com automação por risco.
Vive em `devops-hub/demo`. Roteiro de apresentação em [DEMO.md](DEMO.md).

```
specs/*.md  ──▶  pipeline/run-pipeline.ts  ──▶  src/<feature>.ts + testes  ──▶  PR  ──▶  CI (devops-hub)
   (o quê)         (orquestrador)               (geração MOCKADA)             (gh)     (hub-and-spoke)
```

## O que é real e o que é mockado

| Parte | Estado |
|---|---|
| Spec como fonte da verdade | real (markdown com frontmatter + exemplos) |
| Geração do código | **dois back-ends** — `claude` CLI (real) ou mock canônico, atrás do mesmo seam |
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

# outra rotina (clamp) — prova o fluxo ponta a ponta com uma spec nova
npm run pipeline -- specs/003-clamp.md --dry

# clínico: guard-rail PARA antes de gerar
npm run pipeline -- specs/002-ivcf-frailty-score.md
```

## Gerador: mock vs. claude (seam real)

O seam de geração é a função `generate()` em `pipeline/generator.ts`, com dois
back-ends selecionados pela env `PIPELINE_GENERATOR`:

| Modo | Comportamento |
|---|---|
| `mock` | implementação canônica por id de spec (determinístico). Usado nos testes e no CI. |
| `claude` | chama o `claude` CLI headless (`claude -p`) passando o spec como prompt e extraindo o bloco de código TS. Exige o CLI **autenticado**. |
| `auto` *(default)* | usa `claude` se disponível; **cai no mock** se o CLI não existir ou falhar (ex.: sem auth). |

```bash
# gerar de verdade com o claude CLI (precisa de `claude` autenticado na máquina)
PIPELINE_GENERATOR=claude npm run pipeline -- specs/001-apply-discount.md --dry
```

Em qualquer modo, **os testes são derivados dos exemplos do spec** (não do código
gerado) — então a validação não é circular: se o `claude` gerar algo errado, os
testes derivados quebram e o pipeline falha.

> Auth: o gerador `claude` usa a sessão já existente do CLI (`claude` na sua máquina)
> — **sem API key nova**. No CI o `claude` não está instalado, então o modo efetivo é
> `mock` (o CI valida o *pipeline*, não a geração por IA). Sem auth, a chamada retorna
> rápido (401) e o `auto` cai no mock. O timeout da chamada é configurável via
> `CLAUDE_TIMEOUT_MS` (default 120000).

## Produção

Em produção o modo `claude` (ou um Agent/Cursor SDK) recebe o spec + as regras do
`ai-toolkit` como contexto, e o disparo vem de uma task do ClickUp (integração nativa
ClickUp↔Cursor) em vez de `npm run pipeline`.
