# dashboard

Painel de **status e ações** da plataforma `lifesystemsufpr` (Next.js).
Para PM/PO acompanharem CI, PRs e o pipeline — além do ClickUp.

## O que mostra / faz

- **Status** dos 7 repos de produto + 2 de infra: estado do CI, PRs abertos, último run.
- **Specs** do pipeline (`devops-hub/demo/specs`) com badge de área; **guard-rail** bloqueia specs sensíveis (clínico/auth/schema).
- **Acionar** o pipeline por clique → dispara `pipeline.yml` via `workflow_dispatch` (roda no GitHub Actions).
- **Atividade** recente do devops-hub (runs de CI/pipeline).

## Rodar local

```bash
npm install
$env:GITHUB_TOKEN = (gh auth token)   # PowerShell; ou export no bash
npm run dev                            # http://localhost:3000
```

## Variáveis de ambiente

| Var | Para quê |
|---|---|
| `GITHUB_TOKEN` | Ler status (Actions/PRs) e disparar o pipeline. **Obrigatório** (sem ele, o GitHub limita a 60 req/h). |
| `DASHBOARD_SECRET` | Opcional. Se setado, o acionar exige o header `x-dashboard-secret` (campo "token de ação" no topo do painel). |

## Deploy na Vercel (import Git — recomendado)

1. vercel.com → **Add New… → Project** → importe `lifesystemsufpr/devops-hub`.
2. **Root Directory = `dashboard`** (Vercel detecta Next.js automaticamente).
3. **Environment Variables:**
   - `GITHUB_TOKEN` = PAT fine-grained (escopos abaixo).
   - `DASHBOARD_SECRET` = um segredo à sua escolha (protege o acionar).
4. Deploy. Auto-redeploy a cada push no `main`.

### PAT fine-grained (mínimo)

- **Resource owner:** `lifesystemsufpr` · **Repositories:** os 9 (7 produto + devops-hub + ai-toolkit).
- **Permissions:** Metadata: Read · Contents: Read · Pull requests: Read · **Actions: Read and write** (o write é p/ o `workflow_dispatch` no devops-hub).

> Dica: proteja a URL (Vercel → Settings → Deployment Protection) se quiser restringir quem vê.

## Specs novos abrirem PR (secret `PIPELINE_TOKEN`)

A org bloqueia o `GITHUB_TOKEN` do Actions de **criar PR novo**. Specs já existentes
reusam o PR e funcionam sem nada. Para **specs novos** (branch novo) abrirem PR pelo
pipeline, adicione no `devops-hub` um secret **`PIPELINE_TOKEN`**
(Settings → Secrets and variables → Actions → New repository secret) com um PAT que
tenha **Contents: Read and write** e **Pull requests: Read and write** no `devops-hub`.
O `pipeline.yml` já usa esse secret automaticamente quando presente (fallback no token padrão).

