import { readFileSync } from 'node:fs';

/**
 * Gerador de código do pipeline.
 *
 * >>> A "IA" aqui é MOCKADA <<<
 * `generate()` hoje devolve uma implementação canônica por id de spec. O seam de
 * produção é exatamente esta função: troque o mapa CANNED_IMPLS por uma chamada ao
 * Claude Agent SDK / Cursor SDK, passando o spec + as regras do ai-toolkit como
 * contexto. O resto do pipeline (validação, PR, CI) não muda.
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

export function generate(spec: Spec): GeneratedFile[] {
  const impl = CANNED_IMPLS[spec.id];
  if (!impl) {
    throw new Error(
      `Sem template (mock) de geração para o spec "${spec.id}". ` +
        `Em produção, um agente (Claude/Cursor) geraria o código aqui.`,
    );
  }
  return [
    { path: `src/${spec.module}.ts`, content: impl(spec) },
    { path: `src/${spec.module}.test.ts`, content: renderTest(spec) },
  ];
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
