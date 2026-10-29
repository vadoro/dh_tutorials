/* 감정분석 튜토리얼 — 예시 자료와 진짜 계산
 *
 * 영상, 직접 해 보기, 놀이터, 퀴즈가 모두 이 파일의 함수로 계산합니다.
 * 같은 자료를 examples/ 폴더에도 두었고, examples/sentiment_basics.py가 같은 값을 다시 계산합니다.
 *
 * 1) 감성 사전 + 규칙: 어절(띄어쓰기 단위)의 앞부분이 사전 단어와 맞으면 그 점수를 쓰고,
 *    부정어·강조어·대조(‘하지만’, ‘~지만’) 규칙으로 점수를 고칩니다.
 * 2) 나이브 베이즈: 사람이 긍정/부정을 표시한 서평에서 낱말의 무게를 배웁니다(라플라스 스무딩).
 *    낱말은 어절 앞부분으로 원형을 찾는 단순한 방법(형태소 분석기 흉내)으로 고릅니다.
 * 3) 감정 곡선: 이야기의 문장마다 1)의 점수를 매기고 이동 평균으로 부드럽게 만듭니다.
 *
 * 사전과 자료는 설명을 위해 만든 작은 예시입니다. 실제 연구에서는 KNU 한국어 감성사전 같은
 * 공개 사전과 형태소 분석기, 더 큰 학습 데이터를 씁니다.
 */
