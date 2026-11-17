(function () {
  'use strict';
  var App = window.KBApp;
  var D = App.DATA;
  var esc = App.escapeHtml;

  var state = { level: 'all', q: '', hideDone: false };
  var edgeNodes = {}; // slug -> [path elements]

  /* ---------- stats strip ---------- */
  var statsHost = document.getElementById('trackStats');
  var done = App.completion(D.topics.map(function (t) { return t.slug; }));
  var totalMinutes = D.topics.reduce(function (a, t) { return a + (t.readingMinutes || 0); }, 0);
  if (statsHost) {
    statsHost.innerHTML = [
      [D.topics.length, '个知识点'],
      [D.levels.length, '个层级'],
      [done.done + ' / ' + done.total, '已完成'],
      [Math.round(totalMinutes / 60) + ' 小时', '总阅读时长']
    ].map(function (it) { return '<div><b>' + it[0] + '</b><span>' + it[1] + '</span></div>'; }).join('');
  }

  /* ---------- level chips ---------- */
  var chipHost = document.getElementById('levelChips');
  var chips = [{ id: 'all', name: '全部' }].concat(D.levels.map(function (l) { return { id: String(l.id), name: 'L' + l.id + ' ' + l.name }; }));
  function renderChips() {
    chipHost.innerHTML = chips.map(function (c) {
      return '<button class="chip' + (String(state.level) === String(c.id) ? ' is-on' : '') + '" data-level="' + c.id + '">' +
        esc(c.name) + '</button>';
    }).join('');
    App.qsa('#levelChips .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        state.level = b.getAttribute('data-level');
        renderChips();
        applyFilters();
      });
    });
  }

  /* ---------- map ---------- */
  var levelList = document.getElementById('levelList');

  function nodeCard(t, index) {
    var lv = D.levels[t.level];
    var isDone = App.isDone(t.slug);
    return '' +
      '<a class="node' + (isDone ? ' is-done' : '') + '" href="topic.html?t=' + encodeURIComponent(t.slug) + '"' +
        ' data-slug="' + esc(t.slug) + '" data-prereq="' + esc((t.prereq || []).join(',')) + '"' +
        ' style="--lv:' + lv.color + '" aria-label="' + esc(t.title) + '，' + (t.readingMinutes || 0) + ' 分钟">' +
        '<div class="node__top">' +
          '<span class="node__idx">' + String(index).padStart(2, '0') + '</span>' +
          '<span class="node__done">' + App.ICONS.mark + '</span>' +
        '</div>' +
        '<h3>' + esc(t.title) + '</h3>' +
        '<p>' + esc(t.subtitle || t.summary || '') + '</p>' +
        '<div class="node__foot"><span>' + (t.readingMinutes || '—') + ' MIN</span><span>' + esc(lv.en || '') + '</span></div>' +
      '</a>';
  }

  function renderMap() {
    var globalIndex = 0;
    levelList.innerHTML = D.levels.map(function (lv) {
      var items = D.topics.filter(function (t) { return t.level === lv.id; });
      var lvDone = items.filter(function (t) { return App.isDone(t.slug); }).length;
      globalIndex += items.length;
      return '' +
        '<section class="level" data-level="' + lv.id + '" style="--lv:' + lv.color + '">' +
          '<div class="level__rail">' +
            '<span class="level__num">LAYER 0' + lv.id + '</span>' +
            '<div class="level__name">' + esc(lv.name) + '</div>' +
            '<div class="level__desc">' + esc(lv.desc) + '</div>' +
            '<div style="margin-top:10px;font-size:11px;color:var(--muted-2);font-family:var(--font-mono)">' +
              lvDone + ' / ' + items.length + ' DONE</div>' +
          '</div>' +
          '<div class="level__nodes">' +
            items.map(function (t) {
              var idx = D.topics.indexOf(t) + 1;
              return nodeCard(t, idx);
            }).join('') +
          '</div>' +
        '</section>';
    }).join('');
  }

  function visibleNodes() {
    return App.qsa('#levelList .node').filter(function (n) { return !n.classList.contains('is-hidden'); });
  }

  function applyFilters() {
    var q = state.q.trim().toLowerCase();
    App.qsa('#levelList .node').forEach(function (n) {
      var slug = n.getAttribute('data-slug');
      var t = App.topicBySlug[slug] || {};
      var hay = [t.title, t.subtitle, t.summary, (t.tags || []).join(' '), t.cluster, t.slug].join(' ').toLowerCase();
      var okLevel = state.level === 'all' || String(t.level) === String(state.level);
      var okQuery = !q || hay.indexOf(q) >= 0;
      var okDone = !state.hideDone || !App.isDone(slug);
      var show = okLevel && okQuery && okDone;
      n.classList.toggle('is-hidden', !show);
    });
    App.qsa('#levelList .level').forEach(function (sec) {
      var any = App.qsa('.node:not(.is-hidden)', sec).length > 0;
      sec.style.display = any ? '' : 'none';
    });
    var count = visibleNodes().length;
    var countEl = document.getElementById('mapCount');
    if (countEl) countEl.textContent = count + ' / ' + D.topics.length + ' 个知识点';
    drawEdges();
  }

  /* ---------- edges ---------- */
  var mapEl = document.getElementById('map');
  var edgeSvg = document.getElementById('mapEdges');
  var raf = null;

  function drawEdges() {
    var mapRect = mapEl.getBoundingClientRect();
    edgeSvg.setAttribute('width', mapRect.width);
    edgeSvg.setAttribute('height', mapRect.height);
    var positions = {};
    App.qsa('#levelList .node').forEach(function (n) {
      if (n.classList.contains('is-hidden')) return;
      var r = n.getBoundingClientRect();
      positions[n.getAttribute('data-slug')] = {
        x1: r.left - mapRect.left + r.width / 2,
        y1: r.top - mapRect.top,
        x2: r.left - mapRect.left + r.width / 2,
        y2: r.top - mapRect.top + r.height
      };
    });

    edgeNodes = {};
    var paths = [];
    D.topics.forEach(function (t) {
      (t.prereq || []).forEach(function (p) {
        var a = positions[p];
        var b = positions[t.slug];
        if (!a || !b) return;
        var dy = Math.max(18, Math.min(54, (b.y1 - a.y2) * 0.6));
        var d = 'M' + a.x1.toFixed(1) + ' ' + a.y2.toFixed(1) +
                ' C' + a.x1.toFixed(1) + ' ' + (a.y2 + dy).toFixed(1) +
                ' ' + b.x2.toFixed(1) + ' ' + (b.y1 - dy).toFixed(1) +
                ' ' + b.x2.toFixed(1) + ' ' + b.y1.toFixed(1);
        var p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        p1.setAttribute('d', d);
        p1.setAttribute('data-src', p);
        p1.setAttribute('data-dst', t.slug);
        paths.push(p1);
        (edgeNodes[p] = edgeNodes[p] || []).push(p1);
        (edgeNodes[t.slug] = edgeNodes[t.slug] || []).push(p1);
      });
    });
    edgeSvg.innerHTML = '';
    paths.forEach(function (p) { edgeSvg.appendChild(p); });
  }

  function scheduleEdges() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(drawEdges);
  }

  function bindHover() {
    App.qsa('#levelList .node').forEach(function (n) {
      n.addEventListener('mouseenter', function () {
        var slug = n.getAttribute('data-slug');
        (edgeNodes[slug] || []).forEach(function (p) { p.classList.add('is-hot'); });
      });
      n.addEventListener('mouseleave', function () {
        App.qsa('#mapEdges path.is-hot').forEach(function (p) { p.classList.remove('is-hot'); });
      });
    });
  }

  /* ---------- wire up ---------- */
  renderChips();
  renderMap();
  bindHover();

  var params = new URLSearchParams(location.search);
  if (params.get('level') !== null) state.level = params.get('level');
  if (params.get('q')) {
    state.q = params.get('q');
    document.getElementById('mapSearch').value = state.q;
  }
  if (params.get('level') !== null) renderChips();

  document.getElementById('mapSearch').addEventListener('input', function (e) {
    state.q = e.target.value;
    applyFilters();
  });

  var hideBtn = document.getElementById('hideDone');
  hideBtn.addEventListener('click', function () {
    state.hideDone = !state.hideDone;
    hideBtn.classList.toggle('is-on', state.hideDone);
    applyFilters();
  });

  applyFilters();
  setTimeout(drawEdges, 60);
  window.addEventListener('load', drawEdges);
  window.addEventListener('resize', scheduleEdges);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleEdges).observe(levelList);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawEdges);
})();
