# creator-world-games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** browser-games の 4 ゲームを Astro + TypeScript に移植した新規公開リポジトリ `kh55/creator-world-games` を作り、Cloudflare Pages で `browser-games.creator-world.net` に公開できる状態（GTM/GA4・AdSense・Search Console 対応）にする。

**Architecture:** 参考サイト `kh55/creator-world-tools`（`b278342`）と同じ Astro 静的サイト構成。ゲームは `src/games/<slug>/` に 1 フォルダずつ置き、`engine/runner.ts` の `mountGame()` が 1 ページ 1 ゲームを起動する。広告・解析のタグは `PUBLIC_*` 環境変数があるときだけ出力し、CSP は `scripts/postbuild.mjs` が `_headers` に書く。

**Tech Stack:** Astro 7 / TypeScript（strict）/ Vitest / Playwright / wrangler / GitHub Actions / Cloudflare Pages

**Spec:** `docs/superpowers/specs/2026-09-25-creator-world-games-design.md`（Task 1 で新リポジトリにコピーする）

## 前提と参照元

- 作業ディレクトリ: `~/github/creator-world-games`（新規）。以下、パスはこのリポジトリのルートからの相対。
- 移植元: `~/github/browser-games`（コミット `e51fce8` のゲーム本体）。以下 **SRC** と書く。
- 参考: `~/github/creator-world-tools`（コミット `b278342`）。以下 **REF** と書く。「REF からコピー」とある箇所は、そのファイルをそのままコピーし、指示された差分だけを当てる。
- GitHub への push・リポジトリ作成・ブランチ保護は Task 12 でまとめて行い、各操作の前にユーザーの確認を取る。それまではローカルでコミットするだけ。

## Global Constraints

- Node.js 22.12 以上（`.nvmrc` = `22`、`package.json` の `engines.node` = `>=22.12.0`）。
- 依存は REF の `package.json` と同じバージョン: `astro ^7.3.4`、`@astrojs/sitemap ^3.7.4`、dev: `@astrojs/check ^0.9.10`、`@playwright/test ^1.63.0`、`@types/node ^22.20.4`、`typescript ^6.0.3`、`vitest ^5.0.1`、`wrangler ^4.136.3`。ゲーム用の外部ライブラリは追加しない。
- `site: 'https://browser-games.creator-world.net'`、`trailingSlash: 'always'`、`build.format: 'directory'`。
- サイト名 `SITE.name` = `'Creator World Games'`。
- slug は `invader` / `breakout` / `whack` / `tetris`。ハイスコアの localStorage キーは `bg:highscore:<slug>`（現行と同じ）。
- ゲームの挙動（操作・得点・速度・見た目・文言）は現行と同じにする。**既知の不具合も直さない**（例: ブロック崩しは画面に「SPACE で発射」と出るが、Space は `fire` アクションで発射しない。解説文は実際の挙動＝Enter・タップで発射と書く）。
- `innerHTML` を使わない（`createElement` / `textContent` / `replaceChildren()` を使う）。
- `src/` に `fetch` / `XMLHttpRequest` / `sendBeacon` / `WebSocket` / `EventSource` を書かない（`no-network.test.ts` が検査）。
- CSP で inline script を禁止しているため、Astro の `<script>`（バンドルされる）だけを使う。`is:inline` は AdSense・Cloudflare の外部 `src` 付きタグに限る。
- 環境変数: `PUBLIC_GTM_ID` / `PUBLIC_ADSENSE_CLIENT` / `PUBLIC_ADSENSE_SLOT_GAME` / `PUBLIC_ADSENSE_SLOT_FOOTER` / `PUBLIC_CF_ANALYTICS_TOKEN`。すべて任意。
- dataLayer イベント: `{ event: 'game_start', game_id }` と `{ event: 'game_over', game_id, score }`。
- コミットメッセージは Conventional Commits（英語）で、末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- 検証コマンド: `npm run check` / `npm test` / `npm run build` / `npm run test:e2e`。

## spec からの具体化（計画で確定させた点）

spec の意図を変えずに、実装上の形を次のように確定した（spec にも反映済み）。

1. 各ゲームのブラウザ用コードは `src/games/<slug>/game.ts`（`export const create: CreateGame`）に置き、`Game.astro` は `mountGame()` を呼ぶだけにする。
2. `game_over` は runner の `submitScore()` が送る（全ゲームがゲームオーバー時にだけ `submitScore` を呼ぶため）。ゲーム側に足すのは `api.started()` の呼び出しだけ。
3. 広告 1（`PUBLIC_ADSENSE_SLOT_GAME`）は解説の**後**、広告 2（`PUBLIC_ADSENSE_SLOT_FOOTER`）は関連ゲームの後に置く。Markdown を途中で分割しないで済み、操作ボタンとの間に必ず解説全体が挟まる。
4. キー入力は、リンク・フォーム部品・（touchbar 以外の）ボタンにフォーカスがあるときは無視する（ページに解説やリンクが増えたため、Enter でリンクを開けなくなるのを防ぐ）。
5. CI の `preview` ジョブは、`CLOUDFLARE_API_TOKEN` が未登録ならデプロイのステップをスキップする（Cloudflare の設定前に最初の PR を出すため）。

## Review Focus

1. **リンクにフォーカスして Enter / Space を押す** → リンクが開く・ボタンが押される（ゲームがキーを奪わない）。→ Task 2 の input テスト、Task 5 の E2E。
2. **ブラウザの「戻る」で bfcache から復帰する** → ゲームが動く状態に戻り、JS エラーが出ない。→ Task 4 の runner（`pageshow` の `persisted` で再読み込み）、Task 5 の E2E。
3. **localStorage が使えない・書き込みで例外になる**（Safari のプライベートモード、容量超過）→ ゲームは動き、そのセッション内では BEST が更新される。→ Task 2 の storage テスト。
4. **リトライを繰り返す** → `game_start` はプレイ開始 1 回につき 1 回、`game_over` はゲームオーバー 1 回につき 1 回だけ積まれる。→ Task 4 の runner テスト、各ゲームの E2E。
5. **スマホでゲームの下の解説をスクロールする** → ゲーム領域の外では `touch-action` が効かず、普通にスクロールできる。→ Task 5 の CSS（`touch-action:none` は `.stage` と `.touchbar` だけ）、`tests/smoke.md` の手動確認。

## ファイル構成

```
.github/workflows/ci.yml, deploy.yml         Task 11
.gitignore .nvmrc package.json tsconfig.json
astro.config.mjs vitest.config.ts playwright.config.ts   Task 1
public/favicon.svg public/robots.txt          Task 1
scripts/postbuild.mjs, postbuild.test.mjs     Task 1
src/env.d.ts                                   Task 1
src/lib/site.ts                                Task 1
src/lib/no-network.test.ts                     Task 1
src/styles/global.css                          Task 1（土台）→ Task 5（ゲーム・ページ）
src/engine/storage.ts, loop.ts, input.ts (+tests)  Task 2
src/lib/game-meta.ts, registry-core.ts (+test), registry.ts  Task 3
src/engine/runner.ts (+test)                   Task 4
src/layouts/BaseLayout.astro, GameLayout.astro Task 1（Base 土台）→ Task 5
src/components/GameCard.astro                  Task 5
src/pages/index.astro, games/[slug].astro, about.astro, privacy.astro, 404.astro  Task 5
tests/e2e/helpers.ts, site.spec.ts             Task 5
src/games/whack/*    tests/e2e/games/whack.spec.ts     Task 6
src/games/breakout/* tests/e2e/games/breakout.spec.ts  Task 7
src/games/tetris/*   tests/e2e/games/tetris.spec.ts    Task 8
src/games/invader/*  tests/e2e/games/invader.spec.ts   Task 9
src/lib/gtm.ts (+test), ads.ts (+test), components/Gtm.astro, AdSlot.astro  Task 10
README.md tests/smoke.md                       Task 11
docs/superpowers/specs/…, plans/…              Task 1
```

各ゲームフォルダ `src/games/<slug>/`: `meta.ts` / `logic.ts` / `logic.test.ts` / `game.ts` / `Game.astro` / `guide.md`。

---

### Task 1: 雛形（Astro・テスト基盤・postbuild・通信禁止チェック）

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `src/env.d.ts`, `src/lib/site.ts`, `src/layouts/BaseLayout.astro`, `src/pages/index.astro`（仮）, `src/styles/global.css`, `public/favicon.svg`, `public/robots.txt`, `scripts/postbuild.mjs`, `scripts/postbuild.test.mjs`, `src/lib/no-network.test.ts`, `docs/superpowers/specs/2026-09-25-creator-world-games-design.md`, `docs/superpowers/plans/2026-09-26-creator-world-games.md`

**Interfaces:**
- Produces: `SITE`（`name`, `tagline`, `url`）と `env`（`gtmId`, `adsenseClient`, `slotGame`, `slotFooter`, `cfAnalyticsToken`）を `src/lib/site.ts` から export。`BaseLayout`（props: `title`, `description`, `noindex?`）。`buildCsp(env)`, `buildHeaders(env)`, `buildAdsTxt(env)` を `scripts/postbuild.mjs` から export。

- [ ] **Step 1: リポジトリを初期化**

```bash
mkdir -p ~/github/creator-world-games && cd ~/github/creator-world-games
git init -b main
mkdir -p docs/superpowers/specs docs/superpowers/plans
cp ~/github/browser-games/docs/superpowers/specs/2026-09-25-creator-world-games-design.md docs/superpowers/specs/
cp ~/github/browser-games/docs/superpowers/plans/2026-09-26-creator-world-games.md docs/superpowers/plans/
```

- [ ] **Step 2: 設定ファイルを作る**

`package.json`:

```json
{
  "name": "creator-world-games",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build && node scripts/postbuild.mjs",
    "check": "astro check",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "preview": "wrangler pages dev dist --port 8788"
  },
  "dependencies": {
    "@astrojs/sitemap": "^3.7.4",
    "astro": "^7.3.4"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.10",
    "@playwright/test": "^1.63.0",
    "@types/node": "^22.20.4",
    "typescript": "^6.0.3",
    "vitest": "^5.0.1",
    "wrangler": "^4.136.3"
  }
}
```

`.nvmrc` は `22`。`.gitignore`・`tsconfig.json`・`vitest.config.ts`・`playwright.config.ts` は REF からそのままコピーする。

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://browser-games.creator-world.net',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'never' },
  // CSP で inline script を禁止しているため、小さなスクリプトもインライン化させない
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [sitemap()],
});
```

`src/env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly PUBLIC_ADSENSE_CLIENT?: string;
  readonly PUBLIC_ADSENSE_SLOT_GAME?: string;
  readonly PUBLIC_ADSENSE_SLOT_FOOTER?: string;
  readonly PUBLIC_CF_ANALYTICS_TOKEN?: string;
  readonly PUBLIC_GTM_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  adsbygoogle?: unknown[];
  dataLayer?: unknown[];
}
```

`src/lib/site.ts`:

```ts
export const SITE = {
  name: 'Creator World Games',
  tagline: 'ブラウザですぐ遊べる、登録不要のミニゲーム集',
  url: 'https://browser-games.creator-world.net',
} as const;

// すべて任意。未設定なら広告・解析のタグを出力しない
export const env = {
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '',
  slotGame: import.meta.env.PUBLIC_ADSENSE_SLOT_GAME ?? '',
  slotFooter: import.meta.env.PUBLIC_ADSENSE_SLOT_FOOTER ?? '',
  cfAnalyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN ?? '',
  gtmId: import.meta.env.PUBLIC_GTM_ID ?? '',
};
```

`public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://browser-games.creator-world.net/sitemap-index.xml
```

`public/favicon.svg`（現行の 👾 ファビコンを SVG ファイルにしたもの）:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="14" font-size="14">👾</text></svg>
```

- [ ] **Step 3: postbuild のテストをコピーして失敗を確認**

REF の `scripts/postbuild.test.mjs` をそのままコピーする（CSP・ads.txt の仕様は REF と同じ）。

