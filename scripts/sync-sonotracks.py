#!/usr/bin/env python3
"""
sonoTracks 公開 API から作品一覧を取得し、releases.json に保存する。

Python 3.6+ / 標準ライブラリのみで動作。GitHub Actions・GitLab CI・
Netlify Build・Vercel Cron・素の cron・手動実行、いずれからも呼び出せる。

使い方:
  # スラッグを引数で
  python3 scripts/sync-sonotracks.py --slug your-slug

  # 環境変数で
  SONOTRACKS_SLUG=your-slug python3 scripts/sync-sonotracks.py

  # 出力先とページサイズを変える
  python3 scripts/sync-sonotracks.py --slug X --output public/releases.json --per-page 24

終了コード:
  0   成功。releases.json に内容更新があった（呼び出し元は commit / deploy する）
  100 成功。ただし syncedAt 以外に差分なし（呼び出し元は何もしなくてよい）
  1   fetch 失敗。既存の releases.json は書き換えない（WP プラグインと同じ挙動）
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import sys
import urllib.request

API_BASE = "https://sono-tracks.com/api/tracks/public/artist-releases"
UA = "sonotracks-discography-static/1.0"
DEFAULT_PER_PAGE = 24
DEFAULT_OUTPUT = "releases.json"


def fetch_page(slug: str, per_page: int, page: int, api_origin: str) -> dict:
    url = f"{api_origin}?slug={slug}&limit={per_page}&page={page}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def fetch_all(slug: str, per_page: int, api_origin: str) -> dict:
    first = fetch_page(slug, per_page, 1, api_origin)
    releases = list(first.get("releases", []))
    total_pages = int(first.get("totalPages", 1))
    for p in range(2, total_pages + 1):
        page = fetch_page(slug, per_page, p, api_origin)
        releases.extend(page.get("releases", []))
    return {
        "releases": releases,
        "total": first.get("total", len(releases)),
        "artistUrl": first.get("artistUrl"),
        "syncedAt": _dt.datetime.now(_dt.timezone.utc).isoformat(),
    }


def has_content_change(old: dict, new: dict) -> bool:
    old_cmp = {k: v for k, v in old.items() if k != "syncedAt"}
    new_cmp = {k: v for k, v in new.items() if k != "syncedAt"}
    return old_cmp != new_cmp


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync sonoTracks public releases into a local JSON file.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--slug",
        default=os.environ.get("SONOTRACKS_SLUG"),
        help="sonoTracks profile slug (last segment of https://sono-tracks.com/u/<slug>). "
        "Env: SONOTRACKS_SLUG",
    )
    parser.add_argument(
        "--output",
        default=os.environ.get("SONOTRACKS_OUTPUT", DEFAULT_OUTPUT),
        help=f"Output JSON path. Env: SONOTRACKS_OUTPUT. Default: {DEFAULT_OUTPUT}",
    )
    parser.add_argument(
        "--per-page",
        type=int,
        default=int(os.environ.get("SONOTRACKS_PER_PAGE", DEFAULT_PER_PAGE)),
        help=f"Items per API page (max {DEFAULT_PER_PAGE}). Env: SONOTRACKS_PER_PAGE",
    )
    parser.add_argument(
        "--api-origin",
        default=os.environ.get("SONOTRACKS_API_ORIGIN", API_BASE),
        help="Override API endpoint (rarely needed). Env: SONOTRACKS_API_ORIGIN",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Always write output even if content is unchanged (only syncedAt differs).",
    )
    args = parser.parse_args()

    if not args.slug:
        print("error: --slug or SONOTRACKS_SLUG is required", file=sys.stderr)
        return 2

    if args.slug == "your-slug-here":
        print(
            "error: SLUG is still the placeholder 'your-slug-here'.\n"
            "Edit .github/workflows/sync-sonotracks.yml (env.SLUG) or pass --slug <your-slug> "
            "before running the sync.",
            file=sys.stderr,
        )
        return 2

    try:
        new_data = fetch_all(args.slug, args.per_page, args.api_origin)
    except Exception as e:
        # WP プラグインと同じ: 既存 releases.json はそのまま残す
        print(f"warning: fetch failed, keeping existing {args.output}: {e}", file=sys.stderr)
        return 1

    if os.path.exists(args.output) and not args.force:
        try:
            with open(args.output, "r", encoding="utf-8") as f:
                old_data = json.load(f)
            if not has_content_change(old_data, new_data):
                print(f"no content change (only syncedAt differs) for {args.output}")
                return 100
        except (OSError, json.JSONDecodeError):
            pass  # 既存が読めなければ書き換えていい

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(new_data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {len(new_data['releases'])} releases to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
