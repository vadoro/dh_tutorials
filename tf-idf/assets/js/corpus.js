/* TF-IDF 튜토리얼 — 예시 문서와 진짜 계산
 *
 * 영상, 직접 해 보기, 놀이터, 퀴즈가 모두 이 파일의 함수로 계산합니다.
 * 같은 문서를 examples/classics.tsv에도 두었고, examples/tfidf_classics.py가 같은 값을 다시 계산합니다.
 *
 * 문서 표기: 줄거리 문장 안에서 [대괄호]로 묶은 낱말이 명사입니다.
 *   형태소 분석기가 명사를 골라 준 결과를 손으로 흉내 낸 것이에요. 수 관형사·의존 명사(석, 짝 등)는 뺐습니다.
 */
(function () {
  'use strict';
  var TI = (window.TI = window.TI || {});

  // 색은 문서를 구별하는 보조 수단입니다. 화면에는 언제나 제목을 함께 씁니다.
  // dark: 늘 어두운 영상 무대용, light: 밝은 페이지용 (dataviz 기본 팔레트의 같은 색상 단계)
  var RAW = [
    { id: 'chunhyang', title: '춘향전', dark: '#d55181', light: '#c4407a',
      marked: '[광한루]에서 [그네]를 타던 [춘향]과 [몽룡]이 [사랑]에 빠진다. [몽룡]이 [한양]으로 떠나며 [이별]하고, 새로 온 [사또]가 [춘향]에게 [수청]을 들라 하지만 [춘향]은 [사랑]을 지키다 [옥]에 갇힌다. [암행어사]가 되어 돌아온 [몽룡]이 [사또]를 몰아내고 [춘향]과 다시 만나는 [이야기].' },
    { id: 'unyeong', title: '운영전', dark: '#3987e5', light: '#2a6fc4',
      marked: '[안평대군]의 [궁녀] [운영]은 [궁]에 찾아온 [김진사]와 [사랑]에 빠진다. 둘은 몰래 [편지]를 주고받으며 [사랑]을 키우지만, [대군]에게 둘의 [사랑]이 알려져 [이별]하게 되자 [운영]은 스스로 [목숨]을 끊고 [김진사]도 뒤따르는 [이야기].' },
    { id: 'simcheong', title: '심청전', dark: '#d95926', light: '#c4501f',
      marked: '눈먼 [아버지] [심봉사]를 모시던 [효녀] [심청]은 [아버지]의 [눈]을 뜨게 하려고 [공양미] 삼백 석에 [몸]을 팔아 [인당수]에 빠진다. [연꽃]을 타고 살아 돌아와 [왕비]가 된 [심청]이 [맹인] [잔치]를 열어 [아버지]를 다시 만나자 [아버지]가 [눈]을 뜨는 [이야기].' },
    { id: 'janghwa', title: '장화홍련전', dark: '#199e70', light: '#13845d',
      marked: '[어머니]를 잃은 [장화]와 [홍련] [자매]는 [계모]의 [구박]을 받으며 자란다. [계모]의 [모함]으로 [장화]가 죽고 [홍련]도 뒤따르자, [원귀]가 된 [자매]는 [부사]를 찾아가 [원한]을 털어놓는다. [부사]가 [진실]을 밝혀 [계모]가 [벌]을 받고, [자매]는 [아버지]의 [딸]로 다시 태어나는 [이야기].' },
    { id: 'kongjwi', title: '콩쥐팥쥐전', dark: '#9085e9', light: '#5a4bc0',
      marked: '[어머니]를 잃은 [콩쥐]는 [계모]와 [팥쥐]에게 [구박]을 받는다. [두꺼비]와 [참새]가 [일]을 도와주어 [잔치]에 간 [콩쥐]는 [꽃신]을 잃어버리고, [꽃신]의 [주인]을 찾던 [원님]과 [혼인]한다. 못된 [계모]와 [팥쥐]가 [벌]을 받는 [이야기].' },
    { id: 'heungbu', title: '흥부전', dark: '#c98500', light: '#9a6600',
      marked: '착한 [동생] [흥부]가 다친 [제비]의 [다리]를 고쳐 주자, [제비]가 물어 온 [박씨]에서 자란 [박]에서 [보물]이 쏟아진다. [욕심] 많은 [형] [놀부]는 일부러 [제비]의 [다리]를 부러뜨렸다가 [박]에서 나온 [도깨비]에게 [벌]을 받는 [이야기].' },
  ];

  // [대괄호] 표기 → 보통 문장, 명사 목록, 명사의 글자 위치
  TI.parse = function (marked) {
    var text = '', tokens = [], spans = [], start = -1;
    for (var i = 0; i < marked.length; i++) {
      var ch = marked[i];
      if (ch === '[') start = text.length;
      else if (ch === ']') { var w = text.slice(start, text.length); tokens.push(w); spans.push({ start: start, end: text.length, word: w }); start = -1; }
      else text += ch;
    }
    return { text: text, tokens: tokens, spans: spans };
  };
  TI.DOCS = RAW.map(function (d) {
    var p = TI.parse(d.marked);
    return { id: d.id, title: d.title, dark: d.dark, light: d.light, marked: d.marked, text: p.text, tokens: p.tokens, spans: p.spans };
  });

  // IDF 공식
  //   classic : ln(N / df)                  교과서 공식. 모든 문서에 나오는 단어는 0
  //   smooth  : ln((1 + N) / (1 + df)) + 1  scikit-learn TfidfVectorizer 기본값 (smooth_idf=True)
  //   plain   : ln(N / df) + 1              scikit-learn smooth_idf=False
  TI.IDF = {
    classic: function (N, df) { return Math.log(N / df); },
    smooth: function (N, df) { return Math.log((1 + N) / (1 + df)) + 1; },
    plain: function (N, df) { return Math.log(N / df) + 1; },
  };
  TI.dot = function (a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  TI.norm = function (a) { return Math.sqrt(TI.dot(a, a)); };
  TI.unit = function (a) { var n = TI.norm(a); return a.map(function (x) { return n ? x / n : 0; }); };
  TI.cosine = function (a, b) { var na = TI.norm(a), nb = TI.norm(b); return na && nb ? TI.dot(a, b) / (na * nb) : 0; };
  TI.euclid = function (a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]); return Math.sqrt(s); };

  /* 문서 목록 [{ title, tokens }] → TF-IDF 모형
   *   tf[d][v]  : 문서 d에서 단어 v가 나온 횟수 (scikit-learn처럼 그대로 센 값)
   *   df[v], idf[v]
   *   w[d][v]   : TF × IDF (정규화 전)
   *   u[d][v]   : 길이를 1로 맞춘 벡터 (L2 정규화)
   *   cos[i][j] : 코사인 유사도 (정규화 여부와 상관없이 같음)
   *   dist[i][j]: 유클리드 거리 (opt.norm이 true면 정규화한 벡터로, 아니면 정규화 전 벡터로)
   */
  TI.model = function (docs, opt) {
    opt = opt || {};
    var kind = opt.idf || 'classic', norm = opt.norm !== false;
    var vocab = [], index = {};
    docs.forEach(function (d) { d.tokens.forEach(function (t) { if (!(t in index)) { index[t] = vocab.length; vocab.push(t); } }); });
    var N = docs.length, V = vocab.length;
    var zeros = function () { var a = []; for (var i = 0; i < V; i++) a.push(0); return a; };
    var tf = docs.map(function (d) { var a = zeros(); d.tokens.forEach(function (t) { a[index[t]]++; }); return a; });
    var df = vocab.map(function (w, v) { return tf.filter(function (row) { return row[v] > 0; }).length; });
    var idf = df.map(function (n) { return TI.IDF[kind](N, n); });
    var w = tf.map(function (row) { return row.map(function (c, v) { return c * idf[v]; }); });
    var u = w.map(TI.unit);
    var vec = norm ? u : w;
    var M = {
      docs: docs, vocab: vocab, index: index, N: N, V: V, kind: kind, norm: norm,
      tf: tf, df: df, idf: idf, w: w, u: u, len: w.map(TI.norm),
      cos: docs.map(function (a, i) { return docs.map(function (b, j) { return i === j && TI.norm(w[i]) ? 1 : TI.cosine(w[i], w[j]); }); }),
      dist: docs.map(function (a, i) { return docs.map(function (b, j) { return TI.euclid(vec[i], vec[j]); }); }),
    };
    // 문서 d에서 점수가 높은 단어 k개. 점수가 같으면 그 문서에서 먼저 나온 단어가 앞
    M.top = function (d, k, by) {
      var score = by === 'tf' ? tf[d] : w[d], seen = {}, list = [];
      docs[d].tokens.forEach(function (t) { if (!seen[t]) { seen[t] = 1; list.push(index[t]); } });
      list.sort(function (a, b) { return score[b] - score[a]; });
      return list.slice(0, k == null ? list.length : k);
    };
    // 학습한 IDF로 새 문서를 벡터로 (모르는 단어는 버림 — scikit-learn의 transform과 같음)
    M.transform = function (tokens) {
      var a = zeros();
      tokens.forEach(function (t) { if (t in index) a[index[t]]++; });
      return a.map(function (c, v) { return c * idf[v]; });
    };
    // 두 문서가 함께 가진 단어와 코사인 유사도에 보탠 몫 (큰 순서)
    M.shared = function (i, j) {
      var out = [];
      for (var v = 0; v < V; v++) if (tf[i][v] && tf[j][v]) out.push({ v: v, word: vocab[v], part: u[i][v] * u[j][v] });
      return out.sort(function (a, b) { return b.part - a.part; });
    };
    return M;
  };

  // 기본 모형: 교과서 IDF, L2 정규화
  TI.M = TI.model(TI.DOCS, { idf: 'classic', norm: true });
  TI.fmt = function (x, k) { return (Math.abs(x) < 5e-10 ? 0 : x).toFixed(k == null ? 2 : k); };
})();