Run: `npm install && npx vitest run scripts/postbuild.test.mjs`
Expected: FAIL（`./postbuild.mjs` が見つからない）

- [ ] **Step 4: postbuild をコピー**

REF の `scripts/postbuild.mjs` をそのままコピーする（環境変数名 `PUBLIC_ADSENSE_CLIENT` / `PUBLIC_GTM_ID` / `PUBLIC_CF_ANALYTICS_TOKEN` は同じ）。

Run: `npx vitest run scripts/postbuild.test.mjs`
Expected: PASS

- [ ] **Step 5: 通信禁止チェックを置く**

REF の `src/lib/no-network.test.ts` をコピーし、先頭のコメントだけ次に変える:

```ts
// ゲームのデータを外部へ送れないよう、src 配下のコードに通信 API が書かれていないことを検査する。
```

- [ ] **Step 6: BaseLayout・仮トップ・土台 CSS**

`src/layouts/BaseLayout.astro` は REF からコピーし、次だけ変える（`Gtm` と AdSense のタグは Task 10 で足すので、この時点では取り除く）:
- `import Gtm ...` の行と `{env.gtmId && <Gtm id={env.gtmId} />}` を削除。
- `<head>` の AdSense の `<script>` ブロックを削除。
- フッターの 1 行目を `<p>ゲームのスコアはお使いのブラウザにだけ保存されます。</p>` に変える。

`src/pages/index.astro`（仮。Task 5 で置き換える）:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { SITE } from '../lib/site';
---

<BaseLayout title={SITE.name} description={SITE.tagline}>
  <h1>{SITE.name}</h1>
</BaseLayout>
```

`src/styles/global.css`: 現行 SRC `style.css` の `:root` 変数と `* {}` / `html,body {}` を移し、REF `global.css` の `[hidden]`・`.container`・`.visually-hidden`・`.site-header`・`.site-footer`・`.breadcrumb`・`.guide`・`.related`・`.ad-slot`・`.ad-label` のルールを、色だけアーケード調（`--neon` / `--neon-dim` / `--card` / `--line` / `--bg`）に置き換えてコピーする。フォントは現行と同じ `"Courier New", monospace`。見出しと本文の行間は `line-height:1.7`。

- [ ] **Step 7: ビルドと型チェックを確認**

Run: `npm run check && npm test && npm run build && ls dist`
Expected: エラー 0。`dist/index.html`、`dist/_headers`、`dist/ads.txt`（空）、`dist/robots.txt`、`dist/sitemap-index.xml` がある。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold astro site with postbuild headers and no-network check"
```

---

### Task 2: engine（storage / loop / input）

**Files:**
- Create: `src/engine/storage.ts`, `src/engine/storage.test.ts`, `src/engine/loop.ts`, `src/engine/loop.test.ts`, `src/engine/input.ts`, `src/engine/input.test.ts`

**Interfaces:**
- Produces:
  - `createScoreStore(getStorage: () => KeyValueStorage | undefined): ScoreStore`、`scores: ScoreStore`（`localStorage` を使う既定のインスタンス）。`ScoreStore = { getHighScore(id: string): number; submitScore(id: string, n: number): boolean }`。
  - `createLoop(callback: (dt: number) => void, env?: LoopEnv): LoopHandle`、`LoopHandle = { stop(): void }`。
  - `createInput(opts: InputOptions): GameInput`、`KEYMAP`。`GameInput = { keys: Record<string, boolean>; isDown(a: Action): boolean; onPointer(cb: (p: PointerInfo) => void): void; onStart(cb: () => void): void; addButton(spec: ButtonSpec): HTMLButtonElement; destroy(): void }`。

- [ ] **Step 1: storage のテストを書く**

`src/engine/storage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createScoreStore, type KeyValueStorage } from './storage';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('createScoreStore', () => {
  it('現行と同じ規則でハイスコアを更新する', () => {
    const s = createScoreStore(() => memoryStorage());
    expect(s.getHighScore('t1')).toBe(0);
    expect(s.submitScore('t1', 100)).toBe(true);
    expect(s.getHighScore('t1')).toBe(100);
    expect(s.submitScore('t1', 50)).toBe(false);
    expect(s.getHighScore('t1')).toBe(100);
    expect(s.submitScore('t1', 150)).toBe(true);
    expect(s.submitScore('t1', 150)).toBe(false);
    expect(s.getHighScore('other')).toBe(0);
  });

  it('キーは bg:highscore:<id>（現行と同じ）', () => {
    const storage = memoryStorage();
    createScoreStore(() => storage).submitScore('tetris', 12.9);
    expect(storage.data.get('bg:highscore:tetris')).toBe('12');
  });

  it('localStorage がないときはメモリに保存する', () => {
    const s = createScoreStore(() => undefined);
    expect(s.submitScore('x', 10)).toBe(true);
    expect(s.getHighScore('x')).toBe(10);
  });

  it('localStorage へのアクセス自体が例外でも動く', () => {
    const s = createScoreStore(() => {
      throw new Error('SecurityError');
    });
    expect(s.submitScore('x', 10)).toBe(true);
    expect(s.getHighScore('x')).toBe(10);
  });

  it('書き込みだけ失敗しても、そのセッション内では新しい値を返す', () => {
    const storage = memoryStorage();
    storage.data.set('bg:highscore:x', '5');
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const s = createScoreStore(() => storage);
    expect(s.submitScore('x', 10)).toBe(true);
    expect(s.getHighScore('x')).toBe(10);
  });

  it('壊れた値は 0 として扱う', () => {
    const storage = memoryStorage();
    storage.data.set('bg:highscore:x', 'abc');
    expect(createScoreStore(() => storage).getHighScore('x')).toBe(0);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/engine/storage.test.ts`
Expected: FAIL（`./storage` が見つからない）

- [ ] **Step 3: storage を実装**

`src/engine/storage.ts`:

```ts
// ハイスコアを localStorage に保存する。使えない環境ではメモリに保存する（現行 common/storage.js と同じ規則）。
const PREFIX = 'bg:highscore:';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ScoreStore {
  getHighScore(id: string): number;
  submitScore(id: string, n: number): boolean;
}

export function createScoreStore(getStorage: () => KeyValueStorage | undefined): ScoreStore {
  // 書き込みに失敗した値もセッション内では有効にするため、メモリを優先して読む
  const mem = new Map<string, string>();

  function read(key: string): string | null {
    const own = mem.get(key);
    if (own !== undefined) return own;
    try {
      return getStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  function write(key: string, value: string): void {
    try {
      const storage = getStorage();
      if (storage) {
        storage.setItem(key, value);
        return;
      }
    } catch {
      // メモリに保存する
    }
    mem.set(key, value);
  }

  function getHighScore(id: string): number {
    const n = parseInt(read(PREFIX + id) ?? '', 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function submitScore(id: string, n: number): boolean {
    const score = Math.floor(Number(n) || 0);
    if (score > getHighScore(id)) {
      write(PREFIX + id, String(score));
      return true;
    }
    return false;
  }

  return { getHighScore, submitScore };
}

export const scores = createScoreStore(() => globalThis.localStorage);
```

- [ ] **Step 4: 通ることを確認**

Run: `npx vitest run src/engine/storage.test.ts`
Expected: PASS

- [ ] **Step 5: loop のテストを書く**

`src/engine/loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createLoop, type LoopEnv } from './loop';

function fakeEnv() {
  const queue: ((ts: number) => void)[] = [];
  let cancelled = 0;
  const env: LoopEnv & { hidden: boolean } = {
    hidden: false,
    requestAnimationFrame: (cb) => queue.push(cb),
    cancelAnimationFrame: () => void cancelled++,
    isHidden() {
      return env.hidden;
    },
  };
  const tick = (ts: number) => queue.shift()!(ts);
  return { env, tick, get cancelled() { return cancelled; } };
}

describe('createLoop', () => {
  it('初回は dt=0、以降は秒単位の差分を渡し、0.05 秒で頭打ちにする', () => {
    const f = fakeEnv();
    const dts: number[] = [];
    createLoop((dt) => dts.push(dt), f.env);
    f.tick(1000);
    f.tick(1016);
    f.tick(2000);
    expect(dts[0]).toBe(0);
    expect(dts[1]).toBeCloseTo(0.016);
    expect(dts[2]).toBe(0.05);
  });

  it('タブが非表示の間は呼ばず、復帰後の最初のフレームは dt=0', () => {
    const f = fakeEnv();
    const dts: number[] = [];
    createLoop((dt) => dts.push(dt), f.env);
    f.tick(0);
    f.env.hidden = true;
    f.tick(16);
    f.env.hidden = false;
    f.tick(5000);
    expect(dts).toEqual([0, 0]);
  });

  it('stop 後は呼ばない', () => {
    const f = fakeEnv();
    let calls = 0;
    const h = createLoop(() => void calls++, f.env);
    h.stop();
    f.tick(0);
    expect(calls).toBe(0);
    expect(f.cancelled).toBe(1);
  });
});
```

- [ ] **Step 6: 失敗を確認**

Run: `npx vitest run src/engine/loop.test.ts`
Expected: FAIL（`./loop` が見つからない）

- [ ] **Step 7: loop を実装**

`src/engine/loop.ts`（SRC `common/loop.js` の移植）:

```ts
export interface LoopEnv {
  requestAnimationFrame(cb: (ts: number) => void): number | void;
  cancelAnimationFrame(id: number): void;
  isHidden(): boolean;
}

export interface LoopHandle {
  stop(): void;
}

const browserEnv = (): LoopEnv => ({
  requestAnimationFrame: (cb) => window.requestAnimationFrame(cb),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
  isHidden: () => document.hidden,
});

export function createLoop(callback: (dt: number) => void, env: LoopEnv = browserEnv()): LoopHandle {
  let last: number | null = null;
  let running = true;
  let rafId: number | null = null;

  function schedule() {
    const id = env.requestAnimationFrame(frame);
    rafId = typeof id === 'number' ? id : null;
  }

  function frame(ts: number) {
    if (!running) return;
    if (env.isHidden()) {
      last = null;
      schedule();
      return;
    }
    if (last == null) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    callback(dt);
    schedule();
  }

  schedule();
  return {
    stop() {
      running = false;
      env.cancelAnimationFrame(rafId ?? 0);
    },
  };
}
```

Run: `npx vitest run src/engine/loop.test.ts`
Expected: PASS

- [ ] **Step 8: input のテストを書く**

`src/engine/input.test.ts`（Node の `EventTarget` / `Event` を使い、DOM は最小限の偽物で代用する）:

```ts
import { describe, expect, it } from 'vitest';
import { createInput } from './input';

type FakeEl = EventTarget & { closest(sel: string): FakeEl | null; tag: string; parent?: FakeEl };

function el(tag: string, parent?: FakeEl): FakeEl {
  const t = new EventTarget() as FakeEl;
  t.tag = tag;
  t.parent = parent;
  t.closest = (sel) => {
    const tags = sel.split(',').map((s) => s.trim());
    for (let cur: FakeEl | undefined = t; cur; cur = cur.parent) if (tags.includes(cur.tag)) return cur;
    return null;
  };
  return t;
}

function key(type: 'keydown' | 'keyup', code: string, target: FakeEl | null = null) {
  const e = new Event(type, { cancelable: true });
  Object.defineProperty(e, 'code', { value: code });
  Object.defineProperty(e, 'target', { value: target });
  return e;
}

function setup() {
  const win = new EventTarget();
  const touchbar = el('div');
  const input = createInput({ keyTarget: win, touchbar: touchbar as unknown as HTMLElement });
  return { win, touchbar, input };
}

describe('createInput（キーボード）', () => {
  it('対応キーを押している間だけ isDown が true', () => {
    const { win, input } = setup();
    win.dispatchEvent(key('keydown', 'ArrowLeft'));
    expect(input.isDown('left')).toBe(true);
    win.dispatchEvent(key('keyup', 'ArrowLeft'));
    expect(input.isDown('left')).toBe(false);
  });

  it('Enter で onStart を呼び、既定動作を止める', () => {
    const { win, input } = setup();
    let started = 0;
    input.onStart(() => void started++);
    const e = key('keydown', 'Enter');
    win.dispatchEvent(e);
    expect(started).toBe(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it('リンクにフォーカスがあるときの Enter はゲームに渡さず、既定動作も止めない', () => {
    const { win, input } = setup();
    let started = 0;
    input.onStart(() => void started++);
    const e = key('keydown', 'Enter', el('a'));
    win.dispatchEvent(e);
    expect(started).toBe(0);
    expect(e.defaultPrevented).toBe(false);
  });

  it('touchbar 以外のボタンにフォーカスがあるときの Space もゲームに渡さない', () => {
    const { win, input } = setup();
    const e = key('keydown', 'Space', el('button'));
    win.dispatchEvent(e);
    expect(input.isDown('fire')).toBe(false);
    expect(e.defaultPrevented).toBe(false);
  });

  it('touchbar のボタンにフォーカスがあってもゲームのキーとして扱う', () => {
    const { win, touchbar, input } = setup();
    win.dispatchEvent(key('keydown', 'Space', el('button', touchbar)));
    expect(input.isDown('fire')).toBe(true);
  });

  it('destroy 後はキーに反応しない', () => {
    const { win, input } = setup();
    input.destroy();
    win.dispatchEvent(key('keydown', 'ArrowLeft'));
    expect(input.isDown('left')).toBe(false);
  });
});
```

