// src/games/<slug>/ を自動で収集する。ゲームの追加はフォルダを置くだけでよい。
import type { GameMeta } from './game-meta';
import { buildRegistry } from './registry-core';

const metas = import.meta.glob<{ meta?: GameMeta }>('../games/*/meta.ts', { eager: true });
const components = import.meta.glob('../games/*/Game.astro');
const guides = import.meta.glob('../games/*/guide.md');

export const games: GameMeta[] = buildRegistry({
  metas,
  components: Object.keys(components),
  guides: Object.keys(guides),
});
