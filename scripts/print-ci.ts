// Uso interno: imprime o ci.yml gerado p/ um repo (debug/bootstrap manual).
//   npx tsx scripts/print-ci.ts auth-service
import { readFileSync } from 'node:fs';
import { applyCiTemplate } from './config-utils.js';
import { REPOS, CI_TEMPLATE_BY_TYPE } from './repos.config.js';

const name = process.argv[2];
const repo = REPOS.find((r) => r.name === name);
if (!repo) {
  console.error(`Repo não encontrado: ${name}`);
  process.exit(1);
}
process.stdout.write(applyCiTemplate(readFileSync(CI_TEMPLATE_BY_TYPE[repo.type], 'utf8'), repo));
