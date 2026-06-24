# HOMETACT ダッシュボード（ライブ版・Cloudflare）

GA4 / Search Console を**その場で取得**するダッシュボード。任意期間・全フィルタがネイティブに動く。

- フロント: `public/index.html`（静的）
- バックエンドAPI: `functions/api/report.js`（Cloudflare Pages Functions。サービスアカウントでGA4/GSCに問い合わせ）
- アクセス制御: Cloudflare Access（社外秘ガード）

## 構成
```
hometact-dashboard-app/
  functions/api/report.js   ← GA4/GSCプロキシ（SA認証）
  public/index.html         ← ダッシュボードUI（PoC：全体サマリー＋トレンド）
  README.md
```

## デプロイ手順（Cloudflare Pages）

### 1. リポジトリを用意（推奨：GitHub経由＝Functionsが確実に動く）
- このフォルダをGitHubリポジトリにpush（private推奨）。
- ※直接アップロードでも可だが、Functions込みはGit連携が安定。

### 2. Cloudflare Pages プロジェクト作成
- Cloudflare ダッシュボード → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → 上記リポジトリを選択。
- ビルド設定:
  - Framework preset: **None**
  - Build command: **（空欄）**
  - Build output directory: **`public`**
  - （Functions は `/functions` から自動検出）

### 3. 環境変数・シークレットを設定
プロジェクトの **Settings → Environment variables** で以下を追加（Production と Preview 両方）:

| 変数名 | 値 | 種別 |
|---|---|---|
| `GA_SA_KEY` | サービスアカウントJSONキーの**中身そのまま**（`{...}` 全体） | **Secret（暗号化）** |
| `GA4_PROPERTY` | `533729605` | 通常 |
| `GSC_SITE` | `https://hometact.biz/` | 通常 |

- `GA_SA_KEY` の中身は `C:\Users\yamag\AppData\Roaming\gcloud\ga4-dashboard-sa.json` の全文を貼り付け。
- **このキーはフロントには出ない**（Functions内でのみ使用）。必ず Secret 指定。

### 4. デプロイ
- 保存すると自動ビルド→公開。URLは `https://<project>.pages.dev`。

### 5. アクセス制御（社外秘・必須）
- **Zero Trust → Access → Applications → Add → Self-hosted**
- Application domain: 上記 `*.pages.dev`
- Policy: Allow / 許可するメール（クライアントの社内ドメイン等）
- → 許可した人だけがメールのワンタイムコードでログイン可能に。

## 動作確認
公開URLを開く → 期間（直近7/28/90日 or 任意の開始・終了日）を選んで「更新」→ GA4実数で全体サマリーとトレンドが描画されればOK。チャネル切替も即時。

## ローカル確認（任意）
Node＋Wrangler があれば:
```
npm i -g wrangler
wrangler pages dev public
```
（環境変数は `wrangler pages dev` の `--binding` / `.dev.vars` で設定）

## 今後の拡張（このPoCの次）
- 残ページ（集客/歩留まり/CV内訳/ニーズ把握/検索KW/深掘り）を同じAPI経由で移植。
- 現行の静的版 `hometact-dashboard/dashboard.html` の描画ロジックを流用し、データだけライブ取得に差し替える。
