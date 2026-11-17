(function () {
  'use strict';
  var App = window.KBApp;
  var esc = App.escapeHtml;

  /* ==========================================================
     Game 01 · 术语配对
     ========================================================== */
  var PAIRS = [
    { term: 'HBM', def: '高带宽显存，GPU 的主存' },
    { term: 'Warp', def: '32 个线程组成的调度单元' },
    { term: 'AllReduce', def: '各卡求和后把结果广播给所有卡' },
    { term: 'KV Cache', def: '缓存历史 K/V，避免重复计算' },
    { term: 'MFU', def: '实际算力 ÷ 理论峰值算力' },
    { term: 'NVLink', def: '机内 GPU 之间的高带宽互联' },
    { term: 'ZeRO', def: '把优化器状态与梯度分片到各卡' },
    { term: 'PagedAttention', def: '像操作系统分页一样管理 KV Cache' }
  ];

  var mem = {
    deck: [],
    flipped: [],
    matched: 0,
    moves: 0,
    locked: false,
    started: false,
    timer: null,
    seconds: 0
  };

  var grid = document.getElementById('memoryGrid');
  var resultHost = document.getElementById('memoryResult');
  var movesEl = document.getElementById('moves');
  var matchesEl = document.getElementById('matches');
  var timerEl = document.getElementById('timer');

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function fmtTime(s) {
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function startTimer() {
    if (mem.timer) return;
    mem.timer = setInterval(function () {
      mem.seconds++;
      timerEl.textContent = fmtTime(mem.seconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(mem.timer);
    mem.timer = null;
  }

  function resetMemory() {
    stopTimer();
    mem.deck = shuffle(
      PAIRS.reduce(function (acc, p, i) {
        acc.push({ id: i, text: p.term, kind: 'term' });
        acc.push({ id: i, text: p.def, kind: 'def' });
        return acc;
      }, [])
    );
    mem.flipped = [];
    mem.matched = 0;
    mem.moves = 0;
    mem.locked = false;
    mem.started = false;
    mem.seconds = 0;
    movesEl.textContent = '0';
    matchesEl.textContent = '0 / ' + PAIRS.length;
    timerEl.textContent = '0:00';
    resultHost.innerHTML = '';
    grid.innerHTML = mem.deck.map(function (c, i) {
      return '<button class="mcard" data-idx="' + i + '" aria-label="第 ' + (i + 1) + ' 张卡片">' +
        '<span class="mcard__face mcard__front">知栈 · ATLAS</span>' +
        '<span class="mcard__face mcard__back' + (c.kind === 'term' ? ' is-term' : '') + '">' + esc(c.text) + '</span>' +
      '</button>';
    }).join('');
    App.qsa('.mcard', grid).forEach(function (card) {
      card.addEventListener('click', function () { onFlip(card); });
    });
  }

  function onFlip(card) {
    if (mem.locked) return;
    if (card.classList.contains('is-flipped') || card.classList.contains('is-matched')) return;
    if (!mem.started) { mem.started = true; startTimer(); }

    card.classList.add('is-flipped');
    mem.flipped.push(card);

    if (mem.flipped.length < 2) return;

    mem.moves++;
    movesEl.textContent = String(mem.moves);
    var a = mem.deck[Number(mem.flipped[0].getAttribute('data-idx'))];
    var b = mem.deck[Number(mem.flipped[1].getAttribute('data-idx'))];
    var pair = mem.flipped.slice();
    mem.flipped = [];

    if (a.id === b.id && a.kind !== b.kind) {
      pair.forEach(function (c) { c.classList.add('is-matched'); });
      mem.matched++;
      matchesEl.textContent = mem.matched + ' / ' + PAIRS.length;
      if (mem.matched === PAIRS.length) winMemory();
    } else {
      mem.locked = true;
      setTimeout(function () {
        pair.forEach(function (c) { c.classList.remove('is-flipped'); });
        mem.locked = false;
      }, 720);
    }
  }

  function winMemory() {
    stopTimer();
    var bestKey = 'zhizhan.game.memory.best';
    var best = Number(localStorage.getItem(bestKey) || 0);
    var isBest = !best || mem.moves < best;
    if (isBest) localStorage.setItem(bestKey, String(mem.moves));
    resultHost.innerHTML =
      '<div class="game-result">' +
        '<h3>全部配对完成</h3>' +
        '<div class="score-big">' + mem.moves + '</div>' +
        '<p>步 · 用时 ' + fmtTime(mem.seconds) + (best ? ' · 历史最佳 ' + Math.min(best, mem.moves) + ' 步' : '') + '</p>' +
        (isBest ? '<p style="color:var(--teal);font-size:13px">刷新了个人最佳记录</p>' : '') +
        '<button class="btn btn--ghost btn--sm" id="playAgain" style="margin-top:14px">再来一局</button>' +
      '</div>';
    document.getElementById('playAgain').addEventListener('click', resetMemory);
  }

  document.getElementById('resetMemory').addEventListener('click', resetMemory);
  resetMemory();

  /* ==========================================================
     Game 02 · 瓶颈诊断
     ========================================================== */
  var QUESTIONS = [
    {
      q: '单卡跑 7B 模型推理，batch=1 时 GPU 利用率只有 8%，SM 大量空闲。',
      options: ['算力不足', '显存带宽受限', '网络受限', '数据管道受限'],
      answer: 1,
      why: 'decode 每生成一个 token 都要把全部权重从 HBM 读一遍，却只做 2×参数量次浮点运算，算术强度极低，是典型的 memory-bound。提高 batch 可以摊薄权重读取。'
    },
    {
      q: '8 卡张量并行训练，单步时间反而比 4 卡更长，NCCL 占用很高。',
      options: ['显存容量不足', '通信开销超过并行收益', '数据加载太慢', '精度设置错误'],
      answer: 1,
      why: '张量并行每层都要 allreduce。当并行度超出高带宽互联域，或单卡计算量被切得太小，通信无法被计算掩盖，加速比会变成负数。'
    },
    {
      q: '128K 上下文、batch=16 时 OOM，但 4K 上下文同一 batch 正常。',
      options: ['Tensor Core 算力不足', 'KV Cache 显存增长', '磁盘 IO 太慢', 'IB 带宽不足'],
      answer: 1,
      why: 'KV Cache 大小与序列长度线性相关：2 × 层数 × KV 头数 × head_dim × 序列长度 × batch × 字节数。128K 时可能把剩余显存全部吃掉。'
    },
    {
      q: '训练 loss 正常，但每十分钟出现约 2 秒卡顿，期间 GPU 利用率掉到 0。',
      options: ['同步 checkpoint 写盘', '梯度爆炸', '学习率过低', '张量并行度过高'],
      answer: 0,
      why: '周期性、持续数秒的全局停顿通常来自同步 checkpoint 或数据 shuffle。改成异步/分片保存、提前预取可以消除。'
    },
    {
      q: 'prefill 一个 32K token 的请求 TTFT 很长，ncu 显示 SM 与 Tensor Core 接近满载。',
      options: ['网络瓶颈', '显存带宽瓶颈', '计算瓶颈', '存储瓶颈'],
      answer: 2,
      why: 'prefill 把整段上下文并行计算，算术强度高，通常是 compute-bound。算力打满说明时间主要花在矩阵乘上，只能从更少 FLOPs、更强算力或更优 kernel 入手。'
    },
    {
      q: 'MoE 推理使用 TP=8、EP=8，all-to-all 占用 50% 时间，GPU 计算利用率不足 40%。',
      options: ['算力不足', '网络/互联受限', '显存容量不足', '数据加载受限'],
      answer: 1,
      why: '专家并行的 all-to-all 要跨卡交换 token。跨 NVLink 域或 IB 带宽不足时，通信会直接吃掉一半时间，需要调整 EP 规模或拓扑。'
    },
    {
      q: '图像训练任务 GPU 利用率周期性掉到 10%，同时 CPU 上图像解码进程占满。',
      options: ['数据管道受限', '网络受限', '算力不足', '显存带宽受限'],
      answer: 0,
      why: 'GPU 在等数据。常见解法是预解码为分片格式（WebDataset/tar）、增加 worker、把解码放到 GPU，以及本地 NVMe 缓存。'
    },
    {
      q: '推理 batch 从 1 提到 32，单 token 延迟略升，但总吞吐提升约 20 倍。',
      options: ['GPU 时钟提高', '权重读取被摊薄', '网络变快', '精度被降低'],
      answer: 1,
      why: 'decode 阶段每步都要读一遍权重，batch 越大，同一份权重服务的 token 越多，带宽利用率越高，所以吞吐显著提升而单 token 延迟只小幅增加。'
    },
    {
      q: '把 TP=8 的 8 张卡从同一台机器拆到 8 台机器，训练性能明显下降。',
      options: ['内存容量变化', '跨机带宽远低于 NVLink', '磁盘 IO 变化', 'CPU 主频变化'],
      answer: 1,
      why: '张量并行通信密集，NVLink 每卡带宽是数百 GB/s，而单口 IB 只有几十 GB/s 且延迟更高。TP 应尽量留在 NVLink 域内。'
    },
    {
      q: '模型与 batch 不变，仅把权重从 FP16 换成 INT4，decode 吞吐大幅提升。',
      options: ['算力变强了', '每 token 搬运的字节变少', '网络变快', '序列变短'],
      answer: 1,
      why: 'decode 受显存带宽限制，权重量化到 4bit 后每步读取的字节数约为原来的四分之一，同时显存占用下降还能提高并发。'
    }
  ];

  var quiz = { index: 0, score: 0, answered: false, best: Number(localStorage.getItem('zhizhan.game.quiz.best') || 0) };
  var quizBody = document.getElementById('quizBody');
  var qProgress = document.getElementById('qProgress');
  var qScore = document.getElementById('qScore');
  var KEYS = ['A', 'B', 'C', 'D', 'E'];

  function resetQuiz() {
    quiz.index = 0;
    quiz.score = 0;
    quiz.answered = false;
    qScore.textContent = '0';
    qProgress.textContent = '1 / ' + QUESTIONS.length;
    renderQuestion();
  }

  function renderQuestion() {
    var q = QUESTIONS[quiz.index];
    quiz.answered = false;
    quizBody.innerHTML =
      '<div class="quiz-game__q">' +
        '<span class="tag">场景 ' + (quiz.index + 1) + ' / ' + QUESTIONS.length + '</span>' +
        '<h3>' + esc(q.q) + '</h3>' +
        '<p>最可能的瓶颈是？</p>' +
      '</div>' +
      '<div class="opts">' +
        q.options.map(function (opt, i) {
          return '<button class="opt" data-i="' + i + '"><span class="k">' + KEYS[i] + '</span>' + esc(opt) + '</button>';
        }).join('') +
      '</div>' +
      '<div id="explainHost"></div>';
    App.qsa('.opt', quizBody).forEach(function (b) {
      b.addEventListener('click', function () { answer(Number(b.getAttribute('data-i'))); });
    });
  }

  function answer(i) {
    if (quiz.answered) return;
    quiz.answered = true;
    var q = QUESTIONS[quiz.index];
    var buttons = App.qsa('.opt', quizBody);
    buttons.forEach(function (b, bi) {
      b.disabled = true;
      if (bi === q.answer) b.classList.add('is-right');
      else if (bi === i) b.classList.add('is-wrong');
    });
    var correct = i === q.answer;
    if (correct) {
      quiz.score++;
      qScore.textContent = String(quiz.score);
    }
    var last = quiz.index === QUESTIONS.length - 1;
    document.getElementById('explainHost').innerHTML =
      '<div class="explain"><b style="color:' + (correct ? 'var(--teal)' : 'var(--rose)') + '">' +
        (correct ? '判断正确。' : '再看一眼：') + '</b>' + esc(q.why) + '</div>' +
      '<div style="margin-top:16px;display:flex;justify-content:flex-end">' +
        '<button class="btn btn--primary btn--sm" id="nextQ">' + (last ? '查看结果 →' : '下一题 →') + '</button>' +
      '</div>';
    document.getElementById('nextQ').addEventListener('click', function () {
      if (last) showQuizResult();
      else {
        quiz.index++;
        qProgress.textContent = (quiz.index + 1) + ' / ' + QUESTIONS.length;
        renderQuestion();
      }
    });
  }

  function showQuizResult() {
    var total = QUESTIONS.length;
    var pct = Math.round((quiz.score / total) * 100);
    var verdict =
      pct >= 90 ? '瓶颈判断已经很稳了，可以直接去看性能剖析那篇。' :
      pct >= 70 ? '主干概念清楚，个别边界条件还需要补一下。' :
      pct >= 40 ? '建议回看「三个永恒瓶颈」和「推理基础」两篇。' :
      '别急，先读「AI Infra 全景图」和「算力、显存、带宽」。';
    var isBest = quiz.score > quiz.best;
    if (isBest) {
      quiz.best = quiz.score;
      localStorage.setItem('zhizhan.game.quiz.best', String(quiz.score));
    }
    qProgress.textContent = total + ' / ' + total;
    quizBody.innerHTML =
      '<div class="game-result">' +
        '<h3>' + (pct >= 70 ? '不错' : '继续加油') + '</h3>' +
        '<div class="score-big">' + quiz.score + '<span style="font-size:20px;color:var(--muted)"> / ' + total + '</span></div>' +
        '<p>' + verdict + '</p>' +
        '<p style="font-size:12.5px">历史最佳 ' + quiz.best + ' / ' + total + (isBest ? ' · 新纪录' : '') + '</p>' +
        '<div style="display:flex;gap:10px;justify-content:center;margin-top:18px;flex-wrap:wrap">' +
          '<button class="btn btn--ghost btn--sm" id="quizAgain">再来一次</button>' +
          '<a class="btn btn--primary btn--sm" href="topic.html?t=three-bottlenecks">复习性能模型</a>' +
        '</div>' +
      '</div>';
    document.getElementById('quizAgain').addEventListener('click', resetQuiz);
  }

  document.getElementById('resetQuiz').addEventListener('click', resetQuiz);
  resetQuiz();
})();
