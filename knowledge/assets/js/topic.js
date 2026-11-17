(function () {
  'use strict';
  var App = window.KBApp;
  var D = App.DATA;
  var esc = App.escapeHtml;

  var root = document.getElementById('topicRoot');
  var params = new URLSearchParams(location.search);
  var slug = params.get('t') || D.topics[0].slug;
  var topic = App.topicBySlug[slug];

  function fail(msg) {
    root.innerHTML =
      '<div style="padding:120px 0;text-align:center">' +
        '<h1 style="font-size:28px;margin-bottom:12px">没有找到这篇教程</h1>' +
        '<p style="color:var(--muted);margin-bottom:24px">' + esc(msg) + '</p>' +
        '<a class="btn btn--primary" href="track.html">返回知识地图</a>' +
      '</div>';
  }

  if (!topic) { fail('参数 t 缺失或条目不存在。'); return; }

  function loadContent(slug) {
    return new Promise(function (resolve, reject) {
      if (window.KB_CONTENT && window.KB_CONTENT[slug]) { resolve(window.KB_CONTENT[slug]); return; }
      var s = document.createElement('script');
      s.src = 'content/aiinfra/' + slug + '.js';
      s.onload = function () {
        if (window.KB_CONTENT && window.KB_CONTENT[slug]) resolve(window.KB_CONTENT[slug]);
        else reject(new Error('脚本已加载但没有写入内容'));
      };
      s.onerror = function () { reject(new Error('无法加载 content/aiinfra/' + slug + '.js')); };
      document.head.appendChild(s);
    });
  }

  function slugify(text, i) {
    var s = String(text).trim().toLowerCase()
      .replace(/[^\w一-龥]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return s ? 's-' + s.slice(0, 36) : 'sec-' + i;
  }

  function render(entry) {
    var lv = D.levels[topic.level] || D.levels[0];
    var idx = D.topics.indexOf(topic);
    var prev = D.topics[idx - 1];
    var next = D.topics[idx + 1];

    var prereq = (topic.prereq || []).map(function (s) { return App.topicBySlug[s]; }).filter(Boolean);
    var dependents = D.topics.filter(function (t) { return (t.prereq || []).indexOf(topic.slug) >= 0; });

    var related = '';
    if (prereq.length || dependents.length) {
      related = '<section class="sec" style="margin-top:56px">' +
        '<h2>这条链路的前后</h2>' +
        '<div class="duo">' +
          '<div class="duo__col"><h4>读之前 · 前置</h4>' +
            (prereq.length
              ? '<ul>' + prereq.map(function (t) {
                  return '<li><a href="topic.html?t=' + encodeURIComponent(t.slug) + '">' + esc(t.title) + '</a> — ' + esc(t.subtitle) + '</li>';
                }).join('') + '</ul>'
              : '<p style="color:var(--muted)">本篇没有硬性前置，可以直接开始。</p>') +
          '</div>' +
          '<div class="duo__col"><h4>读之后 · 继续</h4>' +
            (dependents.length
              ? '<ul>' + dependents.map(function (t) {
                  return '<li><a href="topic.html?t=' + encodeURIComponent(t.slug) + '">' + esc(t.title) + '</a> — ' + esc(t.subtitle) + '</li>';
                }).join('') + '</ul>'
              : '<p style="color:var(--muted)">这是链路末端，可以回到地图自由探索。</p>') +
          '</div>' +
        '</div>' +
      '</section>';
    }

    var pager = '<nav class="pager" aria-label="上下篇">' +
      (prev
        ? '<a href="topic.html?t=' + encodeURIComponent(prev.slug) + '"><span>← 上一篇</span><b>' + esc(prev.title) + '</b></a>'
        : '<a class="is-empty"><span>← 上一篇</span><b>已经是第一篇</b></a>') +
      (next
        ? '<a href="topic.html?t=' + encodeURIComponent(next.slug) + '"><span>下一篇 →</span><b>' + esc(next.title) + '</b></a>'
        : '<a class="is-empty"><span>下一篇 →</span><b>已经读完整个地图</b></a>') +
    '</nav>';

    var keypoints = (topic.keyPoints && topic.keyPoints.length)
      ? '<div class="keypoints"><h2>读完你应该能回答</h2><ul>' +
          topic.keyPoints.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') +
        '</ul></div>'
      : '';

    var tags = (topic.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    var isDone = App.isDone(topic.slug);

    root.innerHTML =
      '<div class="topic-head">' +
        '<div class="crumbs">' +
          '<a href="index.html">首页</a><span>/</span>' +
          '<a href="track.html">AI Infra</a><span>/</span>' +
          '<a href="track.html?level=' + topic.level + '">L' + topic.level + ' ' + esc(lv.name) + '</a><span>/</span>' +
          '<span style="color:var(--muted)">' + esc(topic.title) + '</span>' +
        '</div>' +
        '<span class="badge badge--level" style="--lv:' + lv.color + '">LAYER ' + topic.level + ' · ' + esc(lv.name) + '</span>' +
        '<h1>' + esc(topic.title) + '</h1>' +
        '<p class="lede">' + esc(topic.subtitle || '') + '</p>' +
        '<div class="topic-meta">' +
          '<span>' + (topic.readingMinutes || '—') + ' 分钟</span><i class="dot"></i>' +
          '<span>约 ' + (topic.chars ? Math.round(topic.chars / 100) / 10 : '—') + 'k 字</span><i class="dot"></i>' +
          '<div class="tag-list">' + tags + '</div>' +
          '<div class="topic-actions">' +
            '<button class="btn btn--ghost btn--sm done-btn' + (isDone ? ' is-done' : '') + '" id="doneBtn" aria-pressed="' + isDone + '">' +
              App.ICONS.mark + '<span>' + (isDone ? '已学完' : '标记为已学完') + '</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="topic-layout">' +
        '<article class="article" id="article">' +
          keypoints +
          (entry && entry.html ? entry.html : '<p style="color:var(--muted)">这篇内容正在撰写中。</p>') +
          related +
          pager +
        '</article>' +
        '<aside class="toc" aria-label="本篇目录">' +
          '<h2>本篇目录</h2>' +
          '<ol id="tocList"></ol>' +
          '<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted-2);line-height:1.7">' +
            '进度会自动保存在本机浏览器。' +
          '</div>' +
        '</aside>' +
      '</div>';

    document.title = topic.title + ' · 知栈';
    var md = document.querySelector('meta[name="description"]');
    if (md && topic.summary) md.setAttribute('content', topic.summary);

    enhance();
  }

  function enhance() {
    var article = document.getElementById('article');
    if (!article) return;

    /* headings + toc */
    var heads = App.qsa('.sec h2', article);
    var tocList = document.getElementById('tocList');
    var seen = {};
    heads.forEach(function (h, i) {
      var id = h.id || slugify(h.textContent, i);
      if (seen[id]) id = id + '-' + i;
      seen[id] = true;
      h.id = id;
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = h.textContent.trim();
      li.appendChild(a);
      tocList.appendChild(li);
    });
    if (!location.hash && tocList.firstElementChild) {
      tocList.firstElementChild.querySelector('a').classList.add('is-active');
    }

    /* copy buttons */
    App.qsa('pre.code', article).forEach(function (pre) {
      var btn = document.createElement('button');
      btn.className = 'code-copy';
      btn.type = 'button';
      btn.textContent = '复制';
      btn.addEventListener('click', function () {
        var codeEl = pre.querySelector('code');
        var text = codeEl ? codeEl.innerText : pre.innerText;
        var done = function () { btn.textContent = '已复制'; setTimeout(function () { btn.textContent = '复制'; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, fallback);
        } else fallback();
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          document.body.removeChild(ta);
        }
      });
      pre.appendChild(btn);
    });

    /* external links open in a new tab */
    App.qsa('a[href^="http"]', article).forEach(function (a) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });

    /* done toggle */
    var doneBtn = document.getElementById('doneBtn');
    if (doneBtn) {
      doneBtn.addEventListener('click', function () {
        var now = !App.isDone(topic.slug);
        App.setDone(topic.slug, now);
        doneBtn.classList.toggle('is-done', now);
        doneBtn.setAttribute('aria-pressed', String(now));
        doneBtn.querySelector('span').textContent = now ? '已学完' : '标记为已学完';
        App.toast(now ? '已标记为学完 · 进度保存在本机' : '已取消完成标记');
      });
    }

    /* toc active state */
    if ('IntersectionObserver' in window && heads.length) {
      var links = {};
      App.qsa('#tocList a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          Object.keys(links).forEach(function (k) { links[k].classList.remove('is-active'); });
          if (links[en.target.id]) links[en.target.id].classList.add('is-active');
        });
      }, { rootMargin: '-16% 0px -74% 0px', threshold: 0 });
      heads.forEach(function (h) { io.observe(h); });
    }

    /* reading progress + back to top */
    var bar = document.getElementById('readProgress');
    var topBtn = document.createElement('button');
    topBtn.className = 'to-top';
    topBtn.type = 'button';
    topBtn.setAttribute('aria-label', '回到顶部');
    topBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 12l6-6 6 6"/></svg>';
    topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    document.body.appendChild(topBtn);
    function onScroll() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0) + '%';
      topBtn.classList.toggle('is-on', h.scrollTop > 700);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* keyboard nav */
    var idx = D.topics.indexOf(topic);
    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'ArrowLeft' && D.topics[idx - 1]) location.href = 'topic.html?t=' + encodeURIComponent(D.topics[idx - 1].slug);
      if (e.key === 'ArrowRight' && D.topics[idx + 1]) location.href = 'topic.html?t=' + encodeURIComponent(D.topics[idx + 1].slug);
    });
  }

  loadContent(slug).then(function (entry) {
    render(entry);
    if (location.hash.length > 1) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) { target.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }).catch(function (err) {
    render(null);
    var note = document.createElement('div');
    note.className = 'callout callout--warn';
    note.style.margin = '24px 0';
    note.innerHTML = '<span class="callout__label">正文未就绪</span><div>' +
      esc(err.message) + '。如果这是本地打开，请确认 content/aiinfra/' + esc(slug) + '.js 存在。</div>';
    var article = document.getElementById('article');
    if (article) article.insertBefore(note, article.firstChild);
  });
})();
