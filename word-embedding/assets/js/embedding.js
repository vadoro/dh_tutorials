/* 워드 임베딩 튜토리얼 — 예시 말뭉치와 진짜 계산
 *
 * 영상, 직접 해 보기, 놀이터, 퀴즈가 모두 이 파일의 함수로 계산합니다.
 * 같은 말뭉치를 examples/ 폴더에도 두었고, examples/embedding_basics.py가 같은 값을 다시 계산합니다.
 *
 * 1) 원-핫 벡터: 단어마다 자기 칸만 1인 벡터
 * 2) 동시 출현: 창(window) 안의 이웃 낱말을 세어 단어마다 한 줄씩 (동시 출현 행렬)
 * 3) word2vec 스킵그램 + 네거티브 샘플링: 가운데 낱말의 벡터로 이웃 낱말을 맞히며 짧은 벡터를 배웁니다.
 *    word2vec(Mikolov 외, 2013)의 방법을 그대로 따르되, 작게 줄였습니다.
 *    - 창 크기를 무작위로 줄이지 않고(shrink_windows 없음), 자주 나오는 낱말 덜어 내기(sample)도 하지 않습니다.
 *    - 난수는 시드를 고정한 mulberry32라서 같은 설정이면 언제나 같은 벡터가 나옵니다.
 * 4) 가까운 단어(코사인 유사도), 유추(b − a + c), 2차원 지도(PCA)
 *
 * 말뭉치는 설명을 위해 만든 52문장입니다. 낱말은 형태소 분석기가 고른 것처럼 원형으로 적었고,
 * ‘있다’ 같은 아주 흔한 말은 뺐습니다. 실제 연구에서는 수만~수백만 문장과 형태소 분석기를 씁니다.
 */
