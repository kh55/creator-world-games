import type { GameMeta } from './game-meta';

export interface GameSources {
  /** games 配下の meta.ts を eager で glob した結果（パス → モジュール） */
  metas: Record<string, { meta?: GameMeta }>;
  /** Game.astro のパス一覧 */
  components: string[];
  /** guide.md のパス一覧 */
  guides: string[];
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function folderOf(path: string): string {
  return /\/games\/([^/]+)\/[^/]+$/.exec(path)?.[1] ?? path;
}

export function compareGames(a: GameMeta, b: GameMeta): number {
  return a.order - b.order || a.title.localeCompare(b.title, 'ja');
}

export function buildRegistry(src: GameSources): GameMeta[] {
  const problems: string[] = [];
  const games: GameMeta[] = [];
  const seen = new Set<string>();
  const components = new Set(src.components.map(folderOf));
  const guides = new Set(src.guides.map(folderOf));
  const metaFolders = new Set(Object.keys(src.metas).map(folderOf));

  for (const [path, mod] of Object.entries(src.metas)) {
    const folder = folderOf(path);
    const meta = mod.meta;
    if (!meta) {
      problems.push(`${folder}: meta.ts が meta を export していません`);
      continue;
    }
    if (meta.slug !== folder) {
      problems.push(`${folder}: slug "${meta.slug}" がフォルダ名 "${folder}" と一致しません`);
    }
    if (!SLUG_PATTERN.test(meta.slug)) {
      problems.push(`${folder}: slug "${meta.slug}" は英小文字・数字・ハイフンのみ使えます`);
    }
    if (seen.has(meta.slug)) problems.push(`slug "${meta.slug}" が重複しています`);
    if (meta.description.length > 120) {
      problems.push(`${folder}: description は 120 字以内にしてください`);
    }
    if (!components.has(folder)) problems.push(`${folder}: Game.astro がありません`);
    if (!guides.has(folder)) problems.push(`${folder}: guide.md がありません`);
    seen.add(meta.slug);
    games.push(meta);
  }

  for (const folder of new Set([...components, ...guides])) {
    if (!metaFolders.has(folder)) problems.push(`${folder}: meta.ts がありません`);
  }

  if (problems.length > 0) {
    throw new Error(`ゲーム登録エラー:\n- ${problems.join('\n- ')}`);
  }
  return games.sort(compareGames);
}
