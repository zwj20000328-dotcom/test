/* Knowledge Atlas — shared runtime */
(function () {
  'use strict';

  var PROGRESS_KEY = 'zhizhan.progress.v1';
  var THEME_KEY = 'zhizhan.theme.v1';

  var DATA = window.KB_DATA || { site: {}, levels: [], tracks: [], paths: [], topics: [], stats: {} };
  var topicBySlug = {};
  DATA.topics.forEach(function (t) { topicBySlug[t.slug] = t; });

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- theme ---------- */
  function preferredTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    var btn = qs('#themeBtn');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
      btn.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    }
  }
  function toggleTheme() {
    var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  /* ---------- progress ---------- */
  function readProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function isDone(slug) { return Boolean(readProgress()[slug]); }
  function setDone(slug, done) {
    var p = readProgress();
    if (done) p[slug] = Date.now(); else delete p[slug];
    writeProgress(p);
    return done;
  }
  function completion(slugs) {
    var p = readProgress();
    var list = slugs && slugs.length ? slugs : DATA.topics.map(function (t) { return t.slug; });
    var done = list.filter(function (s) { return p[s]; }).length;
    return { done: done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  /* ---------- icons ---------- */
  var ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/></svg>',
    mark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12.5 5 5L20 6.5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    logo: '<svg viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="currentColor" opacity=".08"/><path d="M9 10.5 16 6l7 4.5v11L16 26l-7-4.5v-11Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 10.5 16 15l7-4.5M16 15v11" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" opacity=".55"/><circle cx="16" cy="15" r="2.2" fill="currentColor"/></svg>'
  };

  /* ---------- layout chrome ---------- */
  var NAV_ITEMS = [
    { id: 'home', href: 'index.html', label: '首页' },
    { id: 'map', href: 'track.html', label: '知识地图' },
    { id: 'resources', href: 'resources.html', label: '资源库' },
    { id: 'games', href: 'games.html', label: '练一练' }
  ];

  function renderNav() {
    var host = qs('#siteNav');
    if (!host) return;
    var active = document.body.getAttribute('data-nav') || '';
    host.className = 'nav';
    host.innerHTML =
      '<div class="wrap nav__inner">' +
        '<a class="brand" href="index.html">' + ICONS.logo +
          '<span>' + escapeHtml(DATA.site.name || '知栈') +
            '<small>' + escapeHtml(DATA.site.en || 'STACK ATLAS') + '</small></span>' +
        '</a>' +
        '<nav class="nav__links" aria-label="主导航">' +
          NAV_ITEMS.map(function (n) {
            return '<a class="nav__link' + (n.id === active ? ' is-active' : '') + '" href="' + n.href + '">' + n.label + '</a>';
          }).join('') +
        '</nav>' +
        '<div class="nav__spacer"></div>' +
        '<div class="nav__actions">' +
          '<button class="icon-btn nav__burger" id="navBurger" aria-label="打开菜单" aria-expanded="false" aria-controls="navMobile">' + ICONS.menu + '</button>' +
          '<button class="icon-btn" id="searchBtn" aria-label="搜索知识条目">' + ICONS.search +
            '<span class="kbd" style="margin-left:2px">⌘K</span></button>' +
          '<button class="icon-btn" id="themeBtn" aria-label="切换主题"></button>' +
        '</div>' +
      '</div>' +
      '<div class="nav__mobile" id="navMobile">' +
        NAV_ITEMS.map(function (n) {
          return '<a href="' + n.href + '"' + (n.id === active ? ' style="color:var(--brand)"' : '') + '>' + n.label + '</a>';
        }).join('') +
      '</div>';
    qs('#themeBtn').addEventListener('click', toggleTheme);
    qs('#searchBtn').addEventListener('click', openSearch);
    var burger = qs('#navBurger');
    var mobile = qs('#navMobile');
    burger.addEventListener('click', function () {
      var open = mobile.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.innerHTML = open ? ICONS.close : ICONS.menu;
    });
    qsa('a', mobile).forEach(function (a) {
      a.addEventListener('click', function () { mobile.classList.remove('is-open'); });
    });
    document.addEventListener('click', function (e) {
      if (!mobile.classList.contains('is-open')) return;
      if (mobile.contains(e.target) || burger.contains(e.target)) return;
      mobile.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      burger.innerHTML = ICONS.menu;
    });
  }

  function renderFooter() {
    var host = qs('#siteFooter');
    if (!host) return;
    var s = DATA.stats || {};
    host.className = 'footer';
    host.innerHTML =
      '<div class="wrap footer__inner">' +
        '<div>' +
          '<b>' + escapeHtml(DATA.site.name || '知栈') + ' · ' + escapeHtml(DATA.site.en || '') + '</b><br>' +
          '把复杂的系统，拆成可以理解的一层层。' +
          '<div style="margin-top:10px;font-size:12px;opacity:.8">' +
            (s.written || 0) + ' 篇教程 · ' + (s.diagrams || 0) + ' 张图解 · 约 ' + Math.round((s.words || 0) / 1000) + 'k 字' +
          '</div>' +
        '</div>' +
        '<div class="footer__links">' +
          '<a href="track.html">知识地图</a>' +
          '<a href="resources.html">资源库</a>' +
          '<a href="games.html">练一练</a>' +
          '<a href="resources.html#manage">维护本页</a>' +
        '</div>' +
        '<div style="max-width:280px;font-size:12px;line-height:1.7;opacity:.75">' +
          '所有数据与图解均为教学用途。硬件数字标注了设备型号与口径，选型请以官方规格为准。' +
        '</div>' +
      '</div>';
  }

  /* ---------- search ---------- */
  var searchState = { active: 0, results: [] };

  function ensureSearch() {
    if (qs('#searchModal')) return;
    var modal = document.createElement('div');
    modal.id = 'searchModal';
    modal.className = 'search-modal';
    modal.innerHTML =
      '<div class="search-box" role="dialog" aria-modal="true" aria-label="搜索">' +
        '<input class="search-box__input" id="searchInput" type="search" placeholder="搜索条目、标签或关键词…" autocomplete="off">' +
        '<div class="search-box__list" id="searchList"></div>' +
        '<div class="search-box__foot"><span>↑↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeSearch(); });
    qs('#searchInput').addEventListener('input', function (e) { runSearch(e.target.value); });
    qs('#searchInput').addEventListener('keydown', onSearchKey);
  }

  function openSearch() {
    ensureSearch();
    var m = qs('#searchModal');
    m.classList.add('is-open');
    var input = qs('#searchInput');
    input.value = '';
    runSearch('');
    setTimeout(function () { input.focus(); }, 10);
  }
  function closeSearch() {
    var m = qs('#searchModal');
    if (m) m.classList.remove('is-open');
  }

  function runSearch(q) {
    var query = (q || '').trim().toLowerCase();
    var list = DATA.topics.filter(function (t) { return t.hasContent; });
    if (query) {
      list = list.filter(function (t) {
        var hay = [t.title, t.subtitle, t.summary, (t.tags || []).join(' '), t.cluster].join(' ').toLowerCase();
        return hay.indexOf(query) >= 0;
      });
    }
    searchState.results = list.slice(0, 12);
    searchState.active = 0;
    renderSearchResults(query);
  }

  function renderSearchResults(query) {
    var host = qs('#searchList');
    if (!host) return;
    if (!searchState.results.length) {
      host.innerHTML = '<div style="padding:24px;text-align:center;color:var(--muted);font-size:13px">没有找到「' + escapeHtml(query) + '」</div>';
      return;
    }
    host.innerHTML = searchState.results.map(function (t, i) {
      var lv = DATA.levels[t.level] || { name: '', color: 'var(--muted)' };
      return '<a class="search-res' + (i === searchState.active ? ' is-active' : '') + '" href="topic.html?t=' + encodeURIComponent(t.slug) + '" data-idx="' + i + '">' +
        '<span class="search-res__lv" style="color:' + lv.color + ';border-color:color-mix(in srgb,' + lv.color + ' 35%, transparent)">L' + t.level + ' ' + escapeHtml(lv.name) + '</span>' +
        '<span style="min-width:0"><b>' + escapeHtml(t.title) + '</b><small>' + escapeHtml(t.subtitle || '') + '</small></span>' +
      '</a>';
    }).join('');
  }

  function onSearchKey(e) {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      var d = e.key === 'ArrowDown' ? 1 : -1;
      searchState.active = (searchState.active + d + searchState.results.length) % searchState.results.length;
      renderSearchResults(qs('#searchInput').value);
      return;
    }
    if (e.key === 'Enter') {
      var t = searchState.results[searchState.active];
      if (t) window.location.href = 'topic.html?t=' + encodeURIComponent(t.slug);
    }
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape') closeSearch();
  });

  /* ---------- misc ---------- */
  var toastEl;
  var toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }

  function reveal() {
    var els = qsa('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      qsa('.reveal:not(.is-in)').forEach(function (el) { el.classList.add('is-in'); });
    }, 1600);
  }

  function levelOf(t) { return DATA.levels[t.level] || DATA.levels[0]; }

  function init() {
    renderNav();
    renderFooter();
    var param = new URLSearchParams(location.search).get('theme');
    var theme = param === 'dark' || param === 'light'
      ? param
      : localStorage.getItem(THEME_KEY) ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(theme);
    reveal();
  }

  window.KBApp = {
    DATA: DATA,
    ICONS: ICONS,
    qs: qs,
    qsa: qsa,
    escapeHtml: escapeHtml,
    topicBySlug: topicBySlug,
    levelOf: levelOf,
    isDone: isDone,
    setDone: setDone,
    completion: completion,
    readProgress: readProgress,
    writeProgress: writeProgress,
    toast: toast,
    openSearch: openSearch,
    applyTheme: applyTheme,
    reveal: reveal
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
