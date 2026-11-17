(function () {
  'use strict';
  var App = window.KBApp;
  var D = App.DATA;
  var esc = App.escapeHtml;

  function minutesLabel(min) {
    if (!min) return '—';
    if (min < 60) return min + ' 分钟';
    return (min / 60).toFixed(1).replace('.0', '') + ' 小时';
  }

  var liveTracks = D.tracks.filter(function (t) { return t.status === 'live' && t.stats && t.stats.topics; });

  var heroCount = document.getElementById('heroCount');
  var heroSub = document.getElementById('heroSub');
  if (heroCount) heroCount.textContent = (D.stats.topics || 0) + ' 个';
  if (heroSub) heroSub.textContent = '知识点 · ' + liveTracks.length + ' 模块';

  /* hero stats */
  var statsHost = document.getElementById('heroStats');
  if (statsHost) {
    var s = D.stats || {};
    var items = [
      [s.written || 0, '篇深度教程'],
      [liveTracks.length, '个知识模块'],
      [s.diagrams || 0, '张原创图解'],
      [s.minutes || 0, '分钟阅读']
    ];
    statsHost.innerHTML = items.map(function (it) {
      return '<div><b>' + it[0] + '</b> ' + it[1] + '</div>';
    }).join('');
  }

  /* track cards */
  var trackHost = document.getElementById('trackGrid');
  if (trackHost) {
    trackHost.innerHTML = D.tracks.map(function (tr) {
      var live = tr.status === 'live' && tr.stats && tr.stats.topics;
      var c = live ? App.completion(tr.topicSlugs) : { pct: 0, done: 0, total: 0 };
      return '' +
        '<article class="card track-card ' + (live ? 'is-live reveal' : 'is-soon') + '"' + (live ? '' : ' aria-disabled="true"') + '>' +
          '<div class="track-card__top">' +
            '<div>' +
              '<span class="track-card__num">' + esc(tr.num) + ' / TRACK</span>' +
              '<h3>' + esc(tr.name) + '</h3>' +
              '<span class="track-card__en">' + esc(tr.en) + '</span>' +
            '</div>' +
            (live
              ? '<span class="badge badge--live"><i class="dot-live"></i>已上线</span>'
              : '<span class="badge">筹备中</span>') +
          '</div>' +
          '<p>' + esc(tr.desc) + '</p>' +
          '<div class="card__foot">' +
            (live
              ? '<div class="track-card__meta">' +
                  '<div class="progress-ring" style="--p:' + c.pct + '">' + c.pct + '%</div>' +
                  '<span><b>' + tr.stats.topics + '</b> 篇 · 约 <b>' + minutesLabel(tr.stats.minutes) + '</b></span>' +
                '</div>' +
                '<a class="card__link" href="track.html?track=' + encodeURIComponent(tr.id) + '">进入地图 →</a>'
              : '<span class="track-card__meta">计划中</span><span class="card__link" style="color:var(--muted)">敬请期待</span>') +
          '</div>' +
        '</article>';
    }).join('');
  }

  /* learning paths with track tabs */
  var pathHost = document.getElementById('pathGrid');
  var tabHost = document.getElementById('pathTabs');
  var activePath = liveTracks[0] ? liveTracks[0].id : null;

  function renderTabs() {
    if (!tabHost) return;
    tabHost.innerHTML = liveTracks.map(function (t) {
      return '<button class="chip' + (t.id === activePath ? ' is-on' : '') + '" data-track="' + t.id + '">' + esc(t.name) + '</button>';
    }).join('');
    App.qsa('.chip', tabHost).forEach(function (b) {
      b.addEventListener('click', function () {
        activePath = b.getAttribute('data-track');
        renderTabs();
        renderPaths();
      });
    });
  }

  function renderPaths() {
    if (!pathHost) return;
    var track = App.trackById[activePath];
    if (!track) { pathHost.innerHTML = ''; return; }
    pathHost.innerHTML = track.paths.map(function (p, i) {
      var steps = p.steps.map(function (slug) { return App.topicBySlug[slug]; }).filter(Boolean);
      var c = App.completion(steps.map(function (t) { return t.slug; }));
      return '' +
        '<article class="path reveal is-in">' +
          '<h3><span style="font-family:var(--font-mono);font-size:10.5px;color:var(--muted-2)">0' + (i + 1) + '</span>' + esc(p.name) + '</h3>' +
          '<p>' + esc(p.desc) + '</p>' +
          '<ol>' +
            steps.map(function (t) {
              return '<li><a href="topic.html?t=' + encodeURIComponent(t.slug) + '">' + esc(t.title) +
                (App.isDone(t.slug) ? ' <span style="color:var(--teal);font-family:var(--font-mono);font-size:10px">DONE</span>' : '') +
                '</a></li>';
            }).join('') +
          '</ol>' +
          '<div class="bar" style="margin-top:16px"><div class="bar__fill" style="width:' + c.pct + '%"></div></div>' +
          '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11.5px;color:var(--muted)">' +
            '<span>' + c.done + ' / ' + c.total + ' 已完成</span><span>' + c.pct + '%</span>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  renderTabs();
  renderPaths();
  App.reveal();
})();
