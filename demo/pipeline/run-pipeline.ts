import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseSpec, generate, isSensitiveArea } from './generator.js';

/**
 * Orquestrador do pipeline: spec -> (geração mockada) -> validação -> PR -> CI.
 *
 * Vive em devops-hub/demo (self-contained). O app gerado fica em demo/src e é
 * validado pelo job `demo` do CI do devops-hub (hub-and-spoke real).
 *
 * Uso (rodar de dentro de demo/):
 *   npm run pipeline -- specs/001-apply-discount.md          # PR de verdade + CI
 *   npm run pipeline -- specs/001-apply-discount.md --dry    # só gera + testa local
 *   npm run pipeline -- specs/002-ivcf-frailty-score.md      # guard-rail: para
 */

const ROOT = process.cwd(); // .../devops-hub/demo
const GITROOT = resolve(ROOT, '..'); // .../devops-hub
const REPO = 'lifesystemsufpr/devops-hub';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sh(cmd: string, cwd: string = ROOT): string {
  return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}
function shInherit(cmd: string, cwd: string = ROOT): void {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

async function latestRunId(branch: string): Promise<string | null> {
  for (let i = 0; i < 20; i++) {
    try {
      const id = sh(
        `gh run list --repo ${REPO} --branch ${branch} --limit 1 --json databaseId --jq ".[0].databaseId"`,
      );
      if (/^\d+$/.test(id)) return id;
    } catch {
      /* ainda não apareceu */
    }
    await sleep(2500);
  }
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const ci = args.includes('--ci'); // roda no GitHub Actions: abre o PR e sai (sem watch)
  const specArg = args.find((a) => !a.startsWith('--')) ?? 'specs/001-apply-discount.md';
  const spec = parseSpec(resolve(ROOT, specArg));

  console.log(`\n=== Pipeline: ${spec.title} (${spec.id}) ===`);
  console.log(`Área de risco: ${spec.area}`);

  // 1. Guard-rail de saúde — automação por risco (regra 80-healthcare-domain)
  if (isSensitiveArea(spec.area)) {
    console.log(`\n⛔ GUARD-RAIL: área "${spec.area}" é sensível (clínico/auth/schema).`);
    console.log('   O pipeline NÃO gera nem faz merge automático aqui — exige revisão humana.');
    console.log('   (CODEOWNERS força reviewer; o agente para e pede aprovação.)');
    console.log('\nResultado: parado com segurança, sem PR. ✋');
    return;
  }

  // 2. Geração (MOCKADA — seam p/ Claude/Cursor SDK)
  console.log('\n🤖 Gerando código (gerador mockado — seam p/ Claude/Cursor SDK)...');
  const files = generate(spec);
  for (const f of files) {
    mkdirSync(dirname(join(ROOT, f.path)), { recursive: true });
    writeFileSync(join(ROOT, f.path), f.content);
    console.log(`   ✓ demo/${f.path}`);
  }

  // 3. Validação local (testes derivados do spec)
  console.log('\n🧪 Rodando typecheck + testes + cobertura...');
  shInherit('npm run typecheck');
  shInherit('npm run test:cov');

  if (dry) {
    console.log('\n🔬 dry-run: gerado e validado localmente, sem branch/PR.');
    for (const f of files) rmSync(join(ROOT, f.path), { force: true });
    console.log('   (arquivos gerados foram removidos p/ manter a árvore limpa)');
    return;
  }

  // 4. Branch + commit + push + PR (no repo devops-hub)
  const branch = `feat/demo-${spec.id}`;
  console.log(`\n🌿 ${branch}: commit + push...`);
  sh('git checkout main', GITROOT);
  sh('git add -A', GITROOT);
  sh(`git checkout -B ${branch}`, GITROOT);
  sh(`git commit -m "feat(demo): ${spec.title} (pipeline, spec ${spec.id})"`, GITROOT);
  shInherit(`git push -u origin ${branch} --force`, GITROOT);

  console.log('\n🔀 Abrindo PR...');
  let prUrl: string;
  try {
    prUrl = sh(
      `gh pr create --repo ${REPO} --base main --head ${branch} ` +
        `--title "feat(demo): ${spec.title}" ` +
        `--body "Gerado pelo pipeline a partir do spec ${spec.id}. Geracao mockada (seam p/ Claude/Cursor SDK). Testes derivados dos exemplos do spec. Validado pelo job demo do CI."`,
      GITROOT,
    );
  } catch {
    prUrl = sh(`gh pr view ${branch} --repo ${REPO} --json url --jq ".url"`, GITROOT);
  }
  console.log(`   PR: ${prUrl}`);

  // No modo CI (rodando dentro do Actions) não esperamos o CI aqui — o PR aberto
  // já dispara o ci.yml, e o dashboard acompanha o status separadamente.
  if (ci) {
    console.log('\n✅ PR aberto (modo CI). O ci.yml valida o código gerado no PR.');
    return;
  }

  // 5. Acompanha o CI (job `demo` do devops-hub valida o código gerado)
  console.log('\n⏳ Aguardando o CI do devops-hub (job demo)...');
  const runId = await latestRunId(branch);
  if (!runId) {
    console.log(`   Não achei o run ainda — veja em ${prUrl}`);
    return;
  }
  try {
    shInherit(`gh run watch ${runId} --repo ${REPO} --exit-status`, GITROOT);
    console.log(`\n✅ CI VERDE. PR pronto p/ revisão: ${prUrl}`);
  } catch {
    console.log(`\n❌ CI falhou — ver ${prUrl}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
