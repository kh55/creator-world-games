# creator-world-games 設計書（browser-games の公開・Astro 移行）

- 日付: 2026-09-25
- 対象: 新規リポジトリ `kh55/creator-world-games`（公開）
- 公開 URL: https://browser-games.creator-world.net
- 参考: `kh55/creator-world-tools`（https://tools.creator-world.net）
- 移行元: `kh55/browser-games`（`main` = `a794092`、ゲーム本体は `e51fce8` 時点）

## 1. 目的と成功条件

### 目的

ローカルで動くゲーム集 browser-games を、tools.creator-world.net と同じ作り（Astro 静的サイト + Cloudflare Pages + GitHub Actions）で公開し、GA4（GTM 経由）・Search Console・AdSense を設定する。

### 決定事項（ユーザー確認済み）

| 項目 | 決定 |
|---|---|
| ドメイン | `browser-games.creator-world.net`（既存 `creator-world.net` のサブドメイン） |
| ページ構成 | ゲームごとの個別ページ `/games/<slug>/` + 解説文 |
| 実装方式 | Astro に移行し、ゲームを TypeScript モジュールに書き直す（参考サイトの構成にそろえる） |
| リポジトリ | 新規 `kh55/creator-world-games`・公開。既存 `browser-games` は変更せず残す |
| AdSense | 既存アカウント（creator-world.net 承認済み）の `ca-pub-...` を使う。新規申請なし |
| GTM / GA4 | どちらも新規作成（tools とは分ける） |
| Search Console | `https://browser-games.creator-world.net/` を URL プレフィックスで新規登録（creator-world.net は URL プレフィックス登録のため自動では含まれない） |

### 成功条件

1. `https://browser-games.creator-world.net/` で 4 ゲーム（invader / breakout / whack / tetris）が現行と同じ挙動で遊べる（PC キーボード・スマホタッチ）。
2. GA4 のリアルタイムレポートにページビューと `game_start` / `game_over` イベントが届く。
3. Search Console で所有権が確認され、サイトマップが「成功」になる。
4. AdSense の広告枠が本番で表示され、ゲーム本体と操作ボタンの近くには広告が出ない。
5. 広告・解析の環境変数なしでビルドした場合、外部への通信がゼロで、CSP 違反もない（E2E で検証）。
6. 追加の費用が発生しない（§7）。

## 2. ページ構成

`astro.config.mjs`: `site: 'https://browser-games.creator-world.net'`、`output: 'static'`、`trailingSlash: 'always'`、`build.format: 'directory'`、`inlineStylesheets: 'never'`、`vite.build.assetsInlineLimit: 0`、`@astrojs/sitemap`。

| URL | 内容 |
|---|---|
| `/` | トップ。ゲームカード一覧（絵文字・タイトル・説明・BEST）とサイト紹介文 |
| `/games/<slug>/` | パンくず → 見出し・説明 → ゲーム本体（SCORE/BEST + stage + touchbar）→ 解説 → 広告 1 → 他のゲームへのリンク → 広告 2 |
| `/about/` | このサイトについて（運営者。問い合わせ先は載せない — 2026-09-26 ユーザー決定） |
| `/privacy/` | プライバシーポリシー（GA4・GTM・AdSense・Cookie・同意モード・localStorage のハイスコア保存） |
| `/404` | 404 ページ |
| `/sitemap-index.xml` | `@astrojs/sitemap` が生成 |
| `/robots.txt` | `public/` に固定配置（Sitemap 行付き） |
| `/ads.txt`, `/_headers` | `scripts/postbuild.mjs` が生成 |

slug: `invader`, `breakout`, `whack`, `tetris`。

BEST 表示は localStorage に依存するため、カードの静的 HTML には `BEST 0` を出さず、クライアントのスクリプトで埋める（JS 無効時は非表示）。

## 3. リポジトリ構成

```
.github/workflows/  ci.yml / deploy.yml
public/             favicon.svg / robots.txt
scripts/            postbuild.mjs / postbuild.test.mjs
src/
  games/<slug>/     meta.ts / logic.ts / logic.test.ts / game.ts / Game.astro / guide.md
  engine/           storage.ts / loop.ts / input.ts / runner.ts（＋各 .test.ts）
  components/       Gtm.astro / AdSlot.astro / GameCard.astro
  layouts/          BaseLayout.astro / GameLayout.astro
  lib/              site.ts / gtm.ts / ads.ts / registry.ts / registry-core.ts / game-meta.ts / no-network.test.ts
  pages/            index.astro / games/[slug].astro / about.astro / privacy.astro / 404.astro
  styles/           global.css
tests/
  e2e/              site.spec.ts / games/<slug>.spec.ts / helpers.ts
  smoke.md
docs/superpowers/   specs / plans（本書を移す）
```

