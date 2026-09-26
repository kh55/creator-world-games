# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ブラウザで遊べるミニゲーム集（https://browser-games.creator-world.net）。Astro の静的サイトを GitHub Actions でビルドし、Cloudflare Pages（Direct Upload）に配信する。姉妹サイト `kh55/creator-world-tools`（tools.creator-world.net）と同じ構成・運用で、`lib/gtm.ts`・`lib/ads.ts`・`scripts/postbuild.mjs` などはそこからのコピー。

## コマンド

Node.js 22.12 以上。

```bash
npm run dev                                  # http://localhost:4321
npm run check                                # astro check（型チェック）
npm test                                     # Vitest（src/**/*.test.ts と scripts/**/*.test.mjs）
npx vitest run src/games/tetris/logic.test.ts   # 単体テストを 1 ファイルだけ
npm run build                                # dist/ に出力し、postbuild で _headers（CSP）と ads.txt を生成
npm run test:e2e                             # Playwright。wrangler pages dev で dist/ を配信し _headers の CSP 込みで検証
npx playwright test tests/e2e/games/tetris.spec.ts   # E2E を 1 ファイルだけ（先に npm run build）
```

- E2E は **広告・解析の環境変数なしでビルドした dist/** が前提（外部通信ゼロ・広告枠なしを検証している）。`PUBLIC_*` を付けてビルドした後は、付けずにビルドし直してから E2E を流す。
- CI（`.github/workflows/ci.yml` の `verify`）は check → test → build → e2e の順に実行する。

## 運用ルール

- `main` はブランチ保護（PR 必須・`verify` 必須・管理者にも適用）。直接 push せず、ブランチ → PR → CI 通過 → マージ。マージで `deploy.yml` が本番にデプロイする。
- 広告・解析の ID は GitHub の Variables（`PUBLIC_GTM_ID`・`PUBLIC_ADSENSE_CLIENT`・`PUBLIC_ADSENSE_SLOT_GAME`・`PUBLIC_ADSENSE_SLOT_FOOTER`・任意で `PUBLIC_CF_ANALYTICS_TOKEN`）、Cloudflare の認証情報は Secrets。未設定ならタグを一切出力しない（`src/lib/site.ts` の `env`）。
- Pages Functions（サーバー側処理）は使わない。
- 設計の経緯は `docs/superpowers/specs/2026-09-25-creator-world-games-design.md` と `docs/superpowers/plans/2026-09-26-creator-world-games.md`。

## アーキテクチャ

### ゲームの登録（フォルダを置くだけ）

`src/lib/registry.ts` が `import.meta.glob` で `src/games/*/{meta.ts,Game.astro,guide.md}` を集め、`registry-core.ts` の `buildRegistry()` が検証する（slug とフォルダ名の一致、3 ファイルの有無、slug の重複、description 120 字以内。違反はビルドエラー）。トップのカード・`/games/<slug>/`・サイトマップはここから自動生成される。

各ゲームフォルダの役割:
- `meta.ts` — `GameMeta`（slug・title・description・icon・order）
- `logic.ts` — DOM を使わない純粋なロジック。`logic.test.ts` の対象
- `game.ts` — `export const create: CreateGame`。canvas 描画・入力・状態遷移
- `Game.astro` — `mountGame(meta.slug, create)` を呼ぶだけのクライアントスクリプト
- `guide.md` — ページ下部の解説（日本語）

### ゲームの実行（`src/engine/`）

- `runner.ts` の `mountGame()` が GameLayout の DOM（`[data-stage]` / `[data-touchbar]` / `[data-score]` / `[data-best]`）を探して `runGame()` を呼び、`create(host, api)` にゲームを渡す。`pagehide` で片付け、bfcache から戻ったとき（`pageshow` の `persisted`）は再読み込みする。
- `GameApi` の約束: プレイ開始時に `api.started()`（dataLayer に `game_start`）、**ゲームオーバー時にだけ** `api.submitScore(score)`（dataLayer に `game_over` を積み、ハイスコアを保存）。GA4 のイベントはこの 2 つだけで、GTM 側のタグがこれを拾う。
- `input.ts` はキー・ポインタ・touchbar ボタンを「アクション」（left/right/up/down/fire/start）に変換する。`isDown()` は押している間 true なので、押した瞬間だけ反応させたい操作（テトリスの回転・ハードドロップ、ブロック崩しの Space 発射）はゲーム側でフレームごとに前回値と比べて検出する（E2E でもキーを 1 フレーム以上押し続ける必要がある）。Enter とポインタ押下は `onStart` コールバックで即時通知される。
- キー入力は、リンクやフォーム部品・ゲーム外のボタンにフォーカスがあるとき、およびゲーム領域が画面外にあるとき（IntersectionObserver）は無視し、ページの既定動作（リンクを開く・スクロール）を妨げない。
- `loop.ts` は requestAnimationFrame のラッパーで、`dt` は 0.05 秒で頭打ち、タブが非表示の間は止まる（非表示のブラウザではゲームが進まない）。
- `storage.ts` はハイスコアを localStorage の `bg:highscore:<slug>` に保存し、使えないときはメモリで代替する。

Node の単体テストでは DOM がないため、engine は `document` / `window` を遅延参照し、テストは `EventTarget` ベースの偽物を渡している。この性質を崩さないこと。

### ページと広告の配置

- `layouts/BaseLayout.astro` が全ページ共通（canonical・OGP・GTM・AdSense の読み込み）。`layouts/GameLayout.astro` がゲームページの並び（パンくず → 見出し → ゲーム → 解説 → 広告 1 → ほかのゲーム → 広告 2）。
- 広告（`components/AdSlot.astro`）はゲームページにだけ、解説より後に置く。操作ボタンの近くに置くと誤クリックでポリシー違反になるため、ゲーム領域の上・中・直下には置かない。自動広告は AdSense 側でこのサブドメインを除外している。
- `touch-action: none` は `.stage`・canvas・touchbar のボタンだけに付ける（スマホで解説をスクロールできるように）。

### CSP と通信の制約

- `scripts/postbuild.mjs` が環境変数に応じて `dist/_headers` の CSP を作る。タグなしでは自サイト以外への通信を全部禁止し、GTM か AdSense があると `https:` に広げる。
- CSP で inline script を禁止しているので、スクリプトは Astro の `<script>`（バンドルされる）で書く。`is:inline` は外部 `src` 付きのタグ（AdSense・Cloudflare Web Analytics）だけ。GTM の起動も inline スニペットではなく `lib/gtm.ts` の `bootGtm()` で行い、同意モード v2 の初期値（EEA・英国・スイスは拒否）を先に送る。
- `src/` に `fetch` / `XMLHttpRequest` / `sendBeacon` / `WebSocket` / `EventSource` を書くと `src/lib/no-network.test.ts` が失敗する。
- `innerHTML` は使わない（`createElement` / `textContent` / `replaceChildren()`）。
