# Creator World Games

ブラウザですぐ遊べる、登録不要のミニゲーム集（https://browser-games.creator-world.net）。

- ゲームのデータは外部へ送信しない（ハイスコアは localStorage にだけ保存する）
- 解析と広告のため GA4（GTM 経由）と AdSense を使う
- Astro の静的サイトを Cloudflare Pages で配信。`main` への push で自動デプロイ
- 移行元は `kh55/browser-games`（`e51fce8`）

## 開発

Node.js 22.12 以上が必要です。

```bash
npm install
npm run dev        # 開発サーバー（http://localhost:4321）
npm test           # 単体テスト（Vitest）
npm run check      # 型チェック
npm run build      # dist/ に出力（_headers と ads.txt も生成）
npm run test:e2e   # E2E（wrangler pages dev 上で CSP 込みで検証）
```

E2E は広告・解析の環境変数を設定せずにビルドした `dist/` を対象にします（`.env` に `PUBLIC_*` を書いている場合は外してからビルドしてください）。

## ゲームの追加方法

1. `src/games/<slug>/` を作る。次の 6 ファイルを置く:
   - `meta.ts` — ゲームのメタ情報（slug・タイトル・説明など）
   - `logic.ts` — 処理本体
   - `logic.test.ts` — `logic.ts` のテスト
   - `game.ts` — 入力・描画・ループ本体
   - `Game.astro` — ページ
   - `guide.md` — 遊び方・操作方法（ページ下部に表示）
2. `tests/e2e/games/<slug>.spec.ts` に操作の E2E を書く。
3. `game.ts` はプレイ開始時に `api.started()` を呼び、ゲームオーバーになったときにだけ `api.submitScore(score)` を呼ぶ（それ以外のタイミングでは呼ばない）。

## 初回セットアップ（公開まで）

1. **Cloudflare Pages のプロジェクトを作る**: Cloudflare ダッシュボード → Workers & Pages → 作成 → Pages → 「Direct Upload」で、プロジェクト名を `creator-world-games` にする（最初のアップロードは `dist/` を手動で上げるか、そのまま閉じて GitHub Actions からのデプロイを待つ）。
2. **API トークンを発行する**: My Profile → API Tokens → Create Token → 「Custom token」で権限を `Account` / `Cloudflare Pages` / `Edit` だけにする。
3. **GitHub に Secrets を登録する**: リポジトリの Settings → Secrets and variables → Actions → Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID`（ダッシュボードの右側に表示されるアカウント ID）を登録する。
4. **カスタムドメインを設定する**: Pages プロジェクト → Custom domains → `browser-games.creator-world.net` を追加し、`creator-world.net` を管理している DNS に次のレコードを追加する。
   ```
   browser-games  CNAME  creator-world-games.pages.dev
   ```
5. **GTM と GA4**: GTM で新規コンテナ、GA4 で新規プロパティを作成する。GTM の管理画面で「Google タグ」（GA4 の測定 ID）を「Initialization - All Pages」トリガーで追加して公開する。`game_start` / `game_over` は、カスタムイベントトリガー（イベント名がそれぞれ `game_start` / `game_over`）と GA4 イベントタグの組み合わせで作り、パラメータ `game_id`・`score` はデータレイヤー変数として渡す。GTM では**「カスタム HTML」タグを使わない**。GTM のコンテナ ID（`GTM-XXXXXXX`）を GitHub の Variables に `PUBLIC_GTM_ID` として登録する。
6. **Search Console**: URL プレフィックスで `https://browser-games.creator-world.net/` を追加し、確認方法に「Google タグ マネージャー」を選んで所有権を確認する。`sitemap-index.xml` を送信する。
7. **AdSense**: 既存の `ca-pub-...` を GitHub の Variables に `PUBLIC_ADSENSE_CLIENT` として登録する。広告ユニットを 2 つ作成し、GitHub の Variables に `PUBLIC_ADSENSE_SLOT_GAME`・`PUBLIC_ADSENSE_SLOT_FOOTER` として登録する。自動広告の設定で `browser-games.creator-world.net` を除外する。`https://creator-world.net/ads.txt` に同じ行があるか確認する。「プライバシーとメッセージ」を有効化する前に、管理画面で料金が発生しないことを確認する。
8. **ブランチを保護する**: Settings → Branches → `main` にルールを追加し、「Require a pull request before merging」と「Require status checks to pass」（`verify` を指定）をオンにする。管理者にも適用する。

トークンや API キーはファイルに書かず、GitHub Secrets に登録してください。

**注意**: 上記 2〜3（API トークンの発行と GitHub Secrets への登録）が終わるまで、`main` への push で走る Deploy ワークフローは失敗します。Secrets を登録したあとで、失敗した Deploy ワークフローを Actions 画面から再実行すれば公開されます。

## 費用

| 項目 | 費用 | 根拠・注意 |
|---|---|---|
| Cloudflare Pages（Free） | 無料 | 静的アセットへのリクエストは Free / 有料プランとも無料・無制限。Free はビルド 500 回/月（本構成は GitHub Actions でビルドし Direct Upload するため Pages のビルドは使わない）、1 サイト 20,000 ファイルまで。Pages Functions は使わない（Workers の無料枠を消費するため）。[Limits](https://developers.cloudflare.com/pages/platform/limits/) / [Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/) |
| GitHub Actions | 無料 | 公開リポジトリで標準ランナーを使う場合は無料。[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) |
| GA4 / GTM / Search Console | 無料 | 標準版を使用（GA4 360 は使わない） |
| AdSense | 無料（収益側） | 同意メッセージ（プライバシーとメッセージ）は有効化前に管理画面で料金が発生しないことを確認する |
| ドメイン | 追加費用なし | 既存 `creator-world.net` のサブドメイン |

## 広告・GTM を有効にしたときの CSP

広告・解析を使わないビルドでは、CSP で自サイト以外への通信をすべて禁止しています。AdSense または GTM（`PUBLIC_GTM_ID`）を有効にすると多数の Google ドメインへの通信が必要になるため、`connect-src` などを `https:` に広げます（`scripts/postbuild.mjs`）。その場合も、入力データを送らないことはコードの静的チェックと E2E（外部タグなしビルドで外部通信ゼロ）で担保しています。