`touchbar` の判定は `touchbar.contains(el)` を使う実装にするため、偽物の `touchbar` にも `contains` を持たせる。上の `setup()` の `touchbar` 作成直後に次を足す:

```ts
  (touchbar as FakeEl & { contains(n: unknown): boolean }).contains = (n) => {
    for (let cur = n as FakeEl | undefined; cur; cur = cur.parent) if (cur === touchbar) return true;
    return false;
  };
```

- [ ] **Step 9: 失敗を確認**

Run: `npx vitest run src/engine/input.test.ts`
Expected: FAIL（`./input` が見つからない）

- [ ] **Step 10: input を実装**

`src/engine/input.ts`: SRC `common/input.js` を 1 対 1 で移植する（KEYMAP・holder カウント・pointer の相対座標・`addButton` の press/release・`destroy` の後片付けを同じにする）。差分は次の 4 点だけ:

1. `create(opts)` を `export function createInput(opts: InputOptions): GameInput` にし、`root.GameInput = ...` を `export const KEYMAP` と `export function createInput` に変える。
2. `onKeyDown` の先頭に、フォーカス中の要素がゲーム外の操作部品なら何もしない判定を入れる:

```ts
const INTERACTIVE = 'a, button, input, select, textarea, summary, [contenteditable]';

function isForeignControl(target: EventTarget | null, touchbar: HTMLElement | null): boolean {
  const el = target as (Element & { closest?: (s: string) => Element | null }) | null;
  const control = el?.closest?.(INTERACTIVE) ?? null;
  if (!control) return false;
  return !(touchbar && touchbar.contains(control));
}
```

   `onKeyDown` は `if (isForeignControl(e.target, touchbar)) return;` で始める。`onKeyUp` には入れない（押したままフォーカスが移っても離したことは反映する）。
3. `touchbar.innerHTML = ''` を `touchbar.replaceChildren()` にする。
4. ボタン作成の `root.document` は `opts.doc ?? document` にする。**この式は `addButton` の中で評価する**（`createInput` の先頭で評価すると、`document` のない Node のテストで ReferenceError になる）。`keyTarget` の既定値 `window` も同様に、`opts.keyTarget` が未指定のときだけ参照する。

型:

```ts
export type Action = 'left' | 'right' | 'up' | 'down' | 'fire' | 'start';

export interface PointerInfo {
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
}

export interface ButtonSpec {
  label: string;
  action: Action;
  ariaLabel?: string;
}

export interface InputOptions {
  keyTarget?: EventTarget;
  pointerTarget?: HTMLElement | null;
  touchbar?: HTMLElement | null;
  doc?: Document;
}

export interface GameInput {
  keys: Record<string, boolean>;
  isDown(action: Action): boolean;
  onPointer(cb: (p: PointerInfo) => void): void;
  onStart(cb: () => void): void;
  addButton(spec: ButtonSpec): HTMLButtonElement;
  destroy(): void;
}
```

`keyTarget` の既定値は `window`。`KeyboardEvent` の `code` は `(e as KeyboardEvent).code` で読む。

- [ ] **Step 11: 通ることを確認**

Run: `npx vitest run src/engine && npm run check`
Expected: PASS、型エラー 0

- [ ] **Step 12: Commit**

```bash
git add src/engine
git commit -m "feat: port storage, loop and input engine to typescript"
```

---

### Task 3: ゲーム登録（meta 型と registry）

**Files:**
- Create: `src/lib/game-meta.ts`, `src/lib/registry-core.ts`, `src/lib/registry-core.test.ts`, `src/lib/registry.ts`

**Interfaces:**
- Produces: `GameMeta`（`slug`, `title`, `description`, `icon`, `order`）、`buildRegistry(src: GameSources): GameMeta[]`（order 昇順、問題があれば throw）、`games: GameMeta[]`（`src/lib/registry.ts`）。

- [ ] **Step 1: テストを書く**

`src/lib/registry-core.test.ts`:

```ts
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
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/lib/registry-core.test.ts`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 3: 実装**

`src/lib/game-meta.ts`:

```ts
export interface GameMeta {
  /** URL: /games/<slug>/。フォルダ名と一致させる。localStorage のスコアキーにも使う */
  slug: string;
  title: string;
  /** meta description とカードの説明文（120 字以内） */
  description: string;
  /** 絵文字 1 文字 */
  icon: string;
  /** トップの並び順（昇順） */
  order: number;
}
```

`src/lib/registry-core.ts`: REF の `registry-core.ts` をコピーし、次を変える。
- `ToolMeta` → `GameMeta`、`ToolSources` → `GameSources`、`tools` → `games`。
- `folderOf` の正規表現を `/\/games\/([^/]+)\/[^/]+$/` にする。
- カテゴリ関連（`CATEGORIES` の import、カテゴリ検査、`groupByCategory`）を削除する。
- `Tool.astro` のメッセージを `Game.astro` にする。エラーの見出しを `ゲーム登録エラー:` にする。
- 並び順は `compareGames(a, b) = a.order - b.order || a.title.localeCompare(b.title, 'ja')`。

`src/lib/registry.ts`:

```ts
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
```

- [ ] **Step 4: 通ることを確認**

Run: `npx vitest run src/lib/registry-core.test.ts && npm run check`
Expected: PASS、型エラー 0

- [ ] **Step 5: Commit**

```bash
git add src/lib/game-meta.ts src/lib/registry-core.ts src/lib/registry-core.test.ts src/lib/registry.ts
git commit -m "feat: add game registry with folder validation"
```

---

### Task 4: runner（1 ページ 1 ゲームの起動と dataLayer イベント）

**Files:**
- Create: `src/engine/runner.ts`, `src/engine/runner.test.ts`

**Interfaces:**
- Consumes: `createInput`, `GameInput`（Task 2）、`createLoop`, `LoopEnv`, `LoopHandle`（Task 2）、`ScoreStore`, `scores`（Task 2）。
- Produces:

```ts
export interface GameApi {
  setScore(n: number): void;
  submitScore(n: number): boolean; // ゲームオーバー時にだけ呼ぶ。game_over を送る
  getHighScore(): number;
  started(): void;                 // プレイ開始時に呼ぶ。game_start を送る
  loop(fn: (dt: number) => void): LoopHandle;
  input: GameInput;
  onQuit(fn: () => void): void;
  readonly stageSize: { w: number; h: number };
}
export type GameInstance = { destroy?(): void } | void;
export type CreateGame = (host: HTMLElement, api: GameApi) => GameInstance;
export interface GameElements { stage: HTMLElement; touchbar: HTMLElement; score: HTMLElement; best: HTMLElement }
export interface RunnerEnv { win: EventTarget & { dataLayer?: unknown[] }; store: ScoreStore; loopEnv?: LoopEnv; doc?: Document }
export function runGame(slug: string, create: CreateGame, els: GameElements, env: RunnerEnv): { close(): void };
export function mountGame(slug: string, create: CreateGame): void;
```

- [ ] **Step 1: テストを書く**

`src/engine/runner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LoopEnv } from './loop';
import { runGame, type CreateGame, type GameElements } from './runner';
import { createScoreStore } from './storage';

function fakeEl() {
  const t = new EventTarget() as EventTarget & {
    textContent: string;
    clientWidth: number;
    clientHeight: number;
    cleared: number;
    replaceChildren(): void;
    contains(): boolean;
    getBoundingClientRect(): { left: number; top: number };
  };
  t.textContent = '';
  t.clientWidth = 320;
  t.clientHeight = 480;
  t.cleared = 0;
  t.replaceChildren = () => void t.cleared++;
  t.contains = () => false;
  t.getBoundingClientRect = () => ({ left: 0, top: 0 });
  return t;
}

const noopLoop: LoopEnv = { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, isHidden: () => false };

function setup(create: CreateGame) {
  const els = { stage: fakeEl(), touchbar: fakeEl(), score: fakeEl(), best: fakeEl() };
  const win = new EventTarget() as EventTarget & { dataLayer?: unknown[] };
  const store = createScoreStore(() => undefined);
  const handle = runGame('tetris', create, els as unknown as GameElements, { win, store, loopEnv: noopLoop });
  return { els, win, store, handle };
}

describe('runGame', () => {
  it('SCORE と BEST を表示し、ゲームに stage と api を渡す', () => {
    let host: unknown;
    const { els } = setup((h, api) => {
      host = h;
      api.setScore(12.7);
      expect(api.stageSize).toEqual({ w: 320, h: 480 });
    });
    expect(host).toBe(els.stage);
    expect(els.score.textContent).toBe('12');
    expect(els.best.textContent).toBe('0');
  });

  it('started() で game_start を 1 回ずつ積む', () => {
    let api!: Parameters<CreateGame>[1];
    const { win } = setup((_h, a) => void (api = a));
    api.started();
    api.started();
    expect(win.dataLayer).toEqual([
      { event: 'game_start', game_id: 'tetris' },
      { event: 'game_start', game_id: 'tetris' },
    ]);
  });

  it('submitScore() で game_over を積み、ハイスコアなら BEST を更新する', () => {
    let api!: Parameters<CreateGame>[1];
    const { win, els, store } = setup((_h, a) => void (api = a));
    expect(api.submitScore(300)).toBe(true);
    expect(api.submitScore(100)).toBe(false);
    expect(win.dataLayer).toEqual([
      { event: 'game_over', game_id: 'tetris', score: 300 },
      { event: 'game_over', game_id: 'tetris', score: 100 },
    ]);
    expect(els.best.textContent).toBe('300');
    expect(store.getHighScore('tetris')).toBe(300);
  });

  it('既存の dataLayer（GTM が作ったもの）に追記する', () => {
    const els = { stage: fakeEl(), touchbar: fakeEl(), score: fakeEl(), best: fakeEl() };
    const win = Object.assign(new EventTarget(), { dataLayer: [{ event: 'gtm.js' }] as unknown[] });
    let api!: Parameters<CreateGame>[1];
    runGame('whack', (_h, a) => void (api = a), els as unknown as GameElements, {
      win,
      store: createScoreStore(() => undefined),
      loopEnv: noopLoop,
    });
    api.started();
    expect(win.dataLayer).toEqual([{ event: 'gtm.js' }, { event: 'game_start', game_id: 'whack' }]);
  });

  it('close() で onQuit・ループ停止・destroy・stage の片付けを行う', () => {
    const calls: string[] = [];
    const { els, handle } = setup((_h, api) => {
      api.onQuit(() => calls.push('quit'));
      api.loop(() => {});
      return { destroy: () => calls.push('destroy') };
    });
    handle.close();
    handle.close();
    expect(calls).toEqual(['quit', 'destroy']);
    expect(els.stage.cleared).toBe(1);
  });

  it('create が例外を投げたら stage にメッセージを出す', () => {
    const { els } = setup(() => {
      throw new Error('boom');
    });
    expect(els.stage.textContent).toBe('読み込みに失敗しました。ページを再読み込みしてください。');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/engine/runner.test.ts`
