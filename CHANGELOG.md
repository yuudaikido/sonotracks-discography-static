# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-15

### Added
- 静的サイトから sonoTracks の作品一覧を表示する最小パッケージ
- `sonotracks-catalog.js` — バニラ JS、宣言的 (data-\*) と命令的 (JS API) の両方をサポート
- `sonotracks-catalog.css` — CSS カスタムプロパティによるテーマ化、[WordPress プラグイン版](https://github.com/miryna1978/sonotracks-discography)と同一の変数・クラス名
- `scripts/sync-sonotracks.py` — 標準ライブラリのみで動く同期スクリプト（Python 3.6+）
- `.github/workflows/sync-sonotracks.yml` — GitHub Actions 10分ごと自動同期
- `example/` — サンプル HTML とダミー releases.json
- 対応スケジューラー例: GitHub Actions / GitLab CI / Netlify / Vercel / 素の cron / 手動

### Design decisions
- 訪問者のブラウザから直接 sonoTracks を叩かない（CORS 制約回避 + sonoTracks 側の負荷ゼロ）
- 同期はサーバー側（CI or cron）で行い、結果を repo 内 `releases.json` に置く
- fetch 失敗時は既存 `releases.json` を保持（WP プラグインと同じ障害時挙動）
- CSS は色を持たない（テーマの色を奪わない、既定値の宣言ブロックを置かない）