(function () {
  'use strict';
  var WE = (window.WE = window.WE || {});

  /* ---------- 1. 말뭉치 ---------- */
  // [원문, 낱말 원형(띄어 씀)]
  WE.CORPUS = [
    ['왕은 백성을 다스렸다', '왕 백성 다스리다'],
    ['임금은 백성을 다스렸다', '임금 백성 다스리다'],
    ['왕은 나라를 다스렸다', '왕 나라 다스리다'],
    ['임금은 나라를 다스렸다', '임금 나라 다스리다'],
    ['왕은 궁궐로 신하를 불렀다', '왕 궁궐 신하 부르다'],
    ['임금은 궁궐로 신하를 불렀다', '임금 궁궐 신하 부르다'],
    ['어진 왕은 백성을 아꼈다', '어질다 왕 백성 아끼다'],
    ['어진 임금은 백성을 아꼈다', '어질다 임금 백성 아끼다'],
    ['신하는 왕에게 글을 올렸다', '신하 왕 글 올리다'],
    ['신하는 임금에게 글을 올렸다', '신하 임금 글 올리다'],
    ['신하는 왕을 섬겼다', '신하 왕 섬기다'],
    ['백성은 임금을 섬겼다', '백성 임금 섬기다'],
    ['이성계는 조선을 세웠다', '이성계 조선 세우다'],
    ['이성계는 한양에 도읍을 정했다', '이성계 한양 도읍 정하다'],
    ['왕건은 고려를 세웠다', '왕건 고려 세우다'],
    ['왕건은 개경에 도읍을 정했다', '왕건 개경 도읍 정하다'],
    ['박혁거세는 신라를 세웠다', '박혁거세 신라 세우다'],
    ['박혁거세는 서라벌에 도읍을 정했다', '박혁거세 서라벌 도읍 정하다'],
    ['경복궁은 조선의 궁궐이었다', '경복궁 조선 궁궐'],
    ['한양에 경복궁을 지었다', '한양 경복궁 짓다'],
    ['만월대에는 고려의 궁궐이 있었다', '만월대 고려 궁궐'],
    ['개경 만월대에 궁궐을 지었다', '개경 만월대 궁궐 짓다'],
    ['월성에는 신라의 궁궐이 있었다', '월성 신라 궁궐'],
    ['서라벌에 월성을 쌓았다', '서라벌 월성 쌓다'],
    ['조선은 마침내 무너졌다', '조선 마침내 무너지다'],
    ['고려는 마침내 무너졌다', '고려 마침내 무너지다'],
    ['신라는 마침내 무너졌다', '신라 마침내 무너지다'],
    ['우리는 조선의 역사를 배웠다', '우리 조선 역사 배우다'],
    ['우리는 고려의 역사를 배웠다', '우리 고려 역사 배우다'],
    ['우리는 신라의 역사를 배웠다', '우리 신라 역사 배우다'],
    ['한양의 시장은 사람들로 붐볐다', '한양 시장 사람 붐비다'],
    ['개경의 시장은 사람들로 붐볐다', '개경 시장 사람 붐비다'],
    ['서라벌의 시장은 사람들로 붐볐다', '서라벌 시장 사람 붐비다'],
    ['한양에는 높은 성곽을 쌓았다', '한양 높다 성곽 쌓다'],
    ['개경에는 높은 성곽을 쌓았다', '개경 높다 성곽 쌓다'],
    ['서라벌에는 높은 성곽을 쌓았다', '서라벌 높다 성곽 쌓다'],
    ['배를 타고 강을 건넜다', '배 타다 강 건너다'],
    ['나룻배를 타고 강을 건넜다', '나룻배 타다 강 건너다'],
    ['돛단배를 타고 강을 건넜다', '돛단배 타다 강 건너다'],
    ['배는 바다로 나아갔다', '배 바다 나아가다'],
    ['돛단배는 바다로 나아갔다', '돛단배 바다 나아가다'],
    ['배는 강을 따라 내려갔다', '배 강 따르다 내려가다'],
    ['나룻배는 강을 따라 내려갔다', '나룻배 강 따르다 내려가다'],
    ['가을에 배가 달게 익었다', '가을 배 달다 익다'],
    ['가을에 감이 달게 익었다', '가을 감 달다 익다'],
    ['가을에 사과가 붉게 익었다', '가을 사과 붉다 익다'],
    ['가을에 감이 붉게 익었다', '가을 감 붉다 익다'],
    ['배를 깎아 먹었다', '배 깎다 먹다'],
    ['사과를 깎아 먹었다', '사과 깎다 먹다'],
    ['배를 따서 먹었다', '배 따다 먹다'],
    ['감을 따서 먹었다', '감 따다 먹다'],
    ['사과를 따서 먹었다', '사과 따다 먹다'],
  ];
  // ‘다’로 끝나는 원형은 동사·형용사로 봅니다. 다만 아래 낱말은 ‘다’로 끝나는 명사예요.
  WE.NOUN_EXCEPT = ['바다'];
  WE.isNoun = function (w) { return !/다$/.test(w) || WE.NOUN_EXCEPT.indexOf(w) >= 0; };

  // 문장들(낱말 배열의 배열) → 어휘와 빈도. 어휘 순서는 처음 나온 순서.
  WE.prepare = function (sents, minCount) {
    minCount = minCount || 1;
    var count = {}, order = [];
    sents.forEach(function (s) { s.forEach(function (w) { if (!(w in count)) { count[w] = 0; order.push(w); } count[w]++; }); });
    var vocab = order.filter(function (w) { return count[w] >= minCount; });
    var index = {}; vocab.forEach(function (w, i) { index[w] = i; });
    var kept = sents.map(function (s) { return s.filter(function (w) { return w in index; }); });
    return { sents: kept, vocab: vocab, index: index, count: vocab.map(function (w) { return count[w]; }), tokens: kept.reduce(function (a, s) { return a + s.length; }, 0) };
  };
  WE.DATA = WE.prepare(WE.CORPUS.map(function (r) { return r[1].split(' '); }));

  /* ---------- 2. 벡터 도구 ---------- */
  WE.dot = function (a, b) { var s = 0; for (var k = 0; k < a.length; k++) s += a[k] * b[k]; return s; };
  WE.norm = function (a) { return Math.sqrt(WE.dot(a, a)); };
  WE.cos = function (a, b) { var n = WE.norm(a) * WE.norm(b); return n ? WE.dot(a, b) / n : 0; };
  WE.unit = function (a) { var n = WE.norm(a) || 1; return a.map(function (x) { return x / n; }); };
  WE.fmt = function (x, k) { var s = (+x).toFixed(k == null ? 2 : k); return (x < 0 ? '−' + s.slice(1) : s); };
  WE.mulberry32 = function (a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  };

  // 원-핫 벡터
  WE.onehot = function (data, w) { var v = data.vocab.map(function () { return 0; }); v[data.index[w]] = 1; return v; };

  // 창 안의 이웃: 문장 s의 i번째 낱말과 짝이 되는 j들 (앞뒤 win개)
  WE.neighbors = function (s, i, win) {
    var out = [];
    for (var j = Math.max(0, i - win); j <= Math.min(s.length - 1, i + win); j++) if (j !== i) out.push(j);
    return out;
  };

  /* ---------- 3. 동시 출현 행렬 ---------- */
  WE.cooc = function (data, win) {
    var V = data.vocab.length, M = [];
    for (var i = 0; i < V; i++) { M.push([]); for (var j = 0; j < V; j++) M[i].push(0); }
    data.sents.forEach(function (s) {
      s.forEach(function (w, i) { WE.neighbors(s, i, win).forEach(function (j) { M[data.index[w]][data.index[s[j]]]++; }); });
    });
    return M;
  };
  // 어떤 단어 줄에서 0이 아닌 칸 (많은 순)
  WE.coocRow = function (data, M, w) {
    var row = M[data.index[w]];
    return data.vocab.map(function (x, j) { return { w: x, n: row[j] }; }).filter(function (o) { return o.n > 0; }).sort(function (a, b) { return b.n - a.n; });
  };

  /* ---------- 4. word2vec: 스킵그램 + 네거티브 샘플링 ---------- */
  // dim: 벡터 길이, window: 창 크기, negative: 진짜 이웃 하나당 뽑는 가짜 이웃 수,
  // epochs: 말뭉치를 되풀이해 읽는 횟수, alpha → minAlpha: 학습률(갈수록 줄어듦), seed: 난수 시드
  WE.CONFIG = { dim: 8, window: 2, negative: 5, epochs: 200, alpha: 0.05, minAlpha: 0.0001, seed: 7 };

  WE.train = function (data, cfg, opts) {
    cfg = cfg || WE.CONFIG; opts = opts || {};
    var V = data.vocab.length, d = cfg.dim, rnd = WE.mulberry32(cfg.seed), i, k;
    // 입력 벡터(우리가 쓰는 임베딩)는 작은 무작위 값, 출력 벡터는 0에서 시작 (word2vec과 같음)
    var W = [], C = [];
    for (i = 0; i < V; i++) { W.push([]); C.push([]); for (k = 0; k < d; k++) { W[i].push((rnd() - 0.5) / d); C[i].push(0); } }
    // 가짜 이웃은 빈도^0.75에 비례해 뽑음
    var cum = [], Z = 0, acc = 0;
    data.count.forEach(function (c) { Z += Math.pow(c, 0.75); });
    data.count.forEach(function (c) { acc += Math.pow(c, 0.75) / Z; cum.push(acc); });
    var sample = function () {
      var x = rnd(), lo = 0, hi = V - 1;
      while (lo < hi) { var m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
      return lo;
    };
    var perEpoch = 0;
    data.sents.forEach(function (s) { s.forEach(function (w, i) { perEpoch += WE.neighbors(s, i, cfg.window).length; }); });
    var total = perEpoch * cfg.epochs, step = 0, snaps = opts.snapshots ? [W.map(function (r) { return r.slice(); })] : null;
    var trace = opts.trace ? [] : null;      // 처음 몇 걸음을 기록 (영상에서 실제 걸음을 보여 주려고)
    var grad = new Array(d);
    for (var ep = 0; ep < cfg.epochs; ep++) {
      data.sents.forEach(function (s) {
        s.forEach(function (w, i) {
          var wi = data.index[w], v = W[wi];
          WE.neighbors(s, i, cfg.window).forEach(function (j) {
            var lr = cfg.alpha - (cfg.alpha - cfg.minAlpha) * step / total; step++;
            var ctx = data.index[s[j]], tg = [[ctx, 1]], drawn = [];
            for (var n = 0; n < cfg.negative; n++) { var t = sample(); drawn.push(t); if (t !== ctx) tg.push([t, 0]); }
            if (trace && trace.length < opts.trace) trace.push({ step: step - 1, center: wi, ctx: ctx, drawn: drawn, lr: lr });
            for (k = 0; k < d; k++) grad[k] = 0;
            tg.forEach(function (p) {
              var u = C[p[0]], dot = 0;
              for (k = 0; k < d; k++) dot += v[k] * u[k];
              var g = (p[1] - 1 / (1 + Math.exp(-dot))) * lr;     // 맞으면 당기고(1), 틀리면 밀어냄(0)
              for (k = 0; k < d; k++) grad[k] += g * u[k];
              for (k = 0; k < d; k++) u[k] += g * v[k];
            });
            for (k = 0; k < d; k++) v[k] += grad[k];
          });
        });
      });
      if (snaps) snaps.push(W.map(function (r) { return r.slice(); }));
    }
    return { data: data, cfg: cfg, W: W, C: C, snaps: snaps, trace: trace, pairs: perEpoch };
  };

  WE.vec = function (model, w, epoch) {
    var W = epoch == null || !model.snaps ? model.W : model.snaps[Math.max(0, Math.min(model.snaps.length - 1, epoch))];
    return W[model.data.index[w]];
  };
  WE.sim = function (model, a, b, epoch) { return WE.cos(WE.vec(model, a, epoch), WE.vec(model, b, epoch)); };
  // 가까운 단어 k개. nouns: 명사만
  WE.similar = function (model, w, k, nouns) {
    var v = WE.vec(model, w), data = model.data;
    return data.vocab.filter(function (x) { return x !== w && (!nouns || WE.isNoun(x)); })
      .map(function (x) { return { w: x, s: WE.cos(v, WE.vec(model, x)) }; })
      .sort(function (p, q) { return q.s - p.s; }).slice(0, k || 5);
  };
  // 유추 a : b = c : ?  →  b − a + c 에 가장 가까운 단어 (a, b, c는 뺌). 단위 벡터로 계산 (gensim most_similar와 같은 순위)
  WE.analogy = function (model, a, b, c, k, nouns) {
    var A = WE.unit(WE.vec(model, a)), B = WE.unit(WE.vec(model, b)), Cc = WE.unit(WE.vec(model, c));
    var q = B.map(function (x, i) { return x - A[i] + Cc[i]; });
    var list = model.data.vocab.filter(function (x) { return x !== a && x !== b && x !== c && (!nouns || WE.isNoun(x)); })
      .map(function (x) { return { w: x, s: WE.cos(q, WE.vec(model, x)) }; })
      .sort(function (p, r) { return r.s - p.s; }).slice(0, k || 3);
    return { q: q, list: list };
  };

  /* ---------- 5. 2차원 지도 (PCA) ---------- */
  // rows: 벡터들. 단위 길이로 맞추고 평균을 뺀 뒤, 거듭제곱법으로 분산이 가장 큰 두 축을 찾습니다.
  // orient: [[양수 쪽에 둘 행 번호, 음수 쪽 행 번호], [y축도 같게]] — 화면 방향을 고정하려고 씀(선택)
  WE.pca2 = function (rows, orient, raw) {
    var X = rows.map(function (r) { return raw ? r.slice() : WE.unit(r); }), n = X.length, d = X[0].length, i, j, k, it;
    var mean = []; for (k = 0; k < d; k++) { var m = 0; for (i = 0; i < n; i++) m += X[i][k]; mean.push(m / n); }
    X = X.map(function (r) { return r.map(function (x, k) { return x - mean[k]; }); });
    var S = []; for (j = 0; j < d; j++) { S.push([]); for (k = 0; k < d; k++) { var s = 0; for (i = 0; i < n; i++) s += X[i][j] * X[i][k]; S[j].push(s / n); } }
    var trace = 0; for (k = 0; k < d; k++) trace += S[k][k];
    var axes = [], vars = [];
    for (var c = 0; c < 2; c++) {
      var v = []; for (k = 0; k < d; k++) v.push(1 + k / d);
      for (it = 0; it < 1000; it++) {
        var nv = []; for (j = 0; j < d; j++) { var t = 0; for (k = 0; k < d; k++) t += S[j][k] * v[k]; nv.push(t); }
        var nn = WE.norm(nv) || 1; v = nv.map(function (x) { return x / nn; });
      }
      var lam = 0; for (j = 0; j < d; j++) { var u = 0; for (k = 0; k < d; k++) u += S[j][k] * v[k]; lam += v[j] * u; }
      for (j = 0; j < d; j++) for (k = 0; k < d; k++) S[j][k] -= lam * v[j] * v[k];
      var proj = X.map(function (r) { return WE.dot(r, v); }), flip;
      if (orient && orient[c]) flip = proj[orient[c][0]] < proj[orient[c][1]];
      else { var big = 0; proj.forEach(function (p) { if (Math.abs(p) > Math.abs(big)) big = p; }); flip = big < 0; }
      if (flip) v = v.map(function (x) { return -x; });
      axes.push(v); vars.push(lam / trace);
    }
    return { pts: X.map(function (r) { return [WE.dot(r, axes[0]), WE.dot(r, axes[1])]; }), axes: axes, mean: mean, vars: vars, unit: !raw };
  };
  // 정해 둔 축에 다른 벡터들을 올려놓기 (학습 과정 그림: 마지막 벡터로 찾은 축에 중간 벡터를 투영)
  WE.project = function (map, rows) {
    return rows.map(function (r) { var x = map.unit ? WE.unit(r) : r; var c = x.map(function (v, k) { return v - map.mean[k]; }); return [WE.dot(c, map.axes[0]), WE.dot(c, map.axes[1])]; });
  };

  /* ---------- 6. 미리 계산해 둔 결과 (영상·퀴즈가 씀) ---------- */
  WE.MODEL = WE.train(WE.DATA, WE.CONFIG, { snapshots: true, trace: 60 });
  // 영상에서 보여 줄 걸음: 가짜 이웃 5개가 모두 서로 다르고 가운데·진짜 이웃과도 다른 첫 걸음
  WE.STEP = WE.MODEL.trace.filter(function (o) {
    var seen = {}; return o.drawn.every(function (t) { if (seen[t] || t === o.center || t === o.ctx) return false; seen[t] = 1; return true; });
  })[0];
  WE.COOC = WE.cooc(WE.DATA, WE.CONFIG.window);
  WE.coocCos = function (a, b) { return WE.cos(WE.COOC[WE.DATA.index[a]], WE.COOC[WE.DATA.index[b]]); };
  WE.together = function (a, b) { return WE.COOC[WE.DATA.index[a]][WE.DATA.index[b]]; };

  // 장면마다 그리는 단어 묶음
  WE.GROUPS = [
    { name: '임금과 신하', words: ['왕', '임금', '신하', '백성'] },
    { name: '나라', words: ['조선', '고려', '신라'] },
    { name: '도읍', words: ['한양', '개경', '서라벌'] },
    { name: '배', words: ['나룻배', '돛단배'] },
    { name: '과일', words: ['사과', '감'] },
  ];
  WE.MAP_LEARN = ['왕', '임금', '신하', '백성', '조선', '고려', '신라', '한양', '개경', '서라벌', '나룻배', '돛단배', '사과', '감', '배'];
  WE.MAP_ANALOGY = ['조선', '고려', '신라', '한양', '개경', '서라벌'];
  WE.MAP_POLY = ['배', '나룻배', '돛단배', '강', '바다', '사과', '감', '가을'];

  // 사용자가 쓴 글 → 문장(낱말 배열)들. 한 줄이 한 문장. josa: 어절 끝 조사 떼기(단순한 흉내)
  WE.PARTICLES = ['에서', '에게', '으로', '은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', '로'];
  WE.tokenize = function (text, josa) {
    return String(text).split(/\n+/).map(function (line) {
      return line.split(/\s+/).map(function (w) {
        w = w.replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9]+$/g, '');
        if (josa) for (var p = 0; p < WE.PARTICLES.length; p++) { var x = WE.PARTICLES[p]; if (w.length > x.length && w.slice(-x.length) === x) { w = w.slice(0, -x.length); break; } }
        return w;
      }).filter(Boolean);
    }).filter(function (s) { return s.length; });
  };
})();