Expected: FAIL（`./runner` が見つからない）

- [ ] **Step 3: 実装**

`src/engine/runner.ts`（SRC `common/shell.js` の `openGame` / `closeGame` を 1 ゲーム用にしたもの）:

```ts
// 1 ページで 1 つのゲームを起動する。SCORE / BEST の表示とハイスコアの保存、GA4 用のイベント送信を受け持つ。
import { createInput, type GameInput } from './input';
import { createLoop, type LoopEnv, type LoopHandle } from './loop';
import { scores, type ScoreStore } from './storage';

export interface GameApi {
  setScore(n: number): void;
  /** ゲームオーバー時にだけ呼ぶ。ハイスコアなら true */
  submitScore(n: number): boolean;
  getHighScore(): number;
  /** プレイを開始したときに呼ぶ */
  started(): void;
  loop(fn: (dt: number) => void): LoopHandle;
  input: GameInput;
  onQuit(fn: () => void): void;
  readonly stageSize: { w: number; h: number };
}

export type GameInstance = { destroy?(): void } | void;
export type CreateGame = (host: HTMLElement, api: GameApi) => GameInstance;

export interface GameElements {
  stage: HTMLElement;
  touchbar: HTMLElement;
  score: HTMLElement;
  best: HTMLElement;
}

export interface RunnerEnv {
  win: EventTarget & { dataLayer?: unknown[] };
  store: ScoreStore;
  loopEnv?: LoopEnv;
  doc?: Document;
}

export function runGame(slug: string, create: CreateGame, els: GameElements, env: RunnerEnv): { close(): void } {
  const { win, store } = env;
  const track = (data: Record<string, unknown>) => (win.dataLayer = win.dataLayer ?? []).push(data);
  const input = createInput({ keyTarget: win, pointerTarget: els.stage, touchbar: els.touchbar, doc: env.doc });
  const loops: LoopHandle[] = [];
  const quitCbs: (() => void)[] = [];
  let instance: GameInstance;
  let closed = false;

  els.score.textContent = '0';
  els.best.textContent = String(store.getHighScore(slug));

  const api: GameApi = {
    setScore: (n) => void (els.score.textContent = String(Math.floor(n))),
    submitScore(n) {
      const score = Math.floor(n);
      track({ event: 'game_over', game_id: slug, score });
      const record = store.submitScore(slug, score);
      if (record) els.best.textContent = String(store.getHighScore(slug));
      return record;
    },
    getHighScore: () => store.getHighScore(slug),
    started: () => void track({ event: 'game_start', game_id: slug }),
    loop(fn) {
      const h = createLoop(fn, env.loopEnv);
      loops.push(h);
      return h;
    },
    input,
    onQuit: (fn) => void quitCbs.push(fn),
    get stageSize() {
      return { w: els.stage.clientWidth, h: els.stage.clientHeight };
    },
  };

  try {
    instance = create(els.stage, api);
  } catch (e) {
    console.error('game create failed:', e);
    els.stage.textContent = '読み込みに失敗しました。ページを再読み込みしてください。';
  }

  return {
    close() {
      if (closed) return;
      closed = true;
      for (const f of quitCbs) {
        try {
          f();
        } catch (e) {
          console.error(e);
        }
      }
      for (const h of loops) h.stop();
      input.destroy();
      try {
        instance?.destroy?.();
      } catch (e) {
        console.error(e);
      }
      els.stage.replaceChildren();
      els.touchbar.replaceChildren();
    },
  };
}

/** GameLayout の要素を探してゲームを起動する。ブラウザ専用 */
export function mountGame(slug: string, create: CreateGame): void {
  const q = (sel: string) => document.querySelector<HTMLElement>(sel);
  const stage = q('[data-stage]');
  const touchbar = q('[data-touchbar]');
  const score = q('[data-score]');
  const best = q('[data-best]');
  if (!stage || !touchbar || !score || !best) return;
  const handle = runGame(slug, create, { stage, touchbar, score, best }, { win: window, store: scores });
  window.addEventListener('pagehide', () => handle.close());
  // 「戻る」で bfcache から復帰したときは片付け済みなので、読み込み直して起動し直す
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) window.location.reload();
  });
}
```

`runGame` の `input.destroy()` は touchbar を空にするので、最後の `els.touchbar.replaceChildren()` は念のための二重呼び出しになる（安全）。テストの `touchbar.cleared` は検査しない。

- [ ] **Step 4: 通ることを確認**

Run: `npx vitest run src/engine && npm run check`
Expected: PASS、型エラー 0

- [ ] **Step 5: Commit**

```bash
git add src/engine/runner.ts src/engine/runner.test.ts
git commit -m "feat: add single-game runner with game_start and game_over events"
```

---

### Task 5: ページ（トップ・ゲームページの枠・about・privacy・404）と E2E の土台

**Files:**
- Create: `src/layouts/GameLayout.astro`, `src/components/GameCard.astro`, `src/pages/games/[slug].astro`, `src/pages/about.astro`, `src/pages/privacy.astro`, `src/pages/404.astro`, `tests/e2e/helpers.ts`, `tests/e2e/site.spec.ts`
- Modify: `src/pages/index.astro`（置き換え）, `src/styles/global.css`

**Interfaces:**
- Consumes: `games`, `GameMeta`（Task 3）、`BaseLayout`, `SITE`（Task 1）、`scores`（Task 2）。
- Produces: ゲームページの DOM 契約 `[data-stage]` / `[data-touchbar]` / `[data-score]` / `[data-best]`、`[data-game="<slug>"]`。GameLayout の名前付き slot `game` と `guide`。E2E ヘルパー `gameSlugs()`, `watchPage(page)`, `ORIGIN`。

- [ ] **Step 1: E2E ヘルパーとサイト全体の E2E を書く**

`tests/e2e/helpers.ts`: REF からコピーし、`toolSlugs` を次に置き換える:

```ts
// E2E は広告・解析の環境変数なしでビルドした dist を対象にする
export function gameSlugs(): string[] {
  const dir = 'dist/games';
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export async function dataLayerEvents(page: Page): Promise<unknown[]> {
  return page.evaluate(() =>
    (window.dataLayer ?? []).filter((e) => typeof e === 'object' && e !== null && 'event' in e && String((e as { event: string }).event).startsWith('game_')),
  );
}
```

`tests/e2e/site.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { gameSlugs, watchPage } from './helpers';

const slugs = gameSlugs();

test('トップページ: 外部通信・CSP 違反・JS エラーがない', async ({ page }) => {
  const w = watchPage(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Creator World Games');
  expect(w.external).toEqual([]);
  expect(w.cspViolations).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('CSP などのセキュリティヘッダーが付く', async ({ page }) => {
  const res = await page.goto('/');
  const headers = res!.headers();
  expect(headers['content-security-policy']).toContain("connect-src 'self'");
  expect(headers['x-content-type-options']).toBe('nosniff');
});

for (const path of ['/about/', '/privacy/', '/robots.txt', '/sitemap-index.xml', '/ads.txt']) {
  test(`${path} が 200 を返す`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(200);
  });
}

test('存在しないページは 404', async ({ request }) => {
  expect((await request.get('/no-such-page/')).status()).toBe(404);
});

test('トップにすべてのゲームのカードがあり、BEST を表示する', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.game-card')).toHaveCount(slugs.length);
  for (const slug of slugs) {
    await expect(page.locator(`.game-card[data-slug="${slug}"] [data-best]`)).toHaveText('BEST 0');
  }
});

test('サイトマップに全ゲームのページが含まれる', async ({ request }) => {
  const index = await (await request.get('/sitemap-index.xml')).text();
  const child = /<loc>https:\/\/browser-games\.creator-world\.net\/([^<]+)<\/loc>/.exec(index)![1];
  const xml = await (await request.get(`/${child}`)).text();
  for (const slug of slugs) expect(xml).toContain(`/games/${slug}/`);
  expect(xml).toContain('/about/');
});

test('環境変数なしのビルドでは広告枠と GTM を出力しない', async ({ page }) => {
  test.skip(slugs.length === 0, 'ゲームがまだない');
  await page.goto(`/games/${slugs[0]}/`);
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
  await expect(page.locator('[data-gtm-id]')).toHaveCount(0);
});

test('各ページの title・description・canonical が一意', async ({ page }) => {
  const seen = new Set<string>();
  for (const path of ['/', '/about/', '/privacy/', ...slugs.map((s) => `/games/${s}/`)]) {
    await page.goto(path);
    const title = await page.title();
    const desc = await page.locator('meta[name="description"]').getAttribute('content');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(`https://browser-games.creator-world.net${path}`);
    for (const v of [title, desc]) {
      expect(seen.has(v!), `${path}: 重複 ${v}`).toBe(false);
      seen.add(v!);
    }
  }
});

for (const slug of slugs) {
  test(`${slug}: ページ表示で外部通信・CSP 違反・JS エラーがない`, async ({ page }) => {
    const w = watchPage(page);
    await page.goto(`/games/${slug}/`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator(`[data-game="${slug}"] [data-stage] > *`).first()).toBeVisible();
    expect(w.external).toEqual([]);
    expect(w.cspViolations).toEqual([]);
    expect(w.errors).toEqual([]);
  });

  test(`${slug}: パンくずのリンクにフォーカスして Enter でトップへ移動できる`, async ({ page }) => {
    await page.goto(`/games/${slug}/`);
    await page.locator('.breadcrumb a[href="/"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/');
  });

  test(`${slug}: 「戻る」で戻ってもゲームが表示され、JS エラーがない`, async ({ page }) => {
    const w = watchPage(page);
    await page.goto(`/games/${slug}/`);
    await page.goto('/about/');
    await page.goBack();
    await expect(page.locator(`[data-game="${slug}"] [data-stage] > *`).first()).toBeVisible();
    expect(w.errors).toEqual([]);
  });
}
```

- [ ] **Step 2: レイアウト・カード・ページを作る**

`src/layouts/GameLayout.astro`:

```astro
---
import type { GameMeta } from '../lib/game-meta';
import BaseLayout from './BaseLayout.astro';

interface Props {
  game: GameMeta;
  others: GameMeta[];
}

const { game, others } = Astro.props;
---

