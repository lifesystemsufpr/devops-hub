import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseSpec,
  generate,
  isSensitiveArea,
  SENSITIVE_AREAS,
  extractCodeBlock,
} from './generator.js';

// Spec de exemplo (área geral) usado em vários testes de parseSpec/generate.
const APPLY_DISCOUNT_SPEC = `---
id: apply-discount
title: Aplicar desconto
area: general
module: discount
export: applyDiscount
---

Aplica um desconto percentual a um preço.

Exemplos:
- applyDiscount(100, 10) => 90
- applyDiscount(50, 0) => 50
- applyDiscount(-1, 10) => throws
`;

let dir: string;
function specFile(name: string, content: string): string {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gen-spec-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('parseSpec', () => {
  it('lê o frontmatter e mapeia os campos', () => {
    const spec = parseSpec(specFile('ok.md', APPLY_DISCOUNT_SPEC));
    expect(spec.id).toBe('apply-discount');
    expect(spec.title).toBe('Aplicar desconto');
    expect(spec.area).toBe('general');
    expect(spec.module).toBe('discount');
    expect(spec.export).toBe('applyDiscount');
  });

  it('extrai exemplos normais e os que lançam (throws)', () => {
    const spec = parseSpec(specFile('ex.md', APPLY_DISCOUNT_SPEC));
    expect(spec.examples).toHaveLength(3);
    expect(spec.examples[0]).toEqual({ call: 'applyDiscount(100, 10)', expected: '90', throws: false });
    expect(spec.examples[2]).toEqual({ call: 'applyDiscount(-1, 10)', expected: '', throws: true });
  });

  it('assume area "general" quando ausente', () => {
    const spec = parseSpec(
      specFile('noarea.md', `---\nid: x\ntitle: X\nmodule: x\nexport: x\n---\nsem exemplos.\n`),
    );
    expect(spec.area).toBe('general');
    expect(spec.examples).toEqual([]);
  });

  it('remove aspas dos valores do frontmatter', () => {
    const spec = parseSpec(
      specFile('quoted.md', `---\nid: "q"\ntitle: 'Com aspas'\nmodule: q\nexport: q\n---\n`),
    );
    expect(spec.id).toBe('q');
    expect(spec.title).toBe('Com aspas');
  });

  it('lança quando não há frontmatter', () => {
    expect(() => parseSpec(specFile('bad.md', 'sem frontmatter aqui'))).toThrow(/frontmatter/);
  });
});

describe('isSensitiveArea (guard-rail)', () => {
  it('marca áreas clínica/auth/schema como sensíveis', () => {
    for (const area of ['clinical', 'auth', 'schema']) {
      expect(isSensitiveArea(area)).toBe(true);
    }
  });

  it('não marca áreas gerais', () => {
    expect(isSensitiveArea('general')).toBe(false);
    expect(isSensitiveArea('')).toBe(false);
    expect(isSensitiveArea('billing')).toBe(false);
  });

  it('SENSITIVE_AREAS contém exatamente as 3 áreas', () => {
    expect([...SENSITIVE_AREAS].sort()).toEqual(['auth', 'clinical', 'schema']);
  });
});

describe('generate', () => {
  it('gera a implementação e o teste para a spec apply-discount', () => {
    const spec = parseSpec(specFile('gen.md', APPLY_DISCOUNT_SPEC));
    const files = generate(spec);
    expect(files.map((f) => f.path)).toEqual(['src/discount.ts', 'src/discount.test.ts']);

    const impl = files[0].content;
    expect(impl).toContain('export function applyDiscount');

    const test = files[1].content;
    // testes derivados dos exemplos: toBe para casos normais, toThrow para "throws"
    expect(test).toContain("import { applyDiscount } from './discount'");
    expect(test).toContain('expect(applyDiscount(100, 10)).toBe(90)');
    expect(test).toContain('expect(() => applyDiscount(-1, 10)).toThrow()');
  });

  it('lança para spec sem template (mock) de geração', () => {
    const spec = parseSpec(
      specFile('unknown.md', `---\nid: nao-existe\ntitle: N\narea: general\nmodule: n\nexport: n\n---\n`),
    );
    expect(() => generate(spec, 'mock')).toThrow(/Sem template/);
  });
});

describe('extractCodeBlock (parser de saída do claude)', () => {
  it('extrai o conteúdo de um bloco ```ts', () => {
    const out = 'Aqui está:\n```ts\nexport function f(): number { return 1; }\n```\nPronto.';
    expect(extractCodeBlock(out)).toBe('export function f(): number { return 1; }');
  });

  it('aceita ```typescript e ``` sem linguagem', () => {
    expect(extractCodeBlock('```typescript\nexport function g() {}\n```')).toBe('export function g() {}');
    expect(extractCodeBlock('```\nexport function h() {}\n```')).toBe('export function h() {}');
  });

  it('faz fallback para texto cru que já contém a função', () => {
    expect(extractCodeBlock('export function k(): void {}')).toBe('export function k(): void {}');
  });

  it('devolve null quando não há código', () => {
    expect(extractCodeBlock('desculpe, não consegui gerar')).toBeNull();
  });
});
