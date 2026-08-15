# sonotracks-discography-static

[sonoTracks](https://sono-tracks.com/) の作品一覧を、**静的サイト**（GitHub Pages / Cloudflare Pages / Netlify / Vercel / S3 など、なんでも）に埋め込むための最小パッケージ。

[WordPress プラグイン版](https://github.com/miryna1978/sonotracks-discography)と同じ見た目 (CSS クラス名・カスタムプロパティ完全互換) を、ビルド不要・依存ゼロで実現する。

- **同期は「サーバー側」で** — 公開 API を叩くのはブラウザではなく、あなたの CI かローカルの cron。訪問者からは常に自サイト内 `releases.json` を読むだけ（CORS 制約なし・sonoTracks への負荷ゼロ）
- **障害に強い** — sonoTracks が一時的に落ちていても、最後に取得できた `releases.json` がそのまま表示される（WP プラグインと同じ挙動）
- **どこでも動く** — 同期ロジックは Python 標準ライブラリだけの1ファイル。GitHub Actions・GitLab CI・Netlify Build・Vercel Cron・素の cron・手動、どれからでも
- **見た目はテーマ任せ** — CSS はレイアウトと余白だけを持ち、色や字は指定しない。すべての調整は CSS カスタムプロパティ経由

## 動作イメージ

```
+-------------------+   fetch (server-side)   +--------------------+
| sonoTracks API    | <---------------------- | scheduler (Actions,|
| (public)          |                         | cron, Netlify ...) |
+-------------------+                         +----------+---------+
                                                         | write
                                                         v
+-------------------+  <fetch releases.json>  +----------+---------+
| visitor's browser | <---------------------- | your static site   |
| (renders grid)    |                         | (releases.json)    |
+-------------------+                         +--------------------+
```

## 3分で導入

1. **サイトに 3ファイル置く**（プロジェクトのルートで OK）:
   - `sonotracks-catalog.js`
   - `sonotracks-catalog.css`
   - 空の `releases.json`（初回は同期実行後に自動で書かれるので、空でも仮のダミーでも可）
2. **HTML に3行追加**:
   ```html
   <link rel="stylesheet" href="/sonotracks-catalog.css">
   <div class="sonotracks-dg" data-src="/releases.json"></div>
   <script src="/sonotracks-catalog.js" defer></script>
   ```
3. **同期を仕込む**（下記「同期のセットアップ」から選ぶ）

以上で、次回の同期後（または初回手動実行後）にジャケット一覧がサイトに並ぶ。同期の既定間隔は 6時間（[APIの利用頻度について](#apiの利用頻度について) 参照）。

## 同期のセットアップ

同期ロジックは `scripts/sync-sonotracks.py`（Python 3.6+・標準ライブラリのみ）。
これを何らかのスケジューラーから呼び、`releases.json` を更新する。

### A. GitHub Actions（6時間ごと自動）

同梱の `.github/workflows/sync-sonotracks.yml` をリポジトリに置く。
`env.SLUG` を自分のスラッグに書き換えるだけ:

```yaml
env:
  SLUG: your-slug-here   # ← https://sono-tracks.com/u/<slug> の <slug>
```

commit + push すれば Actions が有効になる。手動即時反映は Actions タブ → "Run workflow"。

### B. GitLab CI（6時間ごと自動）

`.gitlab-ci.yml` に:

```yaml
sync-sonotracks:
  image: python:3-alpine
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
  script:
    - python3 scripts/sync-sonotracks.py --slug "$SONOTRACKS_SLUG"
    - |
      if [ -n "$(git status --porcelain releases.json)" ]; then
        git config user.email "ci@example.com"
        git config user.name "sonotracks-sync"
        git add releases.json
        git commit -m "sync sonotracks releases"
        git push "https://oauth2:${GITLAB_PUSH_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_PATH}.git" HEAD:${CI_COMMIT_REF_NAME}
      fi
```

`SONOTRACKS_SLUG` と `GITLAB_PUSH_TOKEN`（push 権限のあるトークン）を CI/CD 変数に入れて、
Schedules で 6時間ごと（例: `0 */6 * * *`）に走らせる。

### C. Netlify Scheduled Functions

`netlify/functions/sync.mts`（もしくは類似）に Python の代わりに Node で同等処理を書くか、
Python 版を Netlify Plugin から呼ぶ（README では割愛。curl と jq でも可、下記 F 参照）。
生成した `releases.json` は Netlify のビルド出力に含めて再デプロイ。

### D. Vercel Cron Jobs

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/sync-sonotracks", "schedule": "0 */6 * * *" }
  ]
}
```

`api/sync-sonotracks.ts` から Python を呼ぶより、Node で API を叩いて
KV / Blob に releases.json を書く方が Vercel 流。実装は割愛。

### E. 素の cron（自前サーバー / ローカル）

```cron
0 */6 * * * cd /path/to/site && /usr/bin/python3 scripts/sync-sonotracks.py --slug your-slug && git add releases.json && git diff --cached --quiet || (git commit -m "sync sonotracks releases" && git push)
```

git push 先が静的ホスティングと連携していれば、更新後自動デプロイ。

### F. 手動（cron を持たない環境）

```
python3 scripts/sync-sonotracks.py --slug your-slug
git add releases.json && git commit -m "sync sonotracks releases" && git push
```

「変更があったときだけ push したい」ときは、スクリプトの終了コードで判定:

- `0`: 内容更新あり → commit・push する
- `100`: syncedAt 以外に差分なし → 何もしなくてよい
- `1`: fetch 失敗（既存 releases.json はそのまま） → 何もしない

## APIの利用頻度について

sonoTracks 運営の想定は **1日数回程度**。同梱ワークフローと本 README のサンプルは、
既定で **6時間ごと**（`0 */6 * * *`）にしてあり、これに沿った設定です。

新曲リリース直後など「今すぐ反映したい」ときは、Actions タブから "Run workflow"
（`workflow_dispatch`）で即時同期できるので、既定の cron 間隔を短くする必要はありません。

これより短い間隔で回したい場合は、**節度をもって**（最短でも1時間程度、
`0 * * * *` を推奨）。API は公開のインフラを共有しています。

## 使い方（描画側）

### 宣言的（data-\* 属性）

```html
<div class="sonotracks-dg"
     data-src="/releases.json"
     data-columns="4"
     data-limit="24"
     data-paged="false"></div>
```

ページ内の `.sonotracks-dg` は自動で初期化される（`DOMContentLoaded` 時）。

### 命令的（JS）

```html
<div id="my-catalog"></div>
<script src="/sonotracks-catalog.js" defer></script>
<script>
  window.addEventListener('DOMContentLoaded', function () {
    sonotracksCatalog({
      container: '#my-catalog',
      src: '/releases.json',
      columns: 4,
      limit: 24,
      paged: true,
    });
  });
</script>
```

### ページ送り

```html
<div class="sonotracks-dg" data-src="/releases.json" data-paged="true" data-limit="12"></div>
```

`data-paged="true"` を付けると、`data-limit` 件ずつページ分割される。
1ページに複数の一覧を置くと、各インスタンスが独立して動く（WP 版と挙動が違う点）。

### オプション一覧

| 属性 / JS キー | 既定値 | 意味 |
|---|---|---|
| `data-src` / `src` | `"releases.json"` | 読み込む JSON のパス |
| `data-columns` / `columns` | `4` | 列数（`--sonotracks-dg-columns` にも渡る） |
| `data-limit` / `limit` | `24` | 1ページの最大件数（上限 24） |
| `data-paged` / `paged` | `false` | `true` でページ送りを表示 |
| `data-more-label` / `moreLabel` | `sonoTracks ですべて見る →` | ページ送りなし・件数超過時の「もっと見る」文言 |

## 見た目のカスタマイズ

CSS カスタムプロパティで受ける。**規定値を宣言するブロックは同梱 CSS には無い**
（テーマ側の宣言が確実に勝つように）。

```css
.sonotracks-dg {
  --sonotracks-dg-gap: 24px;
  --sonotracks-dg-radius: 10px;
  --sonotracks-dg-title-color: #111;
  --sonotracks-dg-artist-color: #777;
  --sonotracks-dg-artist-opacity: 1;
}
```

一覧ごとに変えたいときは、その一覧を囲む要素（または `.sonotracks-dg` 自体）に書けば、その中だけに効く。

### 変数一覧（WP プラグインと同一）

| 名前 | 既定値 | 何に効くか |
|---|---|---|
| `--sonotracks-dg-columns` | `4` | 列数 |
| `--sonotracks-dg-min` | `140px` | 1枠の最小幅。これを下回ると折り返す |
| `--sonotracks-dg-gap` | `16px` | 作品どうしの間隔 |
| `--sonotracks-dg-radius` | `4px` | ジャケットの角丸 |
| `--sonotracks-dg-ratio` | `1 / 1` | ジャケットの縦横比 |
| `--sonotracks-dg-link-color` | `inherit` | 作品カード全体の文字色 |
| `--sonotracks-dg-title-color` | `inherit` | 作品名の色 |
| `--sonotracks-dg-title-weight` | `bold` | 作品名の太さ |
| `--sonotracks-dg-title-size` | `1em` | 作品名の大きさ |
| `--sonotracks-dg-artist-color` | `inherit` | アーティスト名の色 |
| `--sonotracks-dg-artist-opacity` | `0.8` | アーティスト名の薄さ |
| `--sonotracks-dg-price-color` | `inherit` | 価格の色 |
| `--sonotracks-dg-meta-size` | `0.9em` | アーティスト名と価格の大きさ |
| `--sonotracks-dg-pager-color` | `inherit` | ページ送りの文字色 |
| `--sonotracks-dg-pager-current` | `currentColor` | 現在ページの下線の色 |

これで足りない場合は、次のクラスに直接 CSS を当ててください。

| クラス | 対象 |
|---|---|
| `.sonotracks-dg` | 全体 |
| `.sonotracks-dg__list` | 一覧（グリッド） |
| `.sonotracks-dg__link` | 1作品のリンク |
| `.sonotracks-dg__artwork` | ジャケット画像 |
| `.sonotracks-dg__title` | 作品名 |
| `.sonotracks-dg__artist` | アーティスト名 |
| `.sonotracks-dg__price` | 価格 |
| `.sonotracks-dg__pager` | ページ送り |
| `.sonotracks-dg__pagernow` | 現在ページ |
| `.sonotracks-dg__more` | 「すべて見る」 |

## 仕組み

- 静的ホスティングは `releases.json` を配信するだけ
- ブラウザは自サイト内の `releases.json` を fetch し、`sonotracks-catalog.js` が
  `.sonotracks-dg` の各要素を描画する
- スケジューラー（Actions / cron / etc.）が定期的に `sonotracks-catalog` の
  API を叩き、変化があれば `releases.json` を更新して commit / redeploy
- 訪問者からはブラウザが直接 sonoTracks を叩かないので、CORS の制約を受けず、
  sonoTracks 側にも負荷をかけない
- 取得する項目: 作品名・アーティスト名・ジャンル・曲数・最低価格・ジャケット・
  作品ページ URL（購入者情報や試聴音源は取得しない）

## API について

`GET https://sono-tracks.com/api/tracks/public/artist-releases?slug={slug}&limit={n}&page={p}`

レスポンス:

```json
{
  "releases": [
    {
      "id": "...",
      "title": "...",
      "artist": "...",
      "genres": ["..."],
      "trackCount": 1,
      "priceMin": 100,
      "artworkUrl": "https://sono-tracks.com/_next/image?...",
      "url": "https://sono-tracks.com/r/..."
    }
  ],
  "total": 42,
  "totalPages": 2,
  "page": 1,
  "perPage": 24,
  "artistUrl": "https://sono-tracks.com/u/..."
}
```

叩き先を変えたい場合は `--api-origin` 引数 or `SONOTRACKS_API_ORIGIN` 環境変数で。

## トラブルシュート

- **一覧が出ない**: ブラウザの devtools コンソールを見る。`releases.json` の 404 ？ パス指定を確認
- **画像が出ない**: `artworkUrl` は Vercel Image Optimizer 経由の URL。CORS ではなく hotlink 制約の可能性は低いが、CSP で `img-src` を狭めている場合は `sono-tracks.com` を許可
- **同期が走らない**: GitHub Actions は数分〜数十分の遅延を伴うことがある。6時間 cron でも実行タイミングは前後する（次回同期を早めたければ Actions タブから "Run workflow" で即時実行）
- **push 失敗**: Actions の権限が read のみ。ワークフローの `permissions: contents: write` を確認、または repo Settings → Actions → Workflow permissions で "Read and write" に

## example/

`example/` に最小の HTML とダミー `releases.json` が入っている。**プロジェクトルート**で HTTP サーバーを起動:

```
python3 -m http.server 8000
open http://localhost:8000/example/
```

（`example/` は `../sonotracks-catalog.css` / `../sonotracks-catalog.js` を参照するので、
プロジェクトルートから配信する必要がある）

## ライセンス

MIT。詳細は [LICENSE](./LICENSE)。

## 関連

- WordPress プラグイン版: <https://github.com/miryna1978/sonotracks-discography>
- sonoTracks: <https://sono-tracks.com/>
