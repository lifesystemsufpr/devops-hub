# Roteiro de apresentação — Pipeline de automação (MVP)

> Demonstra o ciclo **spec → geração de código → validação → PR → CI**, com
> **automação por risco** (guard-rail de saúde). Vive em `devops-hub/demo`.
> A única parte mockada é a geração por IA (o pedaço que, em produção, chama o
> Claude/Cursor SDK). Branch, PR e CI são **reais**.

## A história em 1 frase

"Uma especificação vira código testado, com PR aberto e CI verde automaticamente —
e, quando a mudança é clínica/auth/schema, o pipeline **para** e exige revisão humana."

## Os 3 pilares (já no ar na org)

| Pilar | Repo | O que faz |
|---|---|---|
| Regras de IA | [ai-toolkit](https://github.com/lifesystemsufpr/ai-toolkit) | Fonte neutra → Cursor + Claude Code + Copilot |
| CI central | [devops-hub](https://github.com/lifesystemsufpr/devops-hub) | Workflows reutilizáveis (hub-and-spoke) |
| Pipeline | `devops-hub/demo` | spec → código → PR → CI (este demo) |

## Roteiro (rodar de dentro de `devops-hub/demo`)

```bash
cd demo
npm install        # primeira vez
```

### 1. Caso rotineiro — validação local (sem abrir PR)

```bash
npm run pipeline -- specs/001-apply-discount.md --dry
```
Mostra: lê o spec → **gera** `src/discount.ts` + teste (derivado dos exemplos do
spec) → roda typecheck + testes + cobertura (100%) → limpa. O "cérebro" é mockado.

### 2. Caso rotineiro — ponta a ponta (PR + CI de verdade)

```bash
npm run pipeline -- specs/001-apply-discount.md
```
Mostra: o mesmo, mas abre **PR real** no `devops-hub` e acompanha o **CI** (job
`demo`) ficar verde. Exemplo já rodado: PR #1 do devops-hub.

### 3. Guard-rail — automação por risco

```bash
npm run pipeline -- specs/002-ivcf-frailty-score.md
```
Mostra: o spec é `area: clinical` → o pipeline **PARA antes de gerar** e pede
revisão humana. É a regra `80-healthcare-domain` na prática: software de saúde não
admite full-autopilot.

## O que é real x mockado

| Parte | Estado |
|---|---|
| Spec como fonte da verdade | real |
| Geração do código | **mockada** — seam em `pipeline/generator.ts` (`CANNED_IMPLS`) |
| Testes derivados do spec | real (validação não-circular) |
| Branch / commit / PR | real (via `gh`) |
| CI | real — job `demo` no `.github/workflows/ci.yml` do devops-hub |
| Guard-rail de saúde | real |

## Como vira produção (o seam)

Trocar o mapa `CANNED_IMPLS` em `pipeline/generator.ts` por uma chamada ao agente
(**Claude Agent SDK** ou **Cursor SDK**), passando o spec + as regras do `ai-toolkit`
como contexto. O disparo deixa de ser `npm run pipeline` e passa a ser uma **task do
ClickUp** (integração nativa ClickUp↔Cursor) ou uma issue (Copilot coding agent).
Nada mais do fluxo muda: validação, PR e CI continuam iguais.
