// ゲームのデータを外部へ送れないよう、src 配下のコードに通信 API が書かれていないことを検査する。
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../', import.meta.url));

const FORBIDDEN: [string, RegExp][] = [
  ['fetch', /\bfetch\s*\(/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['外部 URL の動的 import', /\bimport\s*\(\s*['"`]https?:/],
];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    const isSource = /\.(ts|astro|mjs|js)$/.test(name) && !/\.test\.(ts|mjs)$/.test(name);
    return isSource ? [path] : [];
  });
}

describe('通信 API の静的チェック', () => {
  it('src 配下に通信 API の呼び出しがない', () => {
    const violations: string[] = [];
    for (const file of walk(SRC)) {
      const code = readFileSync(file, 'utf8');
      for (const [name, pattern] of FORBIDDEN) {
        if (pattern.test(code)) violations.push(`${file.slice(SRC.length)}: ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
