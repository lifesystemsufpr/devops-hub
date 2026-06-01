# devops-hub

Plataforma central de CI/CD, governança e métricas para os repositórios da org [`lifesystemsufpr`](https://github.com/orgs/lifesystemsufpr/repositories).

## O que tem aqui

```
.github/workflows/    Workflows reutilizáveis (workflow_call) consumidos pelos 7 repos
scripts/              Scripts de automação (bootstrap, branch protection)
templates/            Arquivos copiados pra cada repo (ci.yml, CODEOWNERS, PR template, etc.)
```

## Repositórios gerenciados

| Repo | Tipo | Workflow |
|---|---|---|
| auth-service | Node backend | `ci-node-backend.yml` |
| tecnoaging-back | Node backend | `ci-node-backend.yml` |
| ivcf-back | Node backend | `ci-node-backend.yml` |
| tecnoaging-front | Node frontend (Next.js) | `ci-node-frontend.yml` |
| ivcf-front | Node frontend (Next.js) | `ci-node-frontend.yml` |
| ivcf-mobile | Node mobile (RN/Expo) | `ci-node-mobile.yml` |
| equilibrium-mobile | Kotlin (Android) | `ci-kotlin.yml` |

Detalhes por repo em [`scripts/repos.config.ts`](scripts/repos.config.ts).

## Pré-requisitos

- Node 22+
- pnpm (recomendado) ou npm
- Um Personal Access Token (PAT) com escopos `repo` e `workflow`. Recomendado: PAT fine-grained com acesso só aos 7 repos da org.

## Setup

```bash
pnpm install
cp .env.example .env  # adicionar GITHUB_TOKEN
```

## Uso

### Aplicar templates de CI em todos os repos (abre 1 PR por repo)

```bash
# Dry-run (não escreve nada)
pnpm bootstrap:dry

# Para valer
GITHUB_TOKEN=ghp_xxx pnpm bootstrap

# Só um repo
GITHUB_TOKEN=ghp_xxx pnpm bootstrap auth-service
```

### Aplicar branch protection

Rode **depois** que os PRs de bootstrap forem merged (caso contrário a proteção pode bloquear o próprio bootstrap).

```bash
pnpm protect:dry
GITHUB_TOKEN=ghp_xxx pnpm protect
```

## Como adicionar um novo repo

1. Adiciona uma entrada em `scripts/repos.config.ts`.
2. Roda `pnpm bootstrap <nome-do-repo>`.
3. Faz merge do PR gerado.
4. Roda `pnpm protect`.

## Atualizar um workflow

1. Edita `.github/workflows/ci-*.yml` neste repo.
2. Commit + merge em `main`.
3. Os 7 repos consumidores pegam a nova versão **automaticamente** no próximo run (pinned em `@main`).

Pra pinning seguro, troque `@main` por `@<sha>` ou `@v1` nos templates em `templates/.github/workflows/`.

## Próximas etapas (roadmap)

- [ ] `apps/dashboard` — Next.js consumindo GitHub API
- [ ] `scripts/generate-tests.ts` — agente Claude pra cobertura automatizada
- [ ] GitHub App próprio com Claude para AI code review
- [ ] Coletor de métricas DORA