Node.js 22.12 以上（`.nvmrc`）。依存は参考サイトに合わせる: `astro`、`@astrojs/sitemap`、開発用に `@astrojs/check`、`typescript`、`vitest`、`@playwright/test`、`wrangler`、`@types/node`。ゲームに外部ライブラリは入れない。

### ゲームの登録

`game-meta.ts`:

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

`registry.ts` は `import.meta.glob` で `src/games/*/meta.ts`・`Game.astro`・`guide.md` を集め、`registry-core.ts` の `buildRegistry()` で検証する（slug とフォルダ名の一致、必須ファイルの有無、slug の重複、description の長さ）。ゲームの追加は「フォルダを置くだけ」。

## 4. ゲーム本体の移植

### 方針

- **挙動は変えない。** 操作・得点・速度・見た目を 1 対 1 で TypeScript に書き換える（`var` → `const`/`let`、IIFE・グローバル → `import`/`export`、型付け）。機能の追加や調整はしない。
- **純ロジックは `logic.ts` に出す。** 現行テストが対象にしている関数（テトリスの形状・衝突・固定・ライン消去・得点・レベル・落下間隔、もぐらの出現間隔、ブロック崩しの反射など）は `logic.ts` から export する。インベーダーは現行テストがないため、無理に切り出さない。
- **描画と入力の処理は `game.ts`**（`export const create: CreateGame`）に置き、`logic.ts` と engine を import する。`Game.astro` は `mountGame(meta.slug, create)` を呼ぶだけのクライアントスクリプト。
- **`innerHTML` にユーザー由来の値を入れない。** トップのカードや見出しは Astro で静的に出力する。ゲームの後片付けで stage を空にする処理は `replaceChildren()` を使う。

### engine（旧 `common/`）

| 現行 | 移行後 | 変更点 |
|---|---|---|
| `common/storage.js` | `engine/storage.ts` | キー `bg:highscore:<id>` と localStorage 不可時のフォールバックを維持 |
| `common/loop.js` | `engine/loop.ts` | そのまま移植 |
| `common/input.js` | `engine/input.ts` | そのまま移植 |
| `common/shell.js` | `engine/runner.ts` | ハッシュルーティングと `renderHome()` を削除。`runGame(def, els)` で 1 ページ 1 ゲームを起動する |

`runGame` がゲームに渡す `api`（`setScore` / `submitScore` / `getHighScore` / `loop` / `input` / `onQuit` / `stageSize`）の形は現行と同じにし、`started()` だけを追加する。

ページに解説やリンクが加わるため、`input` はリンク・フォーム部品・touchbar 以外のボタンにフォーカスがあるときのキー入力を無視する（Enter でリンクを開けるようにする）。「← 戻る」は `/` への通常のリンクになる。ページ離脱時（`pagehide`）に現行の `closeGame()` 相当の後片付けを行う。

ドメインが変わるため、ローカルの `index.html` で保存したハイスコアは引き継がれない（許容）。

### ゲームイベント（GA4 用）

`runner.ts` の `api` に `started()` を追加し、各ゲームはプレイ開始時に呼ぶ。`game_over` は runner の `submitScore()` が送る（全ゲームがゲームオーバー（もぐらたたきは時間切れ）時にだけ `submitScore` を呼ぶため）。runner は次を `window.dataLayer` に push する（配列がなければ作る）:

```js
{ event: 'game_start', game_id: '<slug>' }
{ event: 'game_over', game_id: '<slug>', score: <整数> }
```

個人を特定できる情報は送らない。GTM がない場合は配列に積まれるだけで通信は発生しない。

### 見た目

現行 `style.css` のアーケード調（配色・フォント・カード・topbar・touchbar）を `global.css` に引き継ぎ、ヘッダー・フッター・パンくず・解説・広告枠・関連リンクのスタイルを追加する。ゲーム領域はスマホ幅で 1 画面に収まる高さを保ち、解説はその下にスクロールで続く。

## 5. タグ・同意・CSP・広告

### 環境変数（すべて任意。未設定ならタグを出力しない）

| 変数 | 用途 |
|---|---|
| `PUBLIC_GTM_ID` | GTM コンテナ ID（`GTM-XXXXXXX`）。形式が不正ならビルドを失敗させる |
| `PUBLIC_ADSENSE_CLIENT` | `ca-pub-...`（tools と同じ ID） |
| `PUBLIC_ADSENSE_SLOT_GAME` | ゲームページの解説途中の広告ユニット（新規作成） |
| `PUBLIC_ADSENSE_SLOT_FOOTER` | ページ下部の広告ユニット（新規作成） |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Cloudflare Web Analytics（任意） |

本番値は GitHub の Variables に登録し、`deploy.yml` でビルド時に注入する。

### GTM / GA4 / 同意モード

参考サイトの `src/lib/gtm.ts`・`Gtm.astro` と同じ実装にする。

