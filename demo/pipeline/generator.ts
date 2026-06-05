import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Gerador de código do pipeline.
 *
 * Dois back-ends atrás do mesmo seam (`generate`):
 *  - **mock**: implementação canônica por id de spec (CANNED_IMPLS). Determinístico,
 *    usado nos testes e no CI (onde não há `claude` instalado).
 *  - **claude**: chama o `claude` CLI em modo headless (`-p`/`--print`) passando o spec
 *    como prompt e extraindo o bloco de código TS. Usa a auth já existente do CLI —
 *    sem API key nova. Cai no mock se o CLI não estiver disponível (modo `auto`).
 *
 * Em qualquer modo, os TESTES são derivados dos EXEMPLOS do spec (renderTest) — a
 * validação não é circular: os casos vêm da especificação, não de quem gerou o código.
 */

export interface Spec {
  id: string;
  title: string;
  area: string; // general | clinical | auth | schema
  module: string; // nome do arquivo em src/
  export: string; // nome da função exportada
  body: string;
  examples: Example[];
}

export interface Example {
  call: string;
  expected: string;
  throws: boolean;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

/**
 * Áreas de risco que disparam o guard-rail de saúde (regra 80-healthcare-domain):
 * o pipeline NÃO gera nem faz merge automático — exige revisão humana.
 */
export const SENSITIVE_AREAS = new Set(['clinical', 'auth', 'schema']);

/** Predicado puro do guard-rail — testável isoladamente. */
export function isSensitiveArea(area: string): boolean {
  return SENSITIVE_AREAS.has(area);
}

export function parseSpec(path: string): Spec {
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`Spec sem frontmatter: ${path}`);
  const [, fm, body] = m;
  const meta: Record<string, string> = {};
  for (const line of fm.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return {
    id: meta.id,
    title: meta.title,
    area: meta.area ?? 'general',
    module: meta.module,
    export: meta.export,
    body,
    examples: parseExamples(body),
  };
}

function parseExamples(body: string): Example[] {
  const out: Example[] = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*-\s*(.+?)\s*=>\s*(.+?)\s*$/);
    if (!m) continue;
    const call = m[1].trim();
    const rhs = m[2].trim();
    if (rhs.toLowerCase() === 'throws') out.push({ call, expected: '', throws: true });
    else out.push({ call, expected: rhs, throws: false });
  }
  return out;
}

// "IA" MOCKADA: implementações canônicas por id de spec.
const CANNED_IMPLS: Record<string, (s: Spec) => string> = {
  'apply-discount': () => `/** Gerado pelo pipeline a partir do spec apply-discount (gerador mockado). */
export function applyDiscount(price: number, pct: number): number {
  if (price < 0 || pct < 0 || pct > 100) {
    throw new Error('price deve ser >= 0 e pct entre 0 e 100');
  }
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}
`,
};

/** Back-end de geração da implementação. */
export type GeneratorMode = 'mock' | 'claude' | 'auto';

