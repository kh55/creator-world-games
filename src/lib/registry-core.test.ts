import { describe, expect, it } from 'vitest';
import type { GameMeta } from './game-meta';
import { buildRegistry } from './registry-core';

const meta = (slug: string, order: number, extra: Partial<GameMeta> = {}): GameMeta => ({
  slug,
  title: slug,
  description: `${slug} の説明`,
  icon: '🎮',
  order,
  ...extra,
});

function sources(metas: GameMeta[]) {
  return {
    metas: Object.fromEntries(metas.map((m) => [`../games/${m.slug}/meta.ts`, { meta: m }])),
    components: metas.map((m) => `../games/${m.slug}/Game.astro`),
    guides: metas.map((m) => `../games/${m.slug}/guide.md`),
  };
}

describe('buildRegistry', () => {
  it('order の昇順に並べる', () => {
    const list = buildRegistry(sources([meta('b', 2), meta('a', 1)]));
    expect(list.map((g) => g.slug)).toEqual(['a', 'b']);
  });

  it('slug とフォルダ名が違うとエラー', () => {
    const src = sources([meta('a', 1)]);
    src.metas = { '../games/x/meta.ts': { meta: meta('a', 1) } };
    src.components = ['../games/x/Game.astro'];
    src.guides = ['../games/x/guide.md'];
    expect(() => buildRegistry(src)).toThrow(/フォルダ名/);
  });

  it('Game.astro か guide.md が欠けているとエラー', () => {
    const src = sources([meta('a', 1)]);
    src.guides = [];
    expect(() => buildRegistry(src)).toThrow(/guide\.md/);
  });

  it('meta.ts がないフォルダがあるとエラー', () => {
    const src = sources([meta('a', 1)]);
    src.components.push('../games/b/Game.astro');
    expect(() => buildRegistry(src)).toThrow(/b: meta\.ts/);
  });

  it('description が 120 字を超えるとエラー', () => {
    expect(() => buildRegistry(sources([meta('a', 1, { description: 'あ'.repeat(121) })]))).toThrow(/120/);
  });

  it('slug に使えない文字があるとエラー', () => {
    expect(() => buildRegistry(sources([meta('A_b', 1)]))).toThrow(/英小文字/);
  });
});