- CSP で inline script を禁止しているため、公式スニペットと同じ処理をバンドルされたスクリプト（`bootGtm()`）から実行する。`<noscript>` の iframe も出力する。
- GTM 読み込み前に同意モード v2 の初期値を送る: 全地域 `granted`、EEA・英国・スイス（`CONSENT_REGIONS`）は `denied` + `wait_for_update: 500`。
- 同意の更新は AdSense の「プライバシーとメッセージ」（Google 認定 CMP）が行う。
- GTM 側の設定: 「Google タグ」（新規 GA4 の測定 ID）を「Initialization - All Pages」で発火。`game_start` / `game_over` はカスタムイベントトリガー + GA4 イベントタグ（パラメータ `game_id`・`score` をデータレイヤー変数から渡す）。**カスタム HTML タグは使わない。**

### AdSense

- `PUBLIC_ADSENSE_CLIENT` があるとき `<head>` に `adsbygoogle.js?client=...` を出力する。
- 広告枠は `AdSlot.astro` と `lib/ads.ts` の `pushAdSlots()`（参考サイトと同じ。自分の枠だけ push し、1 枠のエラーで他を止めない）。
- **配置（誤クリック対策）:** ゲーム本体（stage・touchbar）の上・内部・直下には置かない。広告 1 は解説の後、広告 2 は他のゲームへのリンクの後（ページ下部）。操作ボタンとの間に必ず解説全体が挟まる。トップ・about・privacy・404 には置かない。
- **自動広告:** アンカー広告などがスマホの操作ボタンに重なるのを防ぐため、AdSense の設定で `browser-games.creator-world.net` を自動広告の対象外にする（§6 手順 7）。
- サブドメインの審査: AdSense は 2023-03-20 以降サブドメインを個別に登録・審査せず、親ドメインの承認状態を使う（[AdSense ヘルプ](https://support.google.com/adsense/answer/12170421)）。そのため新規申請は不要。
- `ads.txt`: postbuild でサブドメインにも生成する（`google.com, pub-..., DIRECT, f08c47fec0942fa0`）。ads.txt はルートドメインのものが基本的に参照されるため、`https://creator-world.net/ads.txt` に同じ行があることも確認する（§6 手順 7）。

### CSP（`scripts/postbuild.mjs` → `dist/_headers`）

参考サイトの `buildCsp()` / `buildHeaders()` / `buildAdsTxt()` と同じ。

- 広告・解析なし: `default-src 'self'`、`script-src 'self'`、`connect-src 'self'`、`frame-src 'none'`、`img-src 'self' data: blob:` ほか。
- `PUBLIC_CF_ANALYTICS_TOKEN` あり: Cloudflare Insights の 2 ドメインだけ追加。
- `PUBLIC_GTM_ID` または `PUBLIC_ADSENSE_CLIENT` あり: `script-src` に `'unsafe-inline' https:`、`connect-src`・`img-src`・`frame-src` に `https:` を追加（Google の配信ドメインが多数で列挙できないため）。
- 共通: `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy: camera=(), microphone=(), geolocation=()`、`frame-ancestors 'none'`。

ゲームが外部へ通信しないことは、`no-network.test.ts`（`src/` 内の `fetch` / `XMLHttpRequest` / `WebSocket` / `sendBeacon` / `EventSource` の使用を検出。`lib/gtm.ts` の GTM 読み込みだけ許可）と E2E（外部タグなしのビルドで外部リクエストがゼロ）で担保する。

## 6. デプロイと初回セットアップ

### CI / CD（参考サイトと同じ構成）

- `ci.yml`（`pull_request` と `workflow_call`）: ジョブ `verify` = `npm ci` → `npm run check` → `npm test` → `npm run build`（環境変数なし）→ Playwright の chromium をインストール → `npm run test:e2e`。失敗時は `test-results/` をアップロード。ジョブ `preview`: 同じリポジトリからの PR のみ（`CLOUDFLARE_API_TOKEN` が未登録ならデプロイのステップをスキップ）、`wrangler pages deploy dist --project-name=creator-world-games --branch="$HEAD_REF"`（ブランチ名は環境変数で渡す）。
- `deploy.yml`（`main` への push）: `verify` を再利用 → Variables を注入してビルド → `wrangler pages deploy dist --project-name=creator-world-games --branch=main`。`concurrency: deploy-production`。
- 権限は `contents: read` のみ。
- 既定ブランチは `main`。ブランチ保護: PR 必須・`verify` 必須・管理者にも適用。

### 初回セットアップの順番と担当

各手順の後に本番で動作を確認してから次へ進む。手順は README の「初回セットアップ」に同じ順で記載する。

| # | 作業 | 担当 |
|---|---|---|
| 1 | `kh55/creator-world-games` を公開で作成し、移植の PR を作成・CI 通過後にマージ。ブランチ保護を設定 | Claude（`gh`。リポジトリ作成・push・保護設定はそれぞれ実行前にユーザーへ確認） |
| 2 | Cloudflare Pages に `creator-world-games`（Direct Upload）を作成。API トークン（Account / Cloudflare Pages / Edit のみ）を発行し、GitHub Secrets に `CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID` を登録。`creator-world-games.pages.dev` で動作確認 | ユーザー（トークンは Claude が扱わない） |
| 3 | Pages の Custom domains に `browser-games.creator-world.net` を追加し、DNS に `browser-games CNAME creator-world-games.pages.dev` を追加 | ユーザー |
| 4 | GTM コンテナと GA4 プロパティを新規作成。GTM に Google タグ・ゲームイベントのタグを設定して公開。Variables に `PUBLIC_GTM_ID` を登録して再デプロイ。GA4 のリアルタイムで確認 | ユーザー（Variables の登録は Claude が `gh variable set` で代行可） |
| 5 | Search Console に `https://browser-games.creator-world.net/` を URL プレフィックスで追加し、「Google タグ マネージャー」で所有権を確認。`sitemap-index.xml` を送信 | ユーザー |
| 6 | AdSense で広告ユニット（ディスプレイ・レスポンシブ）を 2 つ作成し、Variables に `PUBLIC_ADSENSE_CLIENT`・`PUBLIC_ADSENSE_SLOT_GAME`・`PUBLIC_ADSENSE_SLOT_FOOTER` を登録して再デプロイ | ユーザー（Variables は代行可） |
| 7 | AdSense の自動広告でこのサブドメインを除外。`https://creator-world.net/ads.txt` の内容を確認。「プライバシーとメッセージ」の EEA・英国・スイス向けメッセージが有効か確認 | ユーザー |

## 7. 費用（公式ドキュメントで確認済み・2026-09-25）

| 項目 | 費用 | 根拠・注意 |
|---|---|---|
| Cloudflare Pages（Free） | 無料 | 静的アセットへのリクエストは Free / 有料プランとも無料・無制限。Free はビルド 500 回/月（本構成は GitHub Actions でビルドし Direct Upload するため Pages のビルドは使わない）、1 サイト 20,000 ファイルまで。Pages Functions は使わない（Workers の無料枠を消費するため）。[Limits](https://developers.cloudflare.com/pages/platform/limits/) / [Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) |
| GitHub Actions | 無料 | 公開リポジトリで標準ランナーを使う場合は無料。[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |
| GA4 / GTM / Search Console | 無料 | 標準版を使用（GA4 360 は使わない） |
| AdSense | 無料（収益側） | 同意メッセージ（プライバシーとメッセージ）は有効化前に管理画面で料金が発生しないことを確認する |
| ドメイン | 追加費用なし | 既存 `creator-world.net` のサブドメイン |

## 8. テスト

| 種類 | 内容 |
|---|---|
| 単体（Vitest） | 現行 4 本（storage / whack / breakout / tetris）を移植。追加: `runner`（api の形・dataLayer への push・後片付け）、`gtm`、`ads`、`registry-core`、`postbuild`（CSP・ads.txt）、`no-network` |
| 型チェック | `astro check` |
| E2E（Playwright、`wrangler pages dev dist` 上で `_headers` の CSP 込み） | トップに 4 カード／各ゲームページで canvas（whack は穴の要素）が描画され、Enter とタップで開始できる／CSP 違反ゼロ／外部リクエストゼロ／環境変数なしで広告枠と GTM が出ない／about・privacy・404 が表示される／sitemap に全ページが含まれる／各ページに一意の title・description・canonical がある |
| 手動 | `tests/smoke.md` を更新（実機スマホのタッチ操作、広告と操作ボタンの距離、GA4 リアルタイム、Search Console） |

## 9. コンテンツ

- `guide.md`（ゲームごと、800〜1,500 字）: 遊び方／操作方法（キーボード・タッチ）／得点のしくみ／攻略のコツ／よくある質問。現行コードの仕様（得点表・速度・残機など）に合わせて Claude が下書きし、ユーザーが確認する。
- about・privacy: 参考サイトの文面を土台にし、ゲーム用に書き換える。privacy にはハイスコアを localStorage に保存すること、GA4 にゲームのイベント（ゲーム ID・スコア）を送ることを明記する。
- 現行 README の「通信・Cookie・トラッキングなし」は、新リポジトリの README では「ゲームのデータは外部に送らない。解析と広告のため GA4・AdSense を使う」に改める。

## 10. スコープ外

- ゲームの追加・調整、多言語対応、OGP 画像の作成
- 既存 `kh55/browser-games` リポジトリの変更（本書の追加を除く）
- Pages Functions などサーバー側の処理
