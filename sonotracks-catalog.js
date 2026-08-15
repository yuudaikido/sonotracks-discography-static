/*!
 * sonotracks-discography-static v1.0
 * https://github.com/yuudaikido/sonotracks-discography-static
 * MIT License
 *
 * sonoTracks の公開 API から取得済みの releases.json を読み、静的サイトに
 * ディスコグラフィを描画する。API 直叩きはせず、同期は GitHub Actions が担う
 * （sonoTracks 側が落ちていても最後の内容が残る、WP プラグインと同じ挙動）。
 *
 * 使い方 (declarative):
 *   <div class="sonotracks-dg" data-src="releases.json" data-columns="4"></div>
 *   <script src="sonotracks-catalog.js"></script>
 *
 * 使い方 (imperative):
 *   <div id="my-catalog"></div>
 *   <script src="sonotracks-catalog.js"></script>
 *   <script>
 *     sonotracksCatalog({
 *       container: '#my-catalog',
 *       src: 'releases.json',
 *       columns: 4,
 *       limit: 24,
 *       paged: true
 *     });
 *   </script>
 *
 * オプション / データ属性:
 *   src       (data-src)      releases.json のパス。既定 "releases.json"
 *   columns   (data-columns)  列数。既定 4
 *   limit     (data-limit)    1ページ最大件数（1-24）。既定 24
 *   paged     (data-paged)    "true" でページ送り。既定 false（先頭 limit 件のみ）
 *   moreLabel (data-more-label) 「すべて見る」リンクの文言（言語別 CSS で切替不可のため）
 */
(function (global) {
  'use strict';

  var DEFAULT_SRC = 'releases.json';
  var DEFAULT_LIMIT = 24;
  var MAX_LIMIT = 24;
  var DEFAULT_MORE_LABEL = 'sonoTracks ですべて見る →';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function priceLabel(min) {
    if (min == null) return '';
    return '¥' + Number(min).toLocaleString() + '〜';
  }

  function fetchJson(url) {
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function renderItem(r) {
    var alt = r.title + (r.artist ? ' — ' + r.artist : '');
    var art = r.artworkUrl
      ? '<img class="sonotracks-dg__artwork" src="' + esc(r.artworkUrl) + '" alt="' + esc(alt) + '" loading="lazy">'
      : '<span class="sonotracks-dg__artwork" aria-hidden="true"></span>';
    var price = (r.priceMin != null) ? '<span class="sonotracks-dg__price">' + esc(priceLabel(r.priceMin)) + '</span>' : '';
    return '<li>'
      + '<a class="sonotracks-dg__link" href="' + esc(r.url) + '" target="_blank" rel="noopener">'
      + art
      + '<span class="sonotracks-dg__title">' + esc(r.title) + '</span>'
      + '<span class="sonotracks-dg__artist">' + esc(r.artist) + '</span>'
      + price
      + '</a>'
      + '</li>';
  }

  function pagerHtml(current, totalPages) {
    if (totalPages <= 1) return '';
    // 短いページ数なら全て、長ければ 1 … cur-1 cur cur+1 … last のパターン
    var pages = [];
    if (totalPages <= 7) {
      for (var p = 1; p <= totalPages; p++) pages.push(p);
    } else {
      pages.push(1);
      if (current > 3) pages.push('gap');
      for (var q = Math.max(2, current - 1); q <= Math.min(totalPages - 1, current + 1); q++) pages.push(q);
      if (current < totalPages - 2) pages.push('gap');
      pages.push(totalPages);
    }
    var lis = pages.map(function (p) {
      if (p === 'gap') return '<li><span class="sonotracks-dg__pagergap">…</span></li>';
      if (p === current) {
        return '<li><span class="sonotracks-dg__pagernow" aria-current="page">'
          + p + '<span class="screen-reader-text"> (current page)</span></span></li>';
      }
      return '<li><a href="#" data-page="' + p + '" aria-label="Go to page ' + p + '">' + p + '</a></li>';
    }).join('');
    return '<nav class="sonotracks-dg__pager" aria-label="Pagination"><ul>' + lis + '</ul></nav>';
  }

  function moreHtml(artistUrl, label) {
    if (!artistUrl) return '';
    return '<p class="sonotracks-dg__more"><a href="' + esc(artistUrl) + '" target="_blank" rel="noopener">' + esc(label) + '</a></p>';
  }

  function initInstance(el, opts) {
    opts = opts || {};
    var src = opts.src || el.getAttribute('data-src') || DEFAULT_SRC;
    var limit = Number(opts.limit || el.getAttribute('data-limit') || DEFAULT_LIMIT);
    if (!limit || limit > MAX_LIMIT) limit = MAX_LIMIT;
    var columns = opts.columns || el.getAttribute('data-columns');
    var pagedAttr = opts.paged != null ? opts.paged : el.getAttribute('data-paged');
    var paged = String(pagedAttr) === 'true';
    var moreLabel = opts.moreLabel || el.getAttribute('data-more-label') || DEFAULT_MORE_LABEL;

    if (columns) el.style.setProperty('--sonotracks-dg-columns', columns);
    if (!el.classList.contains('sonotracks-dg')) el.classList.add('sonotracks-dg');

    var state = { page: 1 };

    function render(data) {
      var all = (data && data.releases) || [];
      if (!all.length) {
        el.innerHTML = '';
        return;
      }
      var totalPages = paged ? Math.max(1, Math.ceil(all.length / limit)) : 1;
      if (state.page > totalPages) state.page = totalPages;
      var items = paged
        ? all.slice((state.page - 1) * limit, state.page * limit)
        : all.slice(0, limit);
      var listItems = items.map(renderItem).join('');
      var pager = paged ? pagerHtml(state.page, totalPages) : '';
      var more = (!paged && all.length > limit) ? moreHtml(data.artistUrl, moreLabel) : '';
      el.innerHTML = '<ul class="sonotracks-dg__list">' + listItems + '</ul>' + pager + more;
      if (paged) bindPager(el, function (p) { state.page = p; render(data); });
    }

    fetchJson(src).then(render).catch(function (e) {
      // WP プラグインと同じ挙動: エラー文字はサイトに出さない
      if (global.console && global.console.warn) {
        global.console.warn('[sonotracks-catalog] failed to load ' + src + ':', e);
      }
    });
  }

  function bindPager(el, cb) {
    var pager = el.querySelector('.sonotracks-dg__pager');
    if (!pager) return;
    pager.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-page]') : null;
      if (!t) return;
      e.preventDefault();
      cb(Number(t.getAttribute('data-page')));
      var rect = el.getBoundingClientRect();
      var top = rect.top + (global.pageYOffset || document.documentElement.scrollTop) - 20;
      global.scrollTo({ top: top, behavior: 'smooth' });
    });
  }

  function autoInit() {
    var els = document.querySelectorAll('.sonotracks-dg:not([data-sonotracks-initialized])');
    for (var i = 0; i < els.length; i++) {
      els[i].setAttribute('data-sonotracks-initialized', '1');
      initInstance(els[i]);
    }
  }

  function api(opts) {
    opts = opts || {};
    var el = typeof opts.container === 'string' ? document.querySelector(opts.container) : opts.container;
    if (!el) {
      if (global.console && global.console.warn) {
        global.console.warn('[sonotracks-catalog] container not found:', opts.container);
      }
      return;
    }
    el.setAttribute('data-sonotracks-initialized', '1');
    initInstance(el, opts);
  }

  global.sonotracksCatalog = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})(typeof window !== 'undefined' ? window : this);