(function () {
  'use strict';
  var SA = (window.SA = window.SA || {});

  /* ---------- 1. 감성 사전과 규칙 ---------- */
  // 단어의 앞부분(어간) → 점수(−2 ~ +2). 활용형이 달라지는 단어는 앞부분을 여러 개 둡니다(예: 아름답다/아름다운).
  SA.LEXICON = {
    '최고': 2, '감동': 2, '훌륭': 2, '행복': 2,
    '좋': 1, '재미': 1, '재미있': 1, '재밌': 1, '아름답': 1, '아름다': 1, '따뜻': 1, '즐겁': 1, '즐거': 1,
    '기쁘': 1, '기뻐': 1, '기뻤': 1, '기쁨': 1, '고맙': 1, '고마': 1, '반갑': 1, '반가': 1, '추천': 1,
    '웃었': 1, '웃음': 1, '매끄럽': 1, '매끄러': 1, '신나': 1, '신났': 1, '사랑': 1, '잘하': 1, '잘했': 1,
    '정성': 1, '사이좋': 1, '편안': 1, '평화': 1,
    '나쁘': -1, '나빠': -1, '나빴': -1, '지루': -1, '슬프': -1, '슬퍼': -1, '슬펐': -1, '슬픔': -1, '눈물': -1,
    '실망': -1, '아깝': -1, '별로': -1, '재미없': -1, '싫': -1, '뻔': -1, '어렵': -1, '어려': -1, '졸리': -1,
    '졸려': -1, '힘들': -1, '괴롭': -1, '괴로': -1, '배고': -1, '춥': -1, '추운': -1, '추워': -1, '추웠': -1,
    '울었': -1, '울음': -1, '가난': -1, '걱정': -1, '무섭': -1, '무서': -1, '억울': -1, '우울': -1, '피해': -1,
    '질투': -1, '욕심': -1, '쫓겨': -1, '쫓아': -1, '혼나': -1, '혼내': -1, '잃': -1, '비추': -1, '어색': -1,
    '최악': -2,
  };
  // 사전을 보여 줄 때 쓰는 대표형 (어간 → 보기 좋은 단어)
  SA.SHOW = { '좋': '좋다', '재미': '재미', '재미있': '재미있다', '아름답': '아름답다', '따뜻': '따뜻하다', '지루': '지루하다', '아깝': '아깝다', '뻔': '뻔하다', '실망': '실망', '눈물': '눈물', '감동': '감동', '최고': '최고', '최악': '최악', '추천': '추천', '행복': '행복', '슬프': '슬프다', '힘들': '힘들다', '재미없': '재미없다', '어렵': '어렵다', '잘하': '잘하다' };
  SA.NEG_BEFORE = ['안', '못'];                                  // 앞에 오는 부정어: 안 좋다, 못 읽겠다
  SA.NEG_AFTER = ['않', '못하', '못했', '못한', '못해', '아니', '없'];  // 뒤에 오는 부정어: 좋지 않다, 재미가 없다
  SA.BOOST = { '정말': 1.5, '너무': 1.5, '아주': 1.5, '매우': 1.5, '진짜': 1.5, '엄청': 1.5, '무척': 1.5, '참': 1.5, '조금': 0.5, '약간': 0.5, '좀': 0.5, '다소': 0.5 };
  SA.CONTRAST = ['하지만', '그러나', '그런데', '근데'];           // 이 낱말이나 ‘~지만’ 앞은 0.5배, 뒤는 1.5배
  SA.RULES = { neg: true, boost: true, contrast: true };

  var clean = function (w) { return w.replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9]+$/g, ''); };
  // 어절 앞부분과 가장 길게 맞는 사전 단어
  SA.match = function (word, lex) {
    var best = null;
    for (var k in lex) if (word.indexOf(k) === 0 && (!best || k.length > best.length)) best = k;
    return best;
  };
  // 문장 하나의 점수. rules: { neg, boost, contrast }, extra: 사용자가 더한 사전 { 단어: 점수 }
  SA.score = function (text, rules, extra) {
    rules = rules || SA.RULES;
    var lex = SA.LEXICON;
    if (extra) { lex = {}; for (var a in SA.LEXICON) lex[a] = SA.LEXICON[a]; for (var b in extra) lex[b] = extra[b]; }
    var toks = String(text).split(/\s+/).map(function (raw) { return { raw: raw, w: clean(raw) }; }).filter(function (t) { return t.w; });
    // 대조 표시: 마지막 ‘하지만’류 낱말 또는 ‘~지만’으로 끝나는 어절
    var ci = -1, ciWord = false;
    toks.forEach(function (t, i) {
      if (SA.CONTRAST.indexOf(t.w) >= 0) { ci = i; ciWord = true; }
      else if (t.w.length > 2 && /지만$/.test(t.w)) { ci = i; ciWord = false; }
    });
    var total = 0;
    var words = toks.map(function (t, i) {
      var key = SA.match(t.w, lex), out = { raw: t.raw, w: t.w, key: key, base: 0, mult: 1, notes: [], score: 0 };
      if (!key) return out;
      out.base = lex[key];
      var m = 1;
      // 앞의 두 어절까지 살핌 (사이에 다른 감정 단어가 있으면 멈춤)
      for (var j = i - 1; j >= Math.max(0, i - 2); j--) {
        var p = toks[j].w;
        if (rules.neg && SA.NEG_BEFORE.indexOf(p) >= 0) { m *= -1; out.notes.push({ kind: 'neg', by: p, x: -1 }); }
        else if (rules.boost && SA.BOOST[p] != null) { m *= SA.BOOST[p]; out.notes.push({ kind: 'boost', by: p, x: SA.BOOST[p] }); }
        else if (SA.match(p, lex)) break;
      }
      var next = toks[i + 1] && toks[i + 1].w;
      if (rules.neg && next && SA.NEG_AFTER.some(function (n) { return next.indexOf(n) === 0; })) { m *= -1; out.notes.push({ kind: 'neg', by: next, x: -1 }); }
      if (rules.contrast && ci >= 0) {
        if (i < ci || (i === ci && !ciWord)) { m *= 0.5; out.notes.push({ kind: 'contrast', by: toks[ci].w, x: 0.5 }); }
        else if (i > ci) { m *= 1.5; out.notes.push({ kind: 'contrast', by: toks[ci].w, x: 1.5 }); }
      }
      out.mult = m; out.score = out.base * m; total += out.score;
      return out;
    });
    total = Math.round(total * 1e6) / 1e6;
    return { text: String(text), words: words, total: total, label: SA.label(total) };
  };
  SA.label = function (x) { return x > 1e-9 ? 'pos' : x < -1e-9 ? 'neg' : 'neu'; };
  SA.LABEL_KO = { pos: '긍정', neg: '부정', neu: '중립' };
  SA.fmt = function (x, k) { var s = (Math.abs(x) < 5e-10 ? 0 : x).toFixed(k == null ? 1 : k); return (x > 5e-10 ? '+' : '') + s.replace('-', '−'); };

  /* ---------- 2. 나이브 베이즈 ---------- */
  // 낱말 원형 → 어절 앞부분들. 어절이 이 앞부분으로 시작하면 그 원형으로 봅니다(조사·어미는 버림).
  SA.STEMS = {
    '결말': ['결말'], '눈물': ['눈물'], '문장': ['문장'], '아름답다': ['아름답', '아름다'], '꿀잼': ['꿀잼'], '밤새': ['밤새'],
    '읽다': ['읽'], '인물': ['인물'], '이야기': ['이야기'], '따뜻하다': ['따뜻'], '책': ['책'], '최고': ['최고'], '추천': ['추천'],
    '감동': ['감동'], '술술': ['술술'], '마음': ['마음'], '몰입': ['몰입'], '번역': ['번역'], '매끄럽다': ['매끄럽', '매끄러'],
    '재미있다': ['재미있', '재밌'], '마지막': ['마지막'], '울다': ['울었', '울음', '울고'], '인생책': ['인생책'], '다음': ['다음'],
    '지루하다': ['지루'], '없다': ['없'], '끝': ['끝'], '힘들다': ['힘들'], '노잼': ['노잼'], '시간': ['시간'], '아깝다': ['아깝'],
    '뻔하다': ['뻔'], '어색하다': ['어색'], '기대': ['기대'], '실망': ['실망'], '납작하다': ['납작'], '돈': ['돈'], '비추': ['비추'],
    '재미없다': ['재미없'], '중간': ['중간'], '덮다': ['덮'], '어렵다': ['어렵', '어려'], '졸리다': ['졸리', '졸려'], '최악': ['최악'],
    '광고': ['광고'], '요란하다': ['요란'], '별로': ['별로'], '않다': ['않'], '하루': ['하루'],
  };
  var STEM_LIST = [];
  for (var lem in SA.STEMS) SA.STEMS[lem].forEach(function (p) { STEM_LIST.push([p, lem]); });
  STEM_LIST.sort(function (a, b) { return b[0].length - a[0].length; });
  // 글 → 낱말 원형 목록 (가장 길게 맞는 앞부분)
  SA.lemmas = function (text) {
    var out = [];
    String(text).split(/\s+/).map(clean).filter(Boolean).forEach(function (w) {
      for (var k = 0; k < STEM_LIST.length; k++) if (w.indexOf(STEM_LIST[k][0]) === 0) { out.push(STEM_LIST[k][1]); return; }
    });
    return out;
  };

  // 학습 데이터: 사람이 긍정(+)/부정(−)을 표시한 서평
  SA.TRAIN = [
    ['+', '문장이 아름답고 결말에서 눈물이 났다'],
    ['+', '꿀잼. 밤새 읽었다'],
    ['+', '인물이 살아 있고 이야기가 따뜻하다'],
    ['+', '올해 읽은 책 중 최고. 강력 추천'],
    ['+', '눈물 없이 읽을 수 없는 감동'],
    ['+', '술술 읽힌다. 추천합니다'],
    ['+', '따뜻한 이야기에 마음이 녹았다'],
    ['+', '몰입감 최고, 꿀잼'],
    ['+', '번역이 매끄럽고 재미있다'],
    ['+', '마지막 장에서 펑펑 울었다. 인생책'],
    ['+', '재미있다. 다음 권도 읽겠다'],
    ['+', '지루할 틈이 없다'],
    ['-', '지루하다. 끝까지 읽기 힘들었다'],
    ['-', '노잼. 시간이 아깝다'],
    ['-', '결말이 뻔하다'],
    ['-', '번역이 어색해서 읽기 힘들다'],
    ['-', '기대했는데 실망했다'],
    ['-', '인물이 납작하고 이야기가 지루하다'],
    ['-', '돈이 아깝다. 비추'],
    ['-', '재미없다. 중간에 덮었다'],
    ['-', '문장이 어렵고 졸리다'],
    ['-', '최악의 결말'],
    ['-', '광고만 요란하고 별로다'],
    ['-', '재미있지 않다. 추천하지 않는다'],
  ];
  // 시험 데이터: 학습에 쓰지 않은 서평
  SA.TEST = [
    ['+', '꿀잼! 하루 만에 다 읽었다'],
    ['+', '읽는 내내 눈물이 났다'],
    ['+', '따뜻하고 아름다운 이야기'],
    ['+', '번역도 매끄럽고 정말 재미있다'],
    ['-', '노잼. 돈이 아깝다'],
    ['-', '문장은 아름답지만 이야기는 지루하다'],
    ['-', '추천하지 않는다'],
    ['-', '뻔한 결말에 실망했다'],
  ];

  /* 다항 나이브 베이즈 (scikit-learn MultinomialNB(alpha=1)과 같은 계산)
   *   P(낱말|긍정) = (긍정 서평에서 그 낱말 수 + 1) / (긍정 서평의 낱말 수 + 어휘 수)
   *   낱말의 무게 = ln P(낱말|긍정) − ln P(낱말|부정)
   *   서평의 점수(로그 오즈) = ln P(긍정)/P(부정) + 서평 속 낱말 무게의 합. 0보다 크면 긍정
   */
  SA.trainNB = function (rows, alpha) {
    alpha = alpha == null ? 1 : alpha;
    // 낱말이 하나도 없는 서평도 클래스 수(사전 확률)에는 들어감 — scikit-learn과 같게
    var docs = rows.map(function (r) { return { y: r[0], lem: SA.lemmas(r[1]), text: r[1] }; });
    var vocab = [], index = {}, cnt = { '+': {}, '-': {} }, tot = { '+': 0, '-': 0 }, nd = { '+': 0, '-': 0 };
    docs.forEach(function (d) {
      nd[d.y]++;
      d.lem.forEach(function (w) { if (!(w in index)) { index[w] = vocab.length; vocab.push(w); } cnt[d.y][w] = (cnt[d.y][w] || 0) + 1; tot[d.y]++; });
    });
    var V = vocab.length;
    var lp = function (y, w) { return Math.log(((cnt[y][w] || 0) + alpha) / (tot[y] + alpha * V)); };
    var M = { docs: docs, vocab: vocab, index: index, cnt: cnt, tot: tot, nd: nd, V: V, alpha: alpha,
      prior: nd['+'] && nd['-'] ? Math.log(nd['+'] / nd['-']) : 0 };
    M.weight = function (w) { return w in index ? lp('+', w) - lp('-', w) : 0; };
    M.weights = vocab.map(function (w) { return { w: w, x: M.weight(w), pos: cnt['+'][w] || 0, neg: cnt['-'][w] || 0 }; });
    M.predict = function (text) {
      var lem = SA.lemmas(text), seen = [], unknown = [];
      lem.forEach(function (w) { if (w in index) seen.push({ w: w, x: M.weight(w) }); else unknown.push(w); });
      var logit = M.prior + seen.reduce(function (s, o) { return s + o.x; }, 0);
      return { text: text, lemmas: lem, parts: seen, unknown: unknown, logit: logit, prob: 1 / (1 + Math.exp(-logit)), label: logit > 0 ? 'pos' : 'neg' };
    };
    return M;
  };
  SA.NB = SA.trainNB(SA.TRAIN);

  // 시험 데이터로 두 방법 평가 (사전 방법의 ‘중립’은 틀린 것으로 셈)
  SA.evaluate = function (test, nb, rules, extra) {
    var rows = test.map(function (r) {
      var truth = r[0] === '+' ? 'pos' : 'neg', lx = SA.score(r[1], rules, extra), p = nb.predict(r[1]);
      return { y: truth, text: r[1], lex: lx, nb: p, lexOk: lx.label === truth, nbOk: p.label === truth };
    });
    var cm = { tp: 0, fn: 0, fp: 0, tn: 0 };   // 나이브 베이즈 혼동 행렬 (긍정을 ‘양성’으로)
    rows.forEach(function (r) { if (r.y === 'pos') r.nb.label === 'pos' ? cm.tp++ : cm.fn++; else r.nb.label === 'pos' ? cm.fp++ : cm.tn++; });
    return { rows: rows, lexAcc: rows.filter(function (r) { return r.lexOk; }).length, nbAcc: rows.filter(function (r) { return r.nbOk; }).length, n: rows.length, cm: cm };
  };
  SA.EVAL = SA.evaluate(SA.TEST, SA.NB);

  /* ---------- 3. 감정 곡선 ---------- */
  SA.STORY = [
    '흥부네 식구는 가난해서 늘 배고팠다.',
    '욕심 많은 형 놀부는 흥부네를 집에서 쫓아냈다.',
    '흥부네는 추운 겨울을 힘들게 보냈다.',
    '어느 봄날 흥부는 다리가 부러진 제비를 정성껏 고쳐 주었다.',
    '제비는 고마워하며 박씨 하나를 물어 왔다.',
    '박을 타자 보물이 쏟아져 흥부네 가족은 정말 기뻤다.',
    '흥부는 부자가 되어 행복하게 살았다.',
    '소식을 들은 놀부는 질투가 나서 괴로웠다.',
    '놀부는 일부러 제비 다리를 부러뜨려 고쳐 주었다.',
    '놀부의 박에서는 무서운 도깨비가 나와 놀부를 혼내 주었다.',
    '놀부는 재산을 모두 잃고 슬프게 울었다.',
    '흥부는 형을 따뜻하게 맞아 주었다.',
    '놀부는 잘못을 뉘우치고 흥부에게 고마워했다.',
    '두 형제는 사이좋게 오래오래 행복하게 살았다.',
  ];
  // 영상의 곡선 위에 붙일 장면 이름 (문장 번호, 0부터)
  SA.STORY_MARKS = [[0, '가난'], [6, '부자'], [10, '놀부의 벌'], [13, '화해']];
  // 가운데 이동 평균 (창 크기 k, 끝에서는 있는 것만 평균)
  SA.movingAverage = function (xs, k) {
    var h = Math.floor(k / 2);
    return xs.map(function (x, i) {
      var s = 0, n = 0;
      for (var j = i - h; j <= i + h; j++) if (j >= 0 && j < xs.length) { s += xs[j]; n++; }
      return s / n;
    });
  };
  SA.arc = function (sentences, k, rules, extra) {
    var sc = sentences.map(function (s) { return SA.score(s, rules, extra).total; });
    return { scores: sc, smooth: SA.movingAverage(sc, k || 3) };
  };
  SA.ARC = SA.arc(SA.STORY, 3);
  // 글을 문장으로 나누기 (줄바꿈 또는 . ! ? 뒤)
  SA.sentences = function (text) {
    return String(text).split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean)
      .reduce(function (out, l) { return out.concat(l.replace(/([.!?])\s+/g, '$1\n').split('\n').map(function (s) { return s.trim(); }).filter(Boolean)); }, []);
  };
})();
