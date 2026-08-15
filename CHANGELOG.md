# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-08-15

### Changed
- 既定の同期間隔を **10分ごと → 6時間ごと**（`0 */6 * * *`）に変更。
  sonoTracks 運営の想定利用頻度（1日数回程度）に合わせた。
  - `.github/workflows/sync-sonotracks.yml` の cron 既定値を更新
  - README の GitHub Actions / GitLab CI / Vercel / cron のサンプルスケジュールを 6時間に統一
  - README にプレースホルダの誤同期を防ぐ「APIの利用頻度について」節を追加
  - 短い間隔にする場合の推奨（最短でも1時間程度）を明記
- 即時反映は従来通り `workflow_dispatch`（Actions タブの "Run workflow"）で可能

## [1.0.0] — 2026-08-15

### Added
- 静的サイトから sonoTracks の作品一覧を表示する最小パッケージ
- `sonotracks-catalog.js` — バニラ JS、宣言的 (data-\*) と命令的 (JS API) の両方をサポート
- `sonotracks-catalog.css` — CSS カスタムプロパティによるテーマ化、[WordPress プラグイン版](https://github.com/miryna1978/sonotracks-discography)と同一の変数・クラス名
- `scripts/sync-sonotracks.py` — 標準ライブラリのみで動く同期スクリプト（Python 3.6+）
- `.github/workflows/sync-sonotracks.yml` — GitHub Actions 自動同期
- `example/` — サンプル HTML とダミー releases.json
- 対応スケジューラー例: GitHub Actions / GitLab CI / Netlify / Vercel / 素の cron / 手動

### Design decisions
- 訪問者のブラウザから直接 sonoTracks を叩かない（CORS 制約回避 + sonoTracks 側の負荷ゼロ）
- 同期はサーバー側（CI or cron）で行い、結果を repo 内 `releases.json` に置く
- fetch 失敗時は既存 `releases.json` を保持（WP プラグインと同じ障害時挙動）
- CSS は色を持たない（テーマの色を奪わない、既定値の宣言ブロックを置かない）