<BaseLayout title={game.title} description={game.description}>
  <nav class="breadcrumb" aria-label="パンくずリスト">
    <ol>
      <li><a href="/">トップ</a></li>
      <li aria-current="page">{game.title}</li>
    </ol>
  </nav>
  <h1>{game.icon} {game.title}</h1>
  <p class="lead">{game.description}</p>

  <section class="game" data-game={game.slug} aria-label="ゲーム">
    <div class="game-hud">
      <span class="hud"><b>SCORE</b> <span data-score>0</span></span>
      <span class="hud"><b>BEST</b> <span data-best>0</span></span>
    </div>
    <div class="stage" data-stage></div>
    <div class="touchbar" data-touchbar></div>
    <noscript><p>このゲームを遊ぶには JavaScript を有効にしてください。</p></noscript>
    <slot name="game" />
  </section>

  <article class="guide">
    <slot name="guide" />
  </article>

  <slot name="after-guide" />

  {
    others.length > 0 && (
      <section class="related">
        <h2>ほかのゲーム</h2>
        <ul>
          {others.map((g) => (
            <li>
              <a href={`/games/${g.slug}/`}>
                {g.icon} {g.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  <slot name="footer-ad" />
</BaseLayout>
```

（`after-guide` と `footer-ad` の slot には Task 10 で `AdSlot` を差し込む。）

`src/pages/games/[slug].astro`:

```astro
---
import type { AstroInstance, MarkdownInstance } from 'astro';
import GameLayout from '../../layouts/GameLayout.astro';
import type { GameMeta } from '../../lib/game-meta';
import { games } from '../../lib/registry';

export function getStaticPaths() {
  return games.map((game) => ({ params: { slug: game.slug }, props: { game } }));
}

interface Props {
  game: GameMeta;
}

const { game } = Astro.props;
const components = import.meta.glob<AstroInstance>('../../games/*/Game.astro', { eager: true });
const guides = import.meta.glob<MarkdownInstance<Record<string, never>>>('../../games/*/guide.md', { eager: true });
const Game = components[`../../games/${game.slug}/Game.astro`].default;
const Guide = guides[`../../games/${game.slug}/guide.md`].Content;
const others = games.filter((g) => g.slug !== game.slug);
---

<GameLayout game={game} others={others}>
  <Game slot="game" />
  <Guide slot="guide" />
</GameLayout>
```

`src/components/GameCard.astro`:

```astro
---
import type { GameMeta } from '../lib/game-meta';

interface Props {
  game: GameMeta;
}

const { game } = Astro.props;
---

<li class="game-card" data-slug={game.slug}>
  <a href={`/games/${game.slug}/`}>
    <span class="emoji" aria-hidden="true">{game.icon}</span>
    <span class="title">{game.title}</span>
    <span class="desc">{game.description}</span>
    <span class="best" data-best hidden></span>
  </a>
</li>
```

`src/pages/index.astro`（置き換え）:

```astro
---
import GameCard from '../components/GameCard.astro';
import BaseLayout from '../layouts/BaseLayout.astro';
import { games } from '../lib/registry';
import { SITE } from '../lib/site';
---

<BaseLayout
  title={SITE.name}
  description="インベーダー・ブロック崩し・もぐらたたき・テトリスをブラウザですぐ遊べる無料ゲーム集。登録不要、スマホのタッチ操作にも対応しています。"
>
  <section class="hero">
    <h1>{SITE.name}</h1>
    <p>{SITE.tagline}</p>
    <p class="tagline">ログイン不要・ハイスコアはこの端末にだけ保存されます</p>
  </section>

  <ul class="game-grid">
    {games.map((g) => <GameCard game={g} />)}
  </ul>
  {games.length === 0 && <p>ゲームは準備中です。</p>}

  <section class="intro">
    <h2>このサイトについて</h2>
    <p>
      {SITE.name} は、昔ながらのアーケードゲームをブラウザだけで遊べる無料のゲーム集です。インストールや会員登録は不要で、PC ではキーボード、スマホでは画面のボタンやタップで操作できます。各ゲームのページに遊び方と攻略のコツを載せています。
    </p>
  </section>
</BaseLayout>

<script>
  import { scores } from '../engine/storage';

  for (const card of document.querySelectorAll<HTMLElement>('.game-card')) {
    const best = card.querySelector<HTMLElement>('[data-best]');
    if (!best || !card.dataset.slug) continue;
    best.textContent = `BEST ${scores.getHighScore(card.dataset.slug)}`;
    best.hidden = false;
  }
</script>
```

`src/pages/404.astro`: REF からそのままコピーする。

`src/pages/about.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { SITE } from '../lib/site';
---

<BaseLayout title="このサイトについて" description={`${SITE.name} の目的と運営方針です。`}>
  <h1>このサイトについて</h1>
  <p>
    {SITE.name} は、インベーダーやブロック崩しなどのシンプルなゲームを、ブラウザを開くだけで遊べる無料のゲーム集です。
  </p>

  <h2>インストール・登録は不要</h2>
  <p>アプリのインストールや会員登録は必要ありません。PC ではキーボード、スマホでは画面のボタンとタップで遊べます。</p>

  <h2>ハイスコアの保存</h2>
  <p>各ゲームのハイスコアはお使いのブラウザにだけ保存され、当サイトのサーバーへ送信されません。</p>

  <h2>運営</h2>
  <p>運営: Creator World（creator-world.net）</p>
  <p>当サイトは広告収入によって運営しています。</p>
</BaseLayout>
```

`src/pages/privacy.astro`: REF からコピーし、次を変える。
- 「入力・アップロードしたデータについて」の節を削除し、代わりに次の節を置く:

```astro
  <h2>ゲームのデータについて</h2>
  <p>
    ゲームの操作やスコアはお使いのブラウザ内で処理します。当サイトのサーバーへ送信・保存することはありません。ただし、下記「アクセス解析について」のとおり、ゲームを始めたこと・ゲームオーバーになったこととそのスコアを、個人を特定しない形でアクセス解析に送ります。
  </p>
```

- 「ブラウザに保存する情報」のリストを `<li>各ゲームのハイスコア（整数）</li>` の 1 項目にする。
- 「アクセス解析について」の 1 段落目の「ツールに入力・アップロードしたデータは収集の対象になりません」を「ゲームについては、開始・ゲームオーバーの回数とスコアだけを送ります」に変える。
- 「免責事項」を次にする: `当サイトのゲームは現状のまま提供しています。当サイトの利用により生じた損害について、当サイトは責任を負いかねます。`
- 「制定日」を `2026 年 9 月 26 日` にする（公開日に合わせて Task 12 で直す）。

- [ ] **Step 3: CSS を足す**

`src/styles/global.css` に、SRC `style.css` のカード（`.card` → `.game-card a`）・`#topbar .hud` → `.game-hud .hud`・`#stage` → `.stage`・`#touchbar` → `.touchbar` のルールを移し、次を守る:
- `touch-action:none` は `.stage`・`.stage canvas`・`.touchbar button` だけに付ける（ページ全体・`.game` には付けない）。
- `.game-grid` は SRC `#grid` と同じ `grid-template-columns:repeat(auto-fill, minmax(150px,1fr))`、`list-style:none; padding:0`。
- `.game-card a` は SRC `.card` と同じ見た目で、`color:inherit; text-decoration:none`。
- `.stage` は `display:flex; align-items:center; justify-content:center`。`.stage canvas` は `max-width:100%; max-height:70vh`（現行と同じ）。
- `@media (hover:hover) and (pointer:fine) { .touchbar:empty { display:none; } }`（現行と同じ）。

- [ ] **Step 4: E2E を実行**

Run: `npm run check && npm run build && npx playwright install chromium && npm run test:e2e`
Expected: PASS（ゲームがまだ 0 本なので `for (const slug of slugs)` のテストは生成されず、`環境変数なし…` は skip）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add home, game layout, about, privacy and 404 pages"
```

---

### Task 6〜9 共通: ゲームの移植手順

各ゲームは同じ手順で移植する。ゲーム固有の内容は各 Task に書く。

**game.ts の移植規則**（SRC `games/<slug>.js` の `create: function (host, api) { ... }` の中身を移す）:

1. ファイルの形:

```ts
import type { CreateGame } from '../../engine/runner';
// ロジックがあれば: import { ... } from './logic';

export const create: CreateGame = (host, api) => {
  // ここに SRC の create 本体を移す
  return { destroy: () => { h.stop(); host.replaceChildren(); } };
};
```

2. `var` → `const` / `let`（再代入があれば `let`）。`function` 宣言はそのまま（内部関数の巻き上げに依存しているため）。
3. `root.document` / `doc` → `document`、`root.matchMedia` → `window.matchMedia`、`root.setTimeout` → `window.setTimeout`。
4. `XxxLogic.foo` / `T.foo` / `BreakoutPhysics.foo` → `logic.ts` から import した関数。
5. canvas は `const ctx = canvas.getContext('2d')!;`。
6. `host.innerHTML = ''` → `host.replaceChildren()`。`wrap.innerHTML = '<...>'` のような静的 HTML は `createElement` と `textContent` で同じ構造を作る（クラス名・インラインスタイル・文言は同じ）。
7. 数値・色・文言・状態遷移・呼び出し順は変えない。型注釈は必要最小限（状態オブジェクトには `interface` を付ける）。
8. **追加するのは `api.started()` の呼び出しだけ**（場所は各 Task に明記）。`api.submitScore` の呼び出し位置は変えない。

**Game.astro**（全ゲーム共通。`<slug>` だけ変える）:

```astro
<script>
  import { mountGame } from '../../engine/runner';
  import { create } from './game';
  import { meta } from './meta';

  mountGame(meta.slug, create);
</script>
```

**guide.md の構成**（800〜1,500 字。`##` 見出しで次の順。事実は各 Task の「解説に書く事実」だけを使い、書かれていない仕様を作らない）:

```md
## 遊び方
## 操作方法
（キーボードとタッチを表で）
## 得点のしくみ
## 攻略のコツ
## よくある質問
（### Q で 3 問以上。「ハイスコアはどこに保存されますか？」→ このブラウザにだけ保存、サイトデータを消すと消える、を必ず含める）
```

**ゲームの E2E**（`tests/e2e/games/<slug>.spec.ts`）は各 Task に全文を書く。

---

### Task 6: もぐらたたき（whack）

**Files:**
- Create: `src/games/whack/meta.ts`, `logic.ts`, `logic.test.ts`, `game.ts`, `Game.astro`, `guide.md`, `tests/e2e/games/whack.spec.ts`

**Interfaces:**
- Consumes: `CreateGame`, `mountGame`（Task 4）、`GameMeta`（Task 3）。
- Produces: `HOLES = 9`, `DURATION = 30`, `difficulty(t: number): { gap: number; upMax: number; upMin: number }`。

- [ ] **Step 1: ロジックのテストを書く**（SRC `tests/whack.test.js` の移植）

`src/games/whack/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { difficulty, DURATION, HOLES } from './logic';

describe('whack logic', () => {
  it('穴は 9 個、制限時間は 30 秒', () => {
    expect(HOLES).toBe(9);
    expect(DURATION).toBe(30);
  });

  it('時間が進むほど出現間隔と滞在時間が短くなり、下限がある', () => {
    const d0 = difficulty(0);
    const d30 = difficulty(30);
    expect(d0.gap).toBeGreaterThan(d30.gap);
    expect(d30.gap).toBeGreaterThanOrEqual(0.35);
    expect(d0.upMax).toBeGreaterThan(d0.upMin);
    expect(d30.upMax).toBeLessThanOrEqual(d0.upMax);
    expect(d30.upMin).toBeGreaterThanOrEqual(0.4);
  });

  it('現行と同じ値（開始時と 30 秒後）', () => {
    expect(difficulty(0)).toEqual({ gap: 1.1, upMax: 1.3, upMin: 0.9 });
    const end = difficulty(30);
    expect(end.gap).toBeCloseTo(0.35);
    expect(end.upMax).toBeCloseTo(0.7);
    expect(end.upMin).toBeCloseTo(0.4);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/games/whack`
Expected: FAIL（`./logic` が見つからない）

- [ ] **Step 3: ロジックと meta を実装**

`src/games/whack/logic.ts`:

```ts
export const HOLES = 9;
export const DURATION = 30;

/** 経過秒 t から出現間隔と滞在時間の範囲（秒）を返す */
export function difficulty(t: number): { gap: number; upMax: number; upMin: number } {
  const p = Math.min(1, t / 30); // 0→1 の進行度
  const gap = 1.1 - 0.75 * p; // 1.1s → 0.35s
  const upMax = 1.3 - 0.6 * p; // 1.3s → 0.7s
  const upMin = 0.9 - 0.5 * p; // 0.9s → 0.4s
  return { gap: Math.max(0.35, gap), upMax, upMin: Math.max(0.4, upMin) };
}
```

`src/games/whack/meta.ts`:

```ts
import type { GameMeta } from '../../lib/game-meta';

export const meta: GameMeta = {
  slug: 'whack',
  title: 'もぐらたたき',
  description: '出てきたもぐらをタップ！30 秒間でどれだけたたけるかの得点勝負。後半ほどもぐらが速くなります。',
  icon: '🔨',
  order: 3,
};
```

Run: `npx vitest run src/games/whack`
Expected: PASS

- [ ] **Step 4: game.ts・Game.astro を作る**

共通の移植規則で SRC `games/whack.js` の `create` 本体を `src/games/whack/game.ts` に移す。`wrap.innerHTML` の 3 要素（`.whack-info`（中に `のこり ` + `<b class="wtime">30.0</b>` + `s`）、`.whack-grid`、`.whack-msg`）は `createElement` で同じ構造・同じ `style.cssText` にする。

`api.started()` を呼ぶ場所: `reset()` の最後（初回表示時の自動開始と、終了後のリトライの両方で 1 回ずつ送る）。

`Game.astro` は共通の内容。

- [ ] **Step 5: 解説を書く**

`src/games/whack/guide.md`。解説に書く事実:
- 穴は 3×3 の 9 個。ページを開くとすぐに 30 秒のゲームが始まる。
- もぐら（🐹）をタップ／クリックすると 1 点。たたくと 💥 が一瞬出る。
- 出現間隔は開始時 1.1 秒 → 30 秒後 0.35 秒、1 匹の滞在時間は開始時 0.9〜1.3 秒 → 終盤 0.4〜0.7 秒と、後半ほど速く短くなる。
- 時間切れで「しゅうりょう！ スコア N」を表示。ハイスコアなら「🏆新記録！」。
- もう一度遊ぶ: 画面（ゲーム領域）をタップ、または Enter。
- キーボードで穴をたたく操作はない（クリック／タップのみ）。

- [ ] **Step 6: E2E を書く**

`tests/e2e/games/whack.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

test('もぐらたたき: 9 個の穴があり、開くとすぐ始まって game_start を 1 回送る', async ({ page }) => {
  await page.goto('/games/whack/');
  await expect(page.locator('[data-stage] .whack-hole')).toHaveCount(9);
  await expect(page.locator('.wtime')).not.toHaveText('30.0');
  expect(await dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'whack' }]);
});

test('もぐらたたき: 出てきたもぐらをクリックすると SCORE が増える', async ({ page }) => {
  await page.goto('/games/whack/');
  const mole = page.locator('.whack-hole', { hasText: '🐹' }).first();
  await mole.waitFor();
  await mole.click();
  await expect(page.locator('[data-score]')).not.toHaveText('0');
});
```

- [ ] **Step 7: 全体を確認**

Run: `npm run check && npm test && npm run build && npm run test:e2e`
Expected: すべて PASS（site.spec の whack 分も含む）

- [ ] **Step 8: Commit**

```bash
git add src/games/whack tests/e2e/games/whack.spec.ts
git commit -m "feat(whack): port whack-a-mole to astro with guide"
```

---

### Task 7: ブロック崩し（breakout）

**Files:**
- Create: `src/games/breakout/meta.ts`, `logic.ts`, `logic.test.ts`, `game.ts`, `Game.astro`, `guide.md`, `tests/e2e/games/breakout.spec.ts`

**Interfaces:**
- Consumes: `CreateGame`, `mountGame`（Task 4）、`GameMeta`（Task 3）。
- Produces: `reflectPaddle(ballCx: number, paddleX: number, paddleW: number, speed: number): { vx: number; vy: number }`、`hitBrick(ball: Ball, brick: Rect): 'x' | 'y' | null`、`interface Ball { x: number; y: number; r: number; vx: number; vy: number }`、`interface Rect { x: number; y: number; w: number; h: number }`。

- [ ] **Step 1: ロジックのテストを書く**（SRC `tests/breakout.test.js` の移植）

`src/games/breakout/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hitBrick, reflectPaddle } from './logic';

describe('reflectPaddle', () => {
  it('中央に当たるとほぼ真上へ', () => {
    const c = reflectPaddle(100, 80, 40, 300);
    expect(Math.abs(c.vx)).toBeLessThan(1e-6);
    expect(c.vy).toBeLessThan(0);
  });

  it('右寄りに当たると右上へ、速度の大きさは保つ', () => {
    const r = reflectPaddle(118, 80, 40, 300);
    expect(r.vx).toBeGreaterThan(0);
    expect(r.vy).toBeLessThan(0);
    expect(Math.abs(Math.hypot(r.vx, r.vy) - 300)).toBeLessThan(1);
  });
});

describe('hitBrick', () => {
  const brick = { x: 0, y: 0, w: 40, h: 20 };

  it('下面に接触すると縦に反射', () => {
    expect(hitBrick({ x: 20, y: 24, r: 6, vx: 0, vy: -100 }, brick)).toBe('y');
  });

  it('左面に接触すると横に反射', () => {
    expect(hitBrick({ x: -4, y: 10, r: 6, vx: 100, vy: 0 }, brick)).toBe('x');
  });

  it('離れていれば衝突しない', () => {
    expect(hitBrick({ x: 200, y: 200, r: 6, vx: 0, vy: 0 }, brick)).toBeNull();
    expect(hitBrick({ x: 20, y: 30, r: 6, vx: 0, vy: -100 }, brick)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/games/breakout`
Expected: FAIL

- [ ] **Step 3: ロジックと meta を実装**

`src/games/breakout/logic.ts`:

```ts
export interface Ball {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** パドルに当たった位置から反射後の速度を返す（中央=真上、端ほど最大 60° 傾く） */
export function reflectPaddle(ballCx: number, paddleX: number, paddleW: number, speed: number): { vx: number; vy: number } {
  let rel = (ballCx - (paddleX + paddleW / 2)) / (paddleW / 2); // -1..1
  if (rel < -1) rel = -1;
  if (rel > 1) rel = 1;
  const maxAngle = (60 * Math.PI) / 180;
  const angle = rel * maxAngle;
  return { vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle) };
}

/** ボールとブロックの衝突判定。反射する軸を返す */
export function hitBrick(ball: Ball, brick: Rect): 'x' | 'y' | null {
  // 円の中心を矩形にクランプした最近接点で衝突判定
  const nx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const ny = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - nx;
  const dy = ball.y - ny;
  if (dx * dx + dy * dy > ball.r * ball.r) return null;
  const overlapX = ball.r - Math.abs(dx);
  const overlapY = ball.r - Math.abs(dy);
  if (nx > brick.x && nx < brick.x + brick.w) return 'y'; // 上下面に接触
  if (ny > brick.y && ny < brick.y + brick.h) return 'x'; // 左右面に接触
  return overlapX < overlapY ? 'x' : 'y'; // 角は浅い方
}
```

`src/games/breakout/meta.ts`:

```ts
import type { GameMeta } from '../../lib/game-meta';

export const meta: GameMeta = {
  slug: 'breakout',
  title: 'ブロック崩し',
  description: 'パドルでボールを弾いてブロックを全部消そう。全消しで次の面へ、面が進むほどボールが速くなります。',
  icon: '🧱',
  order: 2,
};
```

Run: `npx vitest run src/games/breakout`
Expected: PASS

- [ ] **Step 4: game.ts・Game.astro を作る**

共通の移植規則で SRC `games/breakout.js` の `create` 本体を移す。

`api.started()` を呼ぶ場所: `startGame()` で `let fresh = true` にし、`launch()` の中で `if (fresh) { fresh = false; api.started(); }`。初回表示時の `startGame()` では送らず、最初の発射で 1 回送る。ミス後・次の面の発射では送らない。

- [ ] **Step 5: 解説を書く**

`src/games/breakout/guide.md`。解説に書く事実:
- ブロックは 8 列×5 段。得点は上の段から 50・40・30・20・10 点。
- 残機 3。ボールを下に落とすと 1 減り、0 でゲームオーバー。
- 全部消すと「CLEAR!」のあと次の面。面ごとにボールの基本速度が 300 から 40 ずつ上がる。
- パドルの中央に当てると真上、端に当てるほど斜め（最大 60°）に跳ね返る。
- 操作: パドル＝マウス／指の位置に追従、`←` `→`（`A` `D`）、画面の ◀ ▶。発射・リトライ＝画面タップ／クリック、`Enter`。（Space では発射しない）
- ゲームオーバー後は画面タップか Enter でリトライ。

- [ ] **Step 6: E2E を書く**

`tests/e2e/games/breakout.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

test('ブロック崩し: canvas があり、発射するまで game_start を送らない', async ({ page }) => {
  await page.goto('/games/breakout/');
  await expect(page.locator('[data-stage] canvas')).toBeVisible();
  expect(await dataLayerEvents(page)).toEqual([]);
  await page.locator('[data-stage] canvas').click();
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'breakout' }]);
});

test('ブロック崩し: Enter で発射できる', async ({ page }) => {
  await page.goto('/games/breakout/');
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter');
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'breakout' }]);
});
```

- [ ] **Step 7: 全体を確認**

Run: `npm run check && npm test && npm run build && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 8: Commit**

```bash
git add src/games/breakout tests/e2e/games/breakout.spec.ts
git commit -m "feat(breakout): port breakout to astro with guide"
```

---

### Task 8: テトリス（tetris）

**Files:**
- Create: `src/games/tetris/meta.ts`, `logic.ts`, `logic.test.ts`, `game.ts`, `Game.astro`, `guide.md`, `tests/e2e/games/tetris.spec.ts`

**Interfaces:**
- Consumes: `CreateGame`, `mountGame`（Task 4）、`GameMeta`（Task 3）。
- Produces: `type Cell = [number, number]`、`type Board = number[][]`、`SHAPES: Cell[][][]`、`createBoard(cols, rows): Board`、`canPlace(board, cells, x, y): boolean`、`merge(board, cells, x, y, colorIdx): Board`、`clearLines(board): { board: Board; cleared: number }`、`lineScore(cleared, level): number`、`levelFor(totalLines): number`、`dropInterval(level): number`。

- [ ] **Step 1: ロジックのテストを移植**

`src/games/tetris/logic.test.ts`: SRC `tests/tetris.test.js` の全アサーションを、同じ値・同じ順で Vitest に書き換える。規則:
- `require('../games/tetris.js')` → `import * as T from './logic';`
- 見出しコメント（`// --- SHAPES ...` など）ごとに `describe` / `it` を 1 つ作り、`it` の名前はそのコメントの文言にする。
- `assert.strictEqual(a, b, msg)` → `expect(a, msg).toBe(b)`、`assert.deepStrictEqual` → `toEqual`、`assert.ok(x, msg)` → `expect(x, msg).toBe(true)`。
- 末尾の `console.log(...)` は削除。

例（最初の 2 ブロック。残りも同じ規則で全部移す）:

```ts
import { describe, expect, it } from 'vitest';
import * as T from './logic';

describe('SHAPES', () => {
  it('7 種 × 4 回転、各 4 セル、座標は 0..3', () => {
    expect(T.SHAPES.length).toBe(7);
    for (let t = 0; t < 7; t++) {
      expect(T.SHAPES[t].length, `type ${t + 1} は4回転`).toBe(4);
      for (let r = 0; r < 4; r++) {
        const cells = T.SHAPES[t][r];
        expect(cells.length, `type ${t + 1} rot ${r} は4セル`).toBe(4);
        for (const c of cells) expect(c[0] >= 0 && c[0] <= 3 && c[1] >= 0 && c[1] <= 3).toBe(true);
      }
    }
  });

  it('O ミノは回転しても同じ形', () => {
    const oSet = T.SHAPES[1].map((r) => r.map((c) => c.join(',')).sort().join(' '));
    expect(oSet.every((s) => s === oSet[0])).toBe(true);
  });
});

describe('createBoard', () => {
  it('指定サイズの空盤面を作る', () => {
    const empty = T.createBoard(10, 20);
    expect(empty.length).toBe(20);
    expect(empty[0].length).toBe(10);
    expect(empty.every((row) => row.every((v) => v === 0))).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/games/tetris`
Expected: FAIL

- [ ] **Step 3: ロジックと meta を実装**

`src/games/tetris/logic.ts`: SRC `games/tetris.js` の `SHAPES` 配列（コメント含む）と `TetrisLogic` の 7 関数を、同じ処理のまま `export const SHAPES: Cell[][][]` と `export function ...` に移す（`var` → `const`/`let`、型は Interfaces 欄の通り）。

`src/games/tetris/meta.ts`:

```ts
import type { GameMeta } from '../../lib/game-meta';

export const meta: GameMeta = {
  slug: 'tetris',
  title: 'テトリス',
  description: '落ちてくるブロックを回転・移動して横一列をそろえて消そう。10 ライン消すごとにレベルが上がり落下が速くなります。',
  icon: '🟦',
  order: 4,
};
```

Run: `npx vitest run src/games/tetris`
Expected: PASS

- [ ] **Step 4: game.ts・Game.astro を作る**

共通の移植規則で SRC `games/tetris.js` の `create` 本体（`KEY_ROWS` の凡例描画、`showKeys` の判定、DAS/ARR、ロック遅延、描画を含む）を移す。`T.xxx` は `import * as T from './logic';` でそのまま使える。

`api.started()` を呼ぶ場所: `api.input.onStart` のハンドラの中で `startGame()` の直後（`if (state === STATE.READY || state === STATE.OVER) { startGame(); api.started(); }`）。初回表示時の `startGame(); state = STATE.READY;` では送らない。

- [ ] **Step 5: 解説を書く**

`src/games/tetris/guide.md`。解説に書く事実:
- 盤面は 10 列×20 行。ブロック（ミノ）は I・O・T・S・Z・J・L の 7 種。右側に NEXT（次のミノ）を表示。
- 横一列がそろうと消える。得点は同時に消した列数で 1 列 100・2 列 300・3 列 500・4 列 800 点 × レベル。
- ソフトドロップで 1 マス下がるごとに 1 点、ハードドロップで落ちたマス数 × 2 点。
- レベル 1 開始、累計 10 ラインごとに +1。落下間隔はレベル 1 で 0.8 秒、1 レベルごとに 0.07 秒短く、最短 0.08 秒。
- 接地してから 0.5 秒は動かせる（その間に横移動・回転できる）。回転は右回りのみで、壁際で回転できない位置では回転しない。
- 左右キーは押し続けると連続で動く。
- 新しいミノが出る場所がふさがるとゲームオーバー。
- 操作: 移動 `←` `→`（`A` `D`）・◀ ▶／回転 `↑`（`W`）・↻／ソフトドロップ `↓`（`S`）・▼／ハードドロップ `Space`・⇩／開始・リトライ `Enter`・画面タップ。PC では画面内にキー凡例を表示。

- [ ] **Step 6: E2E を書く**

`tests/e2e/games/tetris.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

test('テトリス: Enter で開始して game_start を 1 回送る', async ({ page }) => {
  await page.goto('/games/tetris/');
  await expect(page.locator('[data-stage] canvas')).toBeVisible();
  expect(await dataLayerEvents(page)).toEqual([]);
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // プレイ中の Enter では送らない
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'tetris' }]);
});

test('テトリス: ハードドロップを続けるとゲームオーバーになり game_over を 1 回送る', async ({ page }) => {
  await page.goto('/games/tetris/');
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter');
  for (let i = 0; i < 40; i++) {
    // ハードドロップは押した瞬間をフレームごとに検出するため、1 フレーム以上押し続ける
    await page.keyboard.down('Space');
    await page.waitForTimeout(50);
    await page.keyboard.up('Space');
    await page.waitForTimeout(20);
    const over = (await dataLayerEvents(page)).some((e) => (e as { event: string }).event === 'game_over');
    if (over) break;
  }
  const events = await dataLayerEvents(page);
  const overs = events.filter((e) => (e as { event: string }).event === 'game_over');
  expect(overs).toHaveLength(1);
  expect(overs[0]).toMatchObject({ game_id: 'tetris', score: expect.any(Number) });
});
```

- [ ] **Step 7: 全体を確認**

Run: `npm run check && npm test && npm run build && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 8: Commit**

```bash
git add src/games/tetris tests/e2e/games/tetris.spec.ts
git commit -m "feat(tetris): port tetris to astro with guide"
```

---

### Task 9: インベーダー（invader）

**Files:**
- Create: `src/games/invader/meta.ts`, `logic.ts`, `logic.test.ts`, `game.ts`, `Game.astro`, `guide.md`, `tests/e2e/games/invader.spec.ts`

**Interfaces:**
- Consumes: `CreateGame`, `mountGame`（Task 4）、`GameMeta`（Task 3）。
- Produces: `aabb(a: Rect, b: Rect): boolean`、`INVADER_SCORES = [30, 20, 10]`、`UFO_SCORES = [50, 100, 150, 300]`、`scoreForRow(row: number): number`。

インベーダーは現行テストがないため、SRC の中から副作用のない小さな関数・定数だけを `logic.ts` に出す（spec §4「無理に切り出さない」）。

- [ ] **Step 1: ロジックのテストを書く**

`src/games/invader/logic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aabb, scoreForRow, UFO_SCORES } from './logic';

describe('invader logic', () => {
  it('段ごとの得点: 1 段目 30、2〜3 段目 20、4〜5 段目 10', () => {
    expect([0, 1, 2, 3, 4].map(scoreForRow)).toEqual([30, 20, 20, 10, 10]);
  });

  it('UFO の得点は 4 通り', () => {
    expect(UFO_SCORES).toEqual([50, 100, 150, 300]);
  });

  it('aabb: 重なりを判定し、辺が接しているだけなら重ならない', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(aabb(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabb(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(aabb(a, { x: 0, y: 20, w: 10, h: 10 })).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/games/invader`
Expected: FAIL

- [ ] **Step 3: ロジックと meta を実装**

`src/games/invader/logic.ts`:

```ts
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 上の段から squid / crab / octopus の得点 */
export const INVADER_SCORES = [30, 20, 10] as const;
export const UFO_SCORES = [50, 100, 150, 300] as const;

/** 行番号（0 始まり）から敵の種類の添字を返す。0 段目=0、1〜2 段目=1、それ以外=2 */
export function typeIndexForRow(row: number): 0 | 1 | 2 {
  if (row === 0) return 0;
  if (row <= 2) return 1;
  return 2;
}

export function scoreForRow(row: number): number {
  return INVADER_SCORES[typeIndexForRow(row)];
}

export function aabb(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
```

`src/games/invader/meta.ts`:

```ts
import type { GameMeta } from '../../lib/game-meta';

export const meta: GameMeta = {
  slug: 'invader',
  title: 'インベーダー',
  description: '迫ってくる敵の編隊を撃ち落とそう。ときどき現れる UFO を撃つとボーナス得点。全滅させると次のウェーブへ。',
  icon: '👾',
  order: 1,
};
```

Run: `npx vitest run src/games/invader`
Expected: PASS

- [ ] **Step 4: game.ts・Game.astro を作る**

共通の移植規則で SRC `games/invader.js` の `create` 本体を移す。追加の差分:
- `typeForRow(row)` は `INV_TYPES[typeIndexForRow(row)]` に、`INV_TYPES` の `score` は `INVADER_SCORES[i]` に、UFO の `[50, 100, 150, 300]` は `UFO_SCORES` に、`aabb` は `logic.ts` の関数に置き換える（値は同じ）。
- 先頭の `"use strict";` は削除（ES モジュールは常に strict）。

`api.started()` を呼ぶ場所: `api.input.onStart` のハンドラで `startGame()` の直後（`if (state !== STATE.PLAYING) { startGame(); api.started(); }`）。

- [ ] **Step 5: 解説を書く**

`src/games/invader/guide.md`。解説に書く事実:
- 敵は 11 列×5 段の編隊。得点は 1 段目 30 点、2〜3 段目 20 点、4〜5 段目 10 点。
- 画面上部を横切る UFO を撃つと 50・100・150・300 点のどれか。
- 編隊は左右に動きながら端で下がってくる。敵が自機のラインまで降りてくると残機に関係なくゲームオーバー。
- 残機 3。敵の弾に当たると 1 減る（その後しばらく点滅）。
- 4 つのバリア（トーチカ）は敵味方どちらの弾でも削れる。
- 全滅させると次のウェーブ。
- 自機の弾は連射に間隔がある（約 0.34 秒）。
- 操作: 移動 `←` `→`（`A` `D`）・◀ ▶／発射 `Space`・FIRE（押し続けると連射）／開始・リトライ `Enter`・画面タップ。

（上の「約 0.34 秒」「端で下がる」「バリアが削れる」は SRC の `PLAYER_FIRE_COOLDOWN = 0.34`、`FORMATION_DROP`、バリアの `grid` 更新処理で確認してから書く。実装と違えばその記述を削る。）

- [ ] **Step 6: E2E を書く**

`tests/e2e/games/invader.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { dataLayerEvents } from '../helpers';

test('インベーダー: canvas があり、Enter で開始して game_start を 1 回送る', async ({ page }) => {
  await page.goto('/games/invader/');
  await expect(page.locator('[data-stage] canvas')).toBeVisible();
  expect(await dataLayerEvents(page)).toEqual([]);
  await page.locator('h1').click(); // リンク以外をクリックしてフォーカスをページに戻す
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect.poll(() => dataLayerEvents(page)).toEqual([{ event: 'game_start', game_id: 'invader' }]);
});

test('インベーダー: スマホ幅でも FIRE ボタンが表示される', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/games/invader/');
  await expect(page.getByRole('button', { name: '発射' })).toBeVisible();
});
```

- [ ] **Step 7: 全体を確認**

Run: `npm run check && npm test && npm run build && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 8: Commit**

```bash
git add src/games/invader tests/e2e/games/invader.spec.ts
git commit -m "feat(invader): port invader to astro with guide"
```

---

### Task 10: GTM（同意モード v2）と AdSense

**Files:**
- Create: `src/lib/gtm.ts`, `src/lib/gtm.test.ts`, `src/components/Gtm.astro`, `src/lib/ads.ts`, `src/lib/ads.test.ts`, `src/components/AdSlot.astro`
- Modify: `src/layouts/BaseLayout.astro`, `src/pages/games/[slug].astro`

**Interfaces:**
- Consumes: `env`（Task 1）、`GameLayout` の slot `after-guide` / `footer-ad`（Task 5）。
- Produces: `isGtmId(id)`, `bootGtm(win, doc, id, now?)`, `CONSENT_REGIONS`, `pushAdSlots(slots, win)`、`<Gtm id>`、`<AdSlot adSlot>`。

- [ ] **Step 1: テストをコピーして失敗を確認**

REF の `src/lib/gtm.test.ts` と `src/lib/ads.test.ts` をそのままコピーする。`ads.test.ts` の属性名 `data-cwt-pushed` は `data-cwg-pushed` に置き換える（2 か所）。

Run: `npx vitest run src/lib/gtm.test.ts src/lib/ads.test.ts`
Expected: FAIL（モジュールが見つからない）

- [ ] **Step 2: 実装をコピー**

- `src/lib/gtm.ts`: REF からそのままコピー。
- `src/components/Gtm.astro`: REF からそのままコピー。
- `src/lib/ads.ts`: REF からコピーし、`data-cwt-pushed` を `data-cwg-pushed` にする。
- `src/components/AdSlot.astro`: REF からコピーし、`data-cwt-slot` → `data-cwg-slot`、`data-cwt-pushed` → `data-cwg-pushed` にする。

Run: `npx vitest run src/lib/gtm.test.ts src/lib/ads.test.ts`
Expected: PASS

- [ ] **Step 3: レイアウトに組み込む**

`src/layouts/BaseLayout.astro` に REF と同じく次を戻す:
- `import Gtm from '../components/Gtm.astro';`
- `<head>` 末尾の AdSense の `<script is:inline async src=... crossorigin="anonymous">`（`env.adsenseClient` があるときだけ）。
- `<body>` 直後の `{env.gtmId && <Gtm id={env.gtmId} />}`。

`src/pages/games/[slug].astro` の `<GameLayout>` の中に追加:

```astro
  <AdSlot slot="after-guide" adSlot={env.slotGame} />
  <AdSlot slot="footer-ad" adSlot={env.slotFooter} />
```

（frontmatter に `import AdSlot from '../../components/AdSlot.astro';` と `import { env } from '../../lib/site';` を足す。）

- [ ] **Step 4: タグ入りビルドを手元で確認**

```bash
PUBLIC_GTM_ID=GTM-TEST123 PUBLIC_ADSENSE_CLIENT=ca-pub-0000000000000000 PUBLIC_ADSENSE_SLOT_GAME=111 PUBLIC_ADSENSE_SLOT_FOOTER=222 npm run build
grep -c 'data-gtm-id="GTM-TEST123"' dist/games/tetris/index.html
grep -c 'data-cwg-slot' dist/games/tetris/index.html
grep -c 'data-cwg-slot' dist/index.html
cat dist/ads.txt
grep 'connect-src' dist/_headers
PUBLIC_GTM_ID='bad' npm run build; echo "exit=$?"
```

Expected: 1 / 2 / 0 / `google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0` / `connect-src 'self' https:` / 最後は `PUBLIC_GTM_ID の形式が正しくありません` でビルド失敗（`exit=1`）。

さらに、ゲームページの DOM 順で広告が解説の後にあることを確認:

```bash
node -e "const h=require('fs').readFileSync('dist/games/tetris/index.html','utf8');const t=h.indexOf('data-touchbar'),g=h.indexOf('class=\"guide\"'),a=h.indexOf('data-cwg-slot');console.log(t<g&&g<a?'OK':'NG',t,g,a)"
```

Expected: `OK ...`

- [ ] **Step 5: 環境変数なしで元に戻して全体を確認**

Run: `npm run check && npm test && npm run build && npm run test:e2e`
Expected: すべて PASS（`環境変数なしのビルドでは広告枠と GTM を出力しない` を含む）

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add gtm with consent mode v2 and adsense slots after the guide"
```

---

### Task 11: CI / デプロイ・README・手動確認手順

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `README.md`, `tests/smoke.md`

**Interfaces:**
- Consumes: npm scripts（Task 1）、環境変数名（Global Constraints）。
- Produces: 必須チェック名 `verify`、Cloudflare Pages プロジェクト名 `creator-world-games`、本番ブランチ `main`。

- [ ] **Step 1: ワークフローを作る**

`.github/workflows/ci.yml`: REF からコピーし、次を変える。
- `--project-name=creator-world-tools` → `--project-name=creator-world-games`。
- `preview` ジョブを、トークン未登録ならデプロイをスキップする形にする:

```yaml
  preview:
    needs: verify
    # フォークからの PR では Secrets を使えないためプレビューは作らない
    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run build
      # Cloudflare の設定前（Secrets 未登録）はプレビューを作らない
      - if: env.CLOUDFLARE_API_TOKEN == ''
        run: echo "CLOUDFLARE_API_TOKEN が未登録のためプレビューをスキップします"
      # ブランチ名は式展開せず環境変数で渡す（シェルへのインジェクション対策）
      - if: env.CLOUDFLARE_API_TOKEN != ''
        run: npx wrangler pages deploy dist --project-name=creator-world-games --branch="$HEAD_REF"
        env:
          HEAD_REF: ${{ github.head_ref }}
```

`.github/workflows/deploy.yml`: REF からコピーし、次を変える。
- `branches: [master]` → `branches: [main]`。
- build の `env` を次にする:

```yaml
        env:
          PUBLIC_ADSENSE_CLIENT: ${{ vars.PUBLIC_ADSENSE_CLIENT }}
          PUBLIC_ADSENSE_SLOT_GAME: ${{ vars.PUBLIC_ADSENSE_SLOT_GAME }}
          PUBLIC_ADSENSE_SLOT_FOOTER: ${{ vars.PUBLIC_ADSENSE_SLOT_FOOTER }}
          PUBLIC_CF_ANALYTICS_TOKEN: ${{ vars.PUBLIC_CF_ANALYTICS_TOKEN }}
          PUBLIC_GTM_ID: ${{ vars.PUBLIC_GTM_ID }}
```

- デプロイ行を `npx wrangler pages deploy dist --project-name=creator-world-games --branch=main` にする。

構文確認: `npx --yes yaml-lint .github/workflows/*.yml` は使わず（依存を増やさない）、`node -e "for (const f of ['ci','deploy']) require('fs').readFileSync('.github/workflows/'+f+'.yml','utf8')"` で読めることと、`git diff` で REF との差分が上記だけであることを目視確認する（`diff ~/github/creator-world-tools/.github/workflows/deploy.yml .github/workflows/deploy.yml`）。

- [ ] **Step 2: README を書く**

`README.md` は REF の README と同じ章立て（概要・開発・ゲームの追加方法・初回セットアップ・費用・広告と GTM を有効にしたときの CSP）で、内容を次のようにする。
- 概要: 「ブラウザですぐ遊べる、登録不要のミニゲーム集（https://browser-games.creator-world.net）」。ゲームのデータは外部へ送らない。解析と広告のため GA4（GTM 経由）と AdSense を使う。移行元は `kh55/browser-games`（`e51fce8`）。
- ゲームの追加方法: `src/games/<slug>/` に `meta.ts` / `logic.ts` / `logic.test.ts` / `game.ts` / `Game.astro` / `guide.md` を置き、`tests/e2e/games/<slug>.spec.ts` を書く。`game.ts` はプレイ開始時に `api.started()`、ゲームオーバー時にだけ `api.submitScore(score)` を呼ぶ。
- 初回セットアップ: spec §6 の表の手順 1〜7 を、REF の README と同じ粒度の番号付き手順で書く。項目:
  1. Cloudflare Pages（プロジェクト名 `creator-world-games`、Direct Upload）
  2. API トークン（Account / Cloudflare Pages / Edit のみ）
  3. GitHub Secrets（`CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`）
  4. カスタムドメイン（`browser-games  CNAME  creator-world-games.pages.dev`）
  5. GTM と GA4（新規コンテナ・新規プロパティ。Google タグを「Initialization - All Pages」で。`game_start` / `game_over` はカスタムイベントトリガー＋GA4 イベントタグ、パラメータ `game_id`・`score` はデータレイヤー変数。カスタム HTML タグは使わない。Variables に `PUBLIC_GTM_ID`）
  6. Search Console（URL プレフィックス `https://browser-games.creator-world.net/`、確認方法「Google タグ マネージャー」、`sitemap-index.xml` を送信）
  7. AdSense（既存の `ca-pub-...` を `PUBLIC_ADSENSE_CLIENT` に。広告ユニットを 2 つ作り `PUBLIC_ADSENSE_SLOT_GAME`・`PUBLIC_ADSENSE_SLOT_FOOTER` に。自動広告で `browser-games.creator-world.net` を除外。`https://creator-world.net/ads.txt` に同じ行があるか確認。「プライバシーとメッセージ」は有効化前に料金が発生しないことを確認）
  8. ブランチ保護（`main`、PR 必須、`verify` 必須、管理者にも適用）
- 費用: spec §7 の表をそのまま載せる。

- [ ] **Step 3: 手動確認手順を書く**

`tests/smoke.md`（公開後に人が確認する項目。チェックボックス形式）:
- PC（Chrome / Safari）: 4 ゲームをキーボードで開始〜ゲームオーバーまで遊べる。テトリスでキー凡例が出る。パンくずのリンクに Tab で移動して Enter で開ける。
- スマホ実機（iOS Safari / Android Chrome）: 4 ゲームをタッチで遊べる。ゲーム中に画面がスクロールしない。ゲームの下の解説は指でスクロールできる。操作ボタンのすぐ下・横に広告がない。アンカー広告が出ていない。
- 「戻る」「進む」でゲームページに戻っても動く。
- プライベートブラウズでも遊べ、そのセッション内で BEST が更新される。
- GA4 リアルタイム: `page_view`、`game_start`、`game_over`（`game_id`・`score` 付き）が届く。
- GTM プレビュー（Tag Assistant）で Google タグが同意の初期値の後に発火する。
- Search Console: 所有権確認済み、サイトマップ「成功」、URL 検査で `/games/tetris/` が「URL は Google に登録できます」。
- AdSense: 広告枠が表示される（承認直後は空白のことがある）。`https://browser-games.creator-world.net/ads.txt` が正しい。

- [ ] **Step 4: 全体を確認**

Run: `npm run check && npm test && npm run build && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "ci: add verify, preview and deploy workflows and document setup"
```

---

### Task 12: GitHub への公開（ユーザー確認つき）

**Files:** なし（リモート操作のみ）

**Interfaces:**
- Consumes: Task 1〜11 のコミット、必須チェック名 `verify`。
- Produces: `https://github.com/kh55/creator-world-games`（公開）、`main` のブランチ保護、移植 PR。

この Task の各コマンドは外部に公開する操作なので、**実行前にユーザーへ内容を示して承認を得る**。

- [ ] **Step 1: 最初のコミットだけを main に残し、残りを作業ブランチに移す**

```bash
cd ~/github/creator-world-games
git branch feat/initial-site
git reset --hard "$(git rev-list --max-parents=0 HEAD)"
git log --oneline main && git log --oneline main..feat/initial-site | wc -l
```

Expected: `main` は Task 1 の 1 コミットだけ、`feat/initial-site` に Task 2〜11 の 10 コミット。

- [ ] **Step 2: リポジトリを作って main を push（要承認）**

```bash
gh repo create kh55/creator-world-games --public --source . --remote origin --description "ブラウザですぐ遊べる、登録不要のミニゲーム集（browser-games.creator-world.net）"
git push -u origin main
```

- [ ] **Step 3: ブランチ保護を設定（要承認）**

```bash
gh api -X PUT repos/kh55/creator-world-games/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["verify"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
JSON
```

Expected: 200 で JSON が返る。`gh api repos/kh55/creator-world-games/branches/main/protection --jq '.enforce_admins.enabled'` が `true`。

- [ ] **Step 4: 作業ブランチを push して PR を作る（要承認）**

```bash
git push -u origin feat/initial-site
gh pr create --base main --head feat/initial-site --title "feat: port browser-games to astro and prepare for public release" --body "$(cat <<'EOF'
## 概要
kh55/browser-games（e51fce8）の 4 ゲームを Astro + TypeScript に移植し、browser-games.creator-world.net で公開する準備をします。

- ゲームごとの個別ページと解説（/games/<slug>/）、about、privacy、404、sitemap
- GTM（同意モード v2）・AdSense は環境変数を登録したときだけ出力
- CSP は postbuild で _headers に出力。タグなしのビルドでは外部通信ゼロを E2E で検証
- CI（verify / preview）と main へのデプロイ

設計: docs/superpowers/specs/2026-09-25-creator-world-games-design.md
計画: docs/superpowers/plans/2026-09-26-creator-world-games.md

## 確認
- [x] npm run check / npm test / npm run build / npm run test:e2e
- [ ] tests/smoke.md（公開後）

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: CI を確認**

`verify` が成功することを確認する（`preview` は Secrets 未登録ならスキップのログで成功）。失敗したら原因を直して同じブランチに push する。

- [ ] **Step 6: ユーザーへ引き継ぎ**

マージは、ユーザーが README の初回セットアップ 1〜3（Cloudflare Pages・API トークン・Secrets）を終えてから行う（マージで `deploy.yml` が走るため）。ユーザーに README の手順 1〜8 を順に案内し、Variables の登録は希望があれば `gh variable set` で代行する。

---

## Self-Review メモ

- spec §1 成功条件 1 → Task 6〜9、2 → Task 4・10・11（GA4 はユーザー設定後に smoke）、3 → Task 11（README・smoke）、4 → Task 10（配置）・11（自動広告除外）、5 → Task 1・5（E2E）、6 → Task 11（README の費用）。
- spec §2 → Task 5、§3 → Task 1〜3、§4 → Task 2・4・6〜9、§5 → Task 1（CSP）・10、§6 → Task 11・12、§7 → Task 11、§8 → 各 Task、§9 → Task 5・6〜9、§10 → 触らない。
- 型・名前の一致: `CreateGame` / `GameApi.started` / `submitScore` / `mountGame(slug, create)` / `scores` / `createInput` / `createLoop` / `games` / `GameMeta` を全 Task で同じ名前で使っている。