/** true se o `claude` CLI está instalado e responde a `--version`. */
export function claudeAvailable(): boolean {
  try {
    execFileSync('claude', ['--version'], { stdio: 'ignore', timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

/** Implementação mockada (canônica por id de spec). */
function mockImpl(spec: Spec): string {
  const impl = CANNED_IMPLS[spec.id];
  if (!impl) {
    throw new Error(
      `Sem template (mock) de geração para o spec "${spec.id}". ` +
        `Rode com o gerador real (claude) ou adicione um template ao CANNED_IMPLS.`,
    );
  }
  return impl(spec);
}

function buildPrompt(spec: Spec): string {
  return [
    'Você é o gerador de código de um pipeline de engenharia. Gere SOMENTE a implementação',
    'TypeScript da função especificada — nada de testes, imports supérfluos ou explicações.',
    '',
    `id do spec: ${spec.id}`,
    `módulo (arquivo src/${spec.module}.ts): ${spec.module}`,
    `função exportada: ${spec.export}`,
    '',
    'Especificação:',
    spec.body.trim(),
    '',
    'Regras de saída (obrigatórias):',
    `- Responda APENAS com um único bloco de código \`\`\`ts ... \`\`\`.`,
    `- O bloco deve conter exatamente \`export function ${spec.export}(...)\` com tipos explícitos.`,
    '- Validar as pré-condições e lançar Error quando violadas (conforme os exemplos "throws").',
    '- Sem texto fora do bloco de código.',
  ].join('\n');
}

/** Extrai o conteúdo do primeiro bloco de código (```ts / ```typescript / ```). */
export function extractCodeBlock(out: string): string | null {
  const fenced = out.match(/```(?:ts|typescript)?\s*\n([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  // fallback: se já veio só o código com a assinatura esperada
  if (/export\s+function\s+\w+/.test(out)) return out.trim();
  return null;
}

/** Chama o `claude` CLI headless e devolve a implementação, ou null em falha. */
function claudeImpl(spec: Spec): string | null {
  try {
    const out = execFileSync('claude', ['-p', buildPrompt(spec)], {
      encoding: 'utf8',
      timeout: 180_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const code = extractCodeBlock(out);
    if (!code || !code.includes(`function ${spec.export}`)) return null;
    return `/** Gerado pelo pipeline a partir do spec ${spec.id} (gerador: claude CLI). */\n${code}\n`;
  } catch {
    return null;
  }
}

export function generate(spec: Spec, mode: GeneratorMode = 'mock'): GeneratedFile[] {
  let impl: string;
  const useClaude = mode === 'claude' || (mode === 'auto' && claudeAvailable());
  if (useClaude) {
    const generated = claudeImpl(spec);
    if (generated) {
      impl = generated;
    } else if (mode === 'claude') {
      throw new Error(
        `Gerador real (claude) exigido, mas falhou ao gerar a implementação do spec "${spec.id}".`,
      );
    } else {
      impl = mockImpl(spec); // auto: cai no mock
    }
  } else {
    impl = mockImpl(spec);
  }
  return [
    { path: `src/${spec.module}.ts`, content: impl },
    { path: `src/${spec.module}.test.ts`, content: renderTest(spec) },
  ];
}

/** Extrai as linhas sob um header markdown (até o próximo header de mesmo/maior nível). */
export function extractSection(body: string, header: string): string[] {
  const lines = body.split('\n');
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      if (inSection) break; // chegou no próximo header → fim da seção
      if (h[2].trim().toLowerCase() === header.toLowerCase()) inSection = true;
      continue;
    }
    if (inSection && line.trim()) out.push(line.trim());
  }
  return out;
}

/**
 * Corpo do PR aberto pelo pipeline — enriquecido (regras commits-pr/healthcare):
 * resumo, área de risco, suposições (regras do spec) e cobertura dos testes
 * derivados dos exemplos.
 */
export function renderPrBody(spec: Spec, opts: { generator: string }): string {
  const sensitive = isSensitiveArea(spec.area);
  const rules = extractSection(spec.body, 'Regras');
  const assumptions = rules.length
    ? rules.map((r) => (r.startsWith('-') ? r : `- ${r}`)).join('\n')
    : '- (spec sem seção "Regras" — contrato definido pelos exemplos abaixo)';
  const coverage = spec.examples.length
    ? spec.examples
        .map((e) => (e.throws ? `- \`${e.call}\` → lança erro` : `- \`${e.call}\` → \`${e.expected}\``))
        .join('\n')
    : '- (spec sem exemplos)';

  return [
    `## Resumo`,
    ``,
    `Gerado pelo **pipeline** a partir do spec \`${spec.id}\` — _${spec.title}_.`,
    ``,
    `| Campo | Valor |`,
    `|---|---|`,
    `| Spec | \`${spec.id}\` |`,
    `| Área de risco | \`${spec.area}\` ${sensitive ? '⛔ sensível' : '✅ geral'} |`,
    `| Módulo | \`src/${spec.module}.ts\` |`,
    `| Função | \`${spec.export}\` |`,
    `| Gerador | ${opts.generator} |`,
    ``,
    `## Suposições`,
    ``,
    `Contrato assumido na geração (extraído do spec):`,
    ``,
    assumptions,
    ``,
    `## Cobertura de testes (derivada do spec)`,
    ``,
    `${spec.examples.length} caso(s) gerados a partir dos **exemplos do spec** — validação não-circular:`,
    ``,
    coverage,
    ``,
    `> Os testes vêm da especificação, não do código gerado: se a implementação`,
    `> divergir do contrato, o CI quebra.`,
    ``,
    `---`,
    `🤖 Aberto pelo pipeline (\`demo/pipeline\`). Revisão humana exigida via CODEOWNERS.`,
  ].join('\n');
}

function renderTest(spec: Spec): string {
  const cases = spec.examples
    .map((e) =>
      e.throws
        ? `  it('${e.call} => throws', () => { expect(() => ${e.call}).toThrow(); });`
        : `  it('${e.call} => ${e.expected}', () => { expect(${e.call}).toBe(${e.expected}); });`,
    )
    .join('\n');
  return `import { describe, it, expect } from 'vitest';
import { ${spec.export} } from './${spec.module}';

// Testes derivados dos EXEMPLOS do spec "${spec.id}" — validação não-circular:
// os casos vêm da especificação, não de quem gerou a implementação.
describe('${spec.export} — spec ${spec.id}', () => {
${cases}
});
`;
}
