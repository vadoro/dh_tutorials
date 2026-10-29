/* 감정분석 튜토리얼 — 영상 장면
 *
 * SV.render(g, t)는 시각 t와 사용자 상태 SV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 * 점수와 정확도는 모두 sentiment.js의 진짜 계산값이고, 자막 속 숫자와 다르면 콘솔에 경고를 냅니다.
 */
(function () {
  'use strict';
  const SA = window.SA;
  const SV = (window.SV = {});
  const W = 1280, H = 720;
  SV.W = W; SV.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const sf = (x, k = 1) => SA.fmt(x, k);                     // +1.5 / −1.0 / 0.0
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  SV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#13131A', grid: 'rgba(238,237,242,0.045)', text: '#EEEDF2', soft: '#C9C8D3', muted: '#9897A6', dim: '#5F5E6D',
    faint: 'rgba(238,237,242,0.14)', line: 'rgba(238,237,242,0.32)', panel: '#1C1B25', panel2: '#252433',
    accent: '#C9A7FF', pos: '#4A90E8', neg: '#E66767', neu: '#8E8D9A', ok: '#7BE0A6', no: '#FF8E8E',
  };
  SV.COL = COL;
  const polCol = x => x > 1e-9 ? COL.pos : x < -1e-9 ? COL.neg : COL.neu;

  // 사용자 상태 ('직접 해 보기'와 화면 누르기로 바뀜). 영상 추출은 언제나 기본값
  const S = (SV.S = { rules: { neg: true, boost: true, contrast: true }, extra: null, card: null, word: null, test: null, sent: null, win: 3 });
  let HITS = [];
  SV.hits = () => HITS;
  const score = t => SA.score(t, S.rules, S.extra);

  let REC = null;
  function txt(g, s, x, y, o = {}) {
    s = String(s);
    if (REC) REC.add(s);
    g.font = fnt(o.size || 18, o.weight || 400, o.fam || FB);
    g.fillStyle = o.color || COL.text; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'middle';
    g.fillText(s, x, y);
    return g.measureText(s).width;
  }
  const tw = (g, s, size, weight = 400, fam = FB) => { g.font = fnt(size, weight, fam); return g.measureText(String(s)).width; };
  function rr(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
  function fade(g, a, fn) { if (a <= 0.001) return; g.save(); g.globalAlpha *= Math.min(1, a); fn(); g.restore(); }
  function panelBox(g, x, y, w, h, fill = COL.panel) { rr(g, x, y, w, h, 12); g.fillStyle = fill; g.fill(); }
  function arrow(g, x0, y0, x1, y1, color, lw = 2, head = 10) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(ang) * head * 0.7, y1 - Math.sin(ang) * head * 0.7); g.stroke();
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - Math.cos(ang - 0.42) * head, y1 - Math.sin(ang - 0.42) * head); g.lineTo(x1 - Math.cos(ang + 0.42) * head, y1 - Math.sin(ang + 0.42) * head); g.closePath(); g.fill();
  }
  function mark(g, ok, x, y, s = 10) {                          // 맞음(체크) / 틀림(가위표)
    g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = ok ? COL.ok : COL.no; g.beginPath();
    if (ok) { g.moveTo(x - s * 0.6, y); g.lineTo(x - s * 0.15, y + s * 0.5); g.lineTo(x + s * 0.7, y - s * 0.55); }
    else { g.moveTo(x - s * 0.55, y - s * 0.55); g.lineTo(x + s * 0.55, y + s * 0.55); g.moveTo(x + s * 0.55, y - s * 0.55); g.lineTo(x - s * 0.55, y + s * 0.55); }
    g.stroke();
  }
  function wrap(g, s, maxW, size, weight = 400) {
    g.font = fnt(size, weight);
    const words = String(s).split(' '), lines = [];
    let line = '';
    words.forEach(w => { const t = line ? line + ' ' + w : w; if (line && g.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    return lines;
  }
  // 점수 막대: 가운데에서 왼쪽(부정) 또는 오른쪽(긍정)으로
  function polBar(g, cx, y, value, unit, p = 1, label = true, h = 14) {
    const len = value * unit * p;
    g.strokeStyle = COL.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, y - h); g.lineTo(cx, y + h); g.stroke();
    if (Math.abs(len) > 0.5) { rr(g, len > 0 ? cx : cx + len, y - h / 2, Math.abs(len), h, 4); g.fillStyle = polCol(value); g.fill(); }
    if (label && p > 0.6) fade(g, (p - 0.6) / 0.4, () => txt(g, sf(value), cx + len + (value >= 0 ? 10 : -10), y + 1, { size: 15, weight: 600, fam: FM, color: COL.soft, align: value >= 0 ? 'left' : 'right' }));
  }
  // 문장을 어절 칩으로: 사전 단어는 점수 꼬리표, 규칙은 아래 메모
  function drawTokens(g, res, x, y, o = {}) {
    const size = o.size || 26, gap = tw(g, ' ', size), show = o.show || (() => 1), pos = [];
    let cx = x;
    res.words.forEach((w, i) => {
      const ww = tw(g, w.raw, size, 500), a = show(i, w);
      pos.push({ x: cx, w: ww, cx: cx + ww / 2 });
      if (w.key && a > 0) fade(g, a, () => {
        rr(g, cx - 6, y - size * 0.75, ww + 12, size * 1.5, 8); g.fillStyle = w.score > 0 ? 'rgba(74,144,232,0.16)' : w.score < 0 ? 'rgba(230,103,103,0.16)' : 'rgba(142,141,154,0.16)'; g.fill();
        g.strokeStyle = polCol(o.final === false ? w.base : w.score); g.lineWidth = 2; g.stroke();
        const tag = o.final === false ? sf(w.base, 0) : sf(w.score);
        const tagW = tw(g, tag, 15, 600, FM) + 14;
        rr(g, cx + ww / 2 - tagW / 2, y - size * 0.75 - 30, tagW, 24, 6); g.fillStyle = polCol(o.final === false ? w.base : w.score); g.fill();
        txt(g, tag, cx + ww / 2, y - size * 0.75 - 17, { size: 15, weight: 600, fam: FM, color: '#0F0F14', align: 'center' });
        if (o.notes !== false && o.final !== false && w.notes.length) txt(g, w.notes.map(n => (n.kind === 'neg' ? '부정 ' : n.kind === 'boost' ? '강조 ' : '대조 ') + '×' + (n.x === -1 ? '(−1)' : n.x)).join(' '), cx + ww / 2, y + size * 0.75 + 18, { size: 14, weight: 600, color: COL.accent, align: 'center' });
      });
      if (!w.key && o.zeros && a > 0) fade(g, a * o.zeros, () => txt(g, '0', cx + ww / 2, y - size * 0.75 - 17, { size: 15, fam: FM, color: COL.dim, align: 'center' }));
      txt(g, w.raw, cx, y, { size, weight: 500, color: w.key ? COL.text : COL.soft });
      cx += ww + gap;
    });
    return pos;
  }
  function verdict(g, x, y, total, o = {}) {
    const lab = SA.LABEL_KO[SA.label(total)];
    const w1 = txt(g, `합 ${sf(total)}`, x, y, { size: o.size || 24, weight: 700, fam: FM, color: COL.text });
    const bw = tw(g, lab, (o.size || 24) - 4, 700) + 24;
    rr(g, x + w1 + 14, y - 17, bw, 34, 17); g.fillStyle = polCol(total); g.fill();
    txt(g, lab, x + w1 + 14 + bw / 2, y + 1, { size: (o.size || 24) - 4, weight: 700, color: '#0F0F14', align: 'center' });
    return w1 + 14 + bw;
  }

  /* ---------- 장면 정의 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '글에 담긴 마음', t: 0 },
    { id: 'what', n: '01', title: '감정분석이란', sub: '긍정 · 부정 · 중립', t: 20 },
    { id: 'lexicon', n: '02', title: '감성 사전', sub: '단어마다 점수', t: 46 },
    { id: 'rules', n: '03', title: '규칙 더하기', sub: '부정 · 강조 · 대조', t: 84 },
    { id: 'limits', n: '04', title: '사전의 한계', sub: '새말 · 분야 · 비꼼', t: 128 },
    { id: 'learn', n: '05', title: '데이터로 배우기', sub: '나이브 베이즈', t: 156 },
    { id: 'eval', n: '06', title: '예측과 평가', sub: '시험 데이터와 정확도', t: 196 },
    { id: 'models', n: '07', title: '문맥을 읽는 모델', sub: '언어 모델', t: 236 },
    { id: 'arc', n: '08', title: '감정 곡선', sub: '흥부전의 굴곡', t: 262 },
    { id: 'outro', n: '09', title: '정리', sub: '파이썬으로 해 보기', t: 304 },
  ];
  const END = 326;
  const CAPTIONS = [
    [0.6, 5.6, '책 서평, 일기, 편지, 소설… 글에는 쓴 사람의 마음이 담겨 있어요.'],
    [5.6, 11, '**감정분석**(sentiment analysis)은 글에 담긴 감정이 긍정인지 부정인지, 얼마나 강한지 숫자로 재는 방법이에요.'],
    [11, 16, '서평 수천 개의 반응을 한눈에 보거나, 소설 속 감정의 흐름을 그릴 수 있어요.'],
    [16, 20, '오늘은 **사전**, **규칙**, **기계학습**을 차례로 살펴봐요.'],

    [20.4, 26, '감정분석은 보통 글을 **긍정**, **부정**, **중립**으로 나누거나, −1에서 +1 사이의 점수를 매겨요.'],
    [26, 32, '기쁨, 슬픔, 분노, 두려움처럼 감정의 **종류**를 나누기도 하지만, 오늘은 긍정과 부정을 다뤄요.'],
    [32, 39, '무엇을 단위로 볼지도 정해야 해요. 문장 하나일 수도, 서평 한 편이나 소설 한 장일 수도 있어요.'],
    [39, 46, '컴퓨터가 감정을 ‘느끼는’ 건 아니에요. 글 속 단서를 세어 마음을 **추정**하는 거예요.'],

    [46.4, 52, '가장 쉬운 방법은 **감성 사전**이에요. 단어마다 미리 감정 점수를 매겨 둔 목록이죠.'],
    [52, 58, '‘최고’는 +2, ‘좋다’는 +1, ‘지루하다’는 −1, ‘최악’은 −2. 한국어로는 KNU 한국어 감성사전이 널리 쓰여요.'],
    [58, 65, '문장에서 사전에 있는 단어를 찾아 점수를 모두 더해요.'],
    [65, 72, '‘문장이 아름답고 결말이 감동적이다’는 +1과 +2를 더해 +3, 긍정이에요.'],
    [72, 78, '사전에 없는 단어는 0점이에요. ‘결말’, ‘문장’ 같은 단어에는 감정이 없다고 보는 거죠.'],
    [78, 84, '합이 0보다 크면 긍정, 작으면 부정, 0이면 중립으로 나눠요.'],

    [84.4, 90, '그런데 단어만 더하면 틀리는 문장이 있어요. ‘추천하지 않는다’는 +1점이 나와요.'],
    [90, 97, '그래서 **규칙**을 더해요. ‘않다’, ‘안’, ‘못’ 같은 **부정어**가 붙으면 점수를 뒤집어요.'],
    [97, 104, '‘정말’, ‘너무’ 같은 **강조어**는 점수를 1.5배로, ‘조금’, ‘약간’은 절반으로 줄여요.'],
    [104, 112, '‘하지만’이나 ‘~지만’ 뒤의 말이 진짜 하고 싶은 말인 경우가 많아요. 그래서 앞은 0.5배, 뒤는 1.5배로 계산해요.'],
    [112, 120, '‘문장은 아름답지만 이야기는 지루하다’는 +0.5 − 1.5 = −1, 부정이 돼요.'],
    [120, 128, '영어권에서 널리 쓰는 VADER도 이런 규칙을 써요. 사전과 규칙만으로 꽤 많은 문장을 맞힐 수 있어요.'],

    [128.4, 135, '하지만 사전에도 한계가 있어요. ‘꿀잼’, ‘노잼’ 같은 새말은 사전에 없어서 0점이에요.'],
    [135, 142, '같은 단어도 분야마다 뜻이 달라요. 서평에서 ‘눈물이 났다’는 대개 칭찬이지만, 사전은 ‘눈물’을 부정으로 봐요.'],
    [142, 149, '‘참 잘하는 짓이다’ 같은 비꼬는 말은 단어만 보면 칭찬처럼 보여요.'],
    [149, 156, '그렇다면 단어의 점수를 사람이 정하지 말고, **데이터에서 배우면** 어떨까요?'],

    [156.4, 163, '**기계학습**은 사람이 긍정·부정을 표시해 둔 글(**학습 데이터**)에서 단어의 무게를 스스로 배워요.'],
    [163, 170, '여기 긍정 서평 12개와 부정 서평 12개가 있어요. 낱말마다 어느 쪽에 더 자주 나오는지 세요.'],
    [170, 177, '‘꿀잼’과 ‘추천’은 긍정 서평에, ‘아깝다’와 ‘지루하다’는 부정 서평에 더 자주 나와요.'],
    [177, 184, '‘눈물’은 긍정 서평에만 나와서 긍정 쪽 무게를 받아요. 서평이라는 분야에 맞게 배운 거죠.'],
    [184, 190, '두 확률의 비율에 로그를 씌운 값을 낱말의 **무게**로 쓰는 방법이 **나이브 베이즈**(Naive Bayes)예요.'],
    [190, 196, '한 번도 안 나온 낱말이 확률 0을 받지 않게, 모든 횟수에 1을 더해 계산해요. 이것을 **라플라스 스무딩**이라고 해요.'],

    [196.4, 203, '새 서평이 오면 그 안의 낱말 무게를 모두 더해요. 합이 0보다 크면 긍정이에요.'],
    [203, 210, '‘꿀잼! 하루 만에 다 읽었다’는 사전으로는 0점이었지만, 배운 무게로는 긍정이에요.'],
    [210, 217, '성능은 학습에 쓰지 않은 **시험 데이터**로 재요. 서평 8개 가운데 몇 개를 맞혔는지 세는 거죠.'],
    [217, 224, '감성 사전은 8개 중 6개, 나이브 베이즈는 7개를 맞혔어요. **정확도** 75%와 87.5%예요.'],
    [224, 230, '나이브 베이즈가 틀린 문장은 ‘문장은 아름답지만 이야기는 지루하다’. 단어 가방은 ‘~지만’의 순서를 모르거든요.'],
    [230, 236, '방법마다 틀리는 곳이 달라요. 그래서 결과를 직접 읽어 보며 확인하는 일이 중요해요.'],

    [236.4, 243, '요즘은 BERT 같은 **언어 모델**을 감정분석 데이터로 더 학습시켜 써요. 단어의 순서와 문맥을 함께 읽어요.'],
    [243, 250, '한국어는 네이버 영화 리뷰 20만 개(NSMC) 같은 공개 데이터로 학습한 모델이 많아요.'],
    [250, 256, '대신 왜 그렇게 판단했는지 설명하기 어렵고 계산이 무거워요. 사전과 나이브 베이즈는 근거를 바로 보여 줘요.'],
    [256, 262, '어떤 방법이든, 자료의 일부를 사람이 직접 표시해 결과와 비교해 보세요.'],

    [262.4, 269, '감정분석으로 긴 이야기의 **감정 곡선**도 그려요. 흥부전을 문장 하나씩 사전으로 점수를 매겨 볼게요.'],
    [269, 276, '가난과 추위로 낮게 시작했다가, 제비가 박씨를 물어 오면서 올라가요.'],
    [276, 283, '놀부의 이야기에서 다시 떨어지고, 두 형제가 화해하는 끝에서 높이 올라가요.'],
    [283, 290, '점수가 들쭉날쭉하니 앞뒤 문장과 평균을 내 부드럽게 만들어요. 이것을 **이동 평균**이라고 해요.'],
    [290, 297, '연구자들은 수많은 소설의 감정 곡선을 모아 이야기의 기본 모양 몇 가지를 찾기도 했어요.'],
    [297, 304, '곡선이 이야기를 대신하지는 않아요. 곡선을 길잡이 삼아 원문을 다시 읽는 거예요.'],

    [304.4, 311, '정리해 볼까요? 사전과 규칙으로 점수를 매기거나, 데이터에서 낱말의 무게를 배울 수 있어요.'],
    [311, 318, '성능은 시험 데이터로 확인하고, 틀린 문장을 직접 읽으며 방법의 한계를 살펴요.'],
    [318, 326, '아래 놀이터에서 내 문장의 점수를 매기고, 내 글의 감정 곡선도 그려 보세요.'],
  ];
  SV.CHAPTERS = CHAPTERS; SV.CAPTIONS = CAPTIONS; SV.END = END;
  SV.POSTER = 287;
  SV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  SV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 장면에 쓰는 예문
  const EX = {
    intro: [['서평', '정말 감동적인 소설이다'], ['서평', '결말이 뻔해서 실망했다'], ['일기', '오늘은 비가 와서 우울했다'], ['편지', '보내 준 책 고맙게 잘 읽었어'], ['신문', '폭우로 마을이 큰 피해를 입었다'], ['소설', '흥부네 가족은 행복하게 살았다']],
    what: ['결말이 뻔해서 실망했다', '오늘 책을 샀다', '정말 감동적인 소설이다'],
    lexicon: '문장이 아름답고 결말이 감동적이다',
    lexicon2: ['결말이 뻔해서 실망했다', '오늘 책을 샀다'],
    neg: '추천하지 않는다', boost: ['정말 재미있다', '조금 지루하다'], contrast: '문장은 아름답지만 이야기는 지루하다',
    limits: [['꿀잼! 하루 만에 다 읽었다', '긍정', '새말: 사전에 없어요'], ['읽는 내내 눈물이 났다', '긍정', '분야: 서평에서 눈물은 칭찬'], ['참 잘하는 짓이다', '부정 (비꼼)', '비꼼: 겉말과 속뜻이 달라요']],
  };
  SV.EX = EX;
  const LEX_SHOW = [['최고', 2], ['감동', 2], ['좋', 1], ['아름답', 1], ['재미있', 1], ['추천', 1], ['지루', -1], ['뻔', -1], ['실망', -1], ['눈물', -1], ['아깝', -1], ['최악', -2]];
  const LEARN_WORDS = ['꿀잼', '추천', '눈물', '아깝다', '지루하다', '않다'];
  const norm15 = x => x / Math.sqrt(x * x + 15);              // VADER처럼 −1~+1로 줄이기

  // 자막 속 숫자와 계산이 어긋나면 알려 줌
  (function verify() {
    const warn = m => console.warn('감정분석 영상: ' + m);
    const D = SA.RULES, sc = t => SA.score(t, D).total, nb = SA.NB;
    if (sc(EX.lexicon) !== 3) warn('‘문장이 아름답고…’ 점수가 +3이 아님');
    if (SA.score(EX.neg, { neg: false, boost: false, contrast: false }).total !== 1 || sc(EX.neg) !== -1) warn('‘추천하지 않는다’ 점수가 자막과 다름');
    if (sc(EX.contrast) !== -1) warn('대조 문장 점수가 −1이 아님');
    if (sc(EX.limits[0][0]) !== 0 || sc(EX.limits[1][0]) >= 0 || sc(EX.limits[2][0]) <= 0) warn('한계 예문의 사전 점수가 자막과 다름');
    const w = k => nb.weights.find(o => o.w === k) || {};
    if (nb.nd['+'] !== 12 || nb.nd['-'] !== 12) warn('학습 서평 수가 12/12가 아님');
    if (!(w('꿀잼').x > 0 && w('추천').x > 0 && w('아깝다').x < 0 && w('지루하다').x < 0)) warn('낱말 무게의 방향이 자막과 다름');
    if (!(w('눈물').pos > 0 && w('눈물').neg === 0)) warn('‘눈물’이 긍정 서평에만 나오지 않음');
    if (SA.EVAL.lexAcc !== 6 || SA.EVAL.nbAcc !== 7 || SA.EVAL.n !== 8) warn('정확도가 6/8, 7/8이 아님');
    const wrong = SA.EVAL.rows.filter(r => !r.nbOk).map(r => r.text);
    if (wrong.length !== 1 || wrong[0] !== EX.contrast) warn('나이브 베이즈가 틀린 문장이 자막과 다름');
    if (SA.score(EX.limits[0][0]).total !== 0 || nb.predict(EX.limits[0][0]).label !== 'pos') warn('‘꿀잼…’ 예측이 자막과 다름');
    const a = SA.ARC.scores, low = a.indexOf(Math.min(...a));
    if (low !== 10 || Math.max(...a.slice(0, 3)) >= 0 || a[13] !== Math.max(...a)) warn('흥부전 곡선의 모양이 자막과 다름');
  })();

  /* ---------- 공통 그림 ---------- */
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, 80, 80, { size: 15, weight: 500, fam: FM, color: COL.accent, base: 'alphabetic' });
    txt(g, ch.title, 80, 124, { size: 38, weight: 700, fam: FD, base: 'alphabetic' });
  }
  const GRID = { x: [80, 455, 830], y: [158, 366], w: 370, h: 190 };

  /* ---------- 00 들어가며 ---------- */
  function sceneIntro(g, u) {
    EX.intro.forEach(([kind, text], i) => {
      const x = GRID.x[i % 3], y = GRID.y[Math.floor(i / 3)], a = ramp(u, 0.5 + i * 0.3, 0.6), r = score(text);
      fade(g, a * (1 - 0.75 * ramp(u, 11, 0.6)), () => {
        g.save(); g.translate(0, (1 - a) * 16);
        panelBox(g, x, y, GRID.w, GRID.h);
        txt(g, kind, x + 22, y + 28, { size: 14, weight: 600, color: COL.accent });
        wrap(g, text, GRID.w - 44, 22, 500).slice(0, 2).forEach((l, k) => txt(g, l, x + 22, y + 68 + k * 32, { size: 22, weight: 500 }));
        polBar(g, x + GRID.w / 2, y + 150, r.total, 40, ramp(u, 6 + i * 0.3, 0.8));
        g.restore();
      });
      HITS.push({ x, y, w: GRID.w, h: GRID.h, kind: 'card', i });
    });
    // 쓰임새 두 가지: 서평 모음의 비율, 이야기의 감정 곡선 (진짜 자료)
    fade(g, ramp(u, 11.3, 0.6) * (1 - ramp(u, 15.6, 0.4)), () => {
      panelBox(g, 140, 220, 440, 250, COL.panel2);
      txt(g, '서평 모음의 반응', 166, 256, { size: 20, weight: 700 });
      const n = SA.NB.nd, tot = n['+'] + n['-'], bw = 388;
      rr(g, 166, 300, bw * n['+'] / tot, 40, 6); g.fillStyle = COL.pos; g.fill();
      rr(g, 166 + bw * n['+'] / tot + 3, 300, bw * n['-'] / tot - 3, 40, 6); g.fillStyle = COL.neg; g.fill();
      txt(g, `긍정 ${n['+']}`, 180, 321, { size: 17, weight: 700, color: '#0F0F14' });
      txt(g, `부정 ${n['-']}`, 166 + bw - 14, 321, { size: 17, weight: 700, color: '#0F0F14', align: 'right' });
      txt(g, `이 튜토리얼의 학습 서평 ${tot}개`, 166, 372, { size: 15, color: COL.muted });
      panelBox(g, 700, 220, 440, 250, COL.panel2);
      txt(g, '이야기의 감정 흐름', 726, 256, { size: 20, weight: 700 });
      const xs = SA.ARC.smooth, x0 = 736, x1 = 1104, yc = 360;
      g.strokeStyle = COL.line; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, yc); g.lineTo(x1, yc); g.stroke();
      g.strokeStyle = COL.accent; g.lineWidth = 3; g.beginPath();
      xs.forEach((v, i) => { const x = lerp(x0, x1, i / (xs.length - 1)), y = yc - v * 26; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      txt(g, '흥부전 (8장에서)', 726, 440, { size: 15, color: COL.muted });
    });
    // 오늘 살펴볼 방법
    fade(g, ramp(u, 16, 0.6), () => {
      g.fillStyle = 'rgba(19,19,26,0.88)'; g.fillRect(0, 140, W, H - 140);
      const items = [['감성 사전 + 규칙', '단어 점수를 더하고 고치기'], ['기계학습', '데이터에서 무게를 배우기'], ['언어 모델', '문맥을 함께 읽기']];
      items.forEach(([a, b], k) => {
        const x = 150 + k * 340, y = 300, al = ramp(u, 16.2 + k * 0.45, 0.5);
        fade(g, al, () => {
          panelBox(g, x, y, 300, 120);
          g.strokeStyle = k < 2 ? COL.accent : COL.faint; g.lineWidth = 1.5; rr(g, x, y, 300, 120, 12); g.stroke();
          txt(g, a, x + 150, y + 46, { size: 23, weight: 700, align: 'center', color: k < 2 ? COL.accent : COL.text });
          txt(g, b, x + 150, y + 84, { size: 16, color: COL.soft, align: 'center' });
        });
      });
    });
  }

  /* ---------- 01 감정분석이란 ---------- */
  function sceneWhat(g, u) {
    const x0 = 160, x1 = 1120, y = 280, xm = (x0 + x1) / 2;
    fade(g, ramp(u, 0.4, 0.6), () => {
      const grad = g.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, 'rgba(230,103,103,0.55)'); grad.addColorStop(0.5, 'rgba(142,141,154,0.35)'); grad.addColorStop(1, 'rgba(74,144,232,0.55)');
      rr(g, x0, y - 6, x1 - x0, 12, 6); g.fillStyle = grad; g.fill();
      [[-1, '−1'], [-0.5, '−0.5'], [0, '0'], [0.5, '+0.5'], [1, '+1']].forEach(([v, s]) => {
        const x = lerp(xm, v < 0 ? x0 : x1, Math.abs(v));
        g.strokeStyle = COL.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x, y + 18); g.stroke();
        txt(g, s, x, y + 32, { size: 14, fam: FM, color: COL.muted, align: 'center' });
      });
      txt(g, '부정', x0, y - 30, { size: 19, weight: 700, color: COL.neg });
      txt(g, '중립', xm + 14, y - 30, { size: 19, weight: 700, color: COL.neu });
      txt(g, '긍정', x1, y - 30, { size: 19, weight: 700, color: COL.pos, align: 'right' });
    });
    EX.what.forEach((t, k) => {
      const r = score(t), v = norm15(r.total), a = ramp(u, 1.2 + k * 0.7, 0.8), x = lerp(xm, v < 0 ? x0 : x1, Math.abs(v));
      fade(g, a, () => {
        const bw = tw(g, t, 17, 600) + 28, bx = clamp(x - bw / 2, 80, W - 80 - bw), by = 172;
        rr(g, bx, by - 18, bw, 36, 18); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = polCol(r.total); g.lineWidth = 2; g.stroke();
        txt(g, t, bx + bw / 2, by + 1, { size: 17, weight: 600, align: 'center' });
        g.strokeStyle = polCol(r.total); g.lineWidth = 2; g.beginPath(); g.moveTo(x, by + 18); g.lineTo(x, y - 8); g.stroke();
        g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fillStyle = polCol(r.total); g.fill();
        txt(g, sf(v, 2), x, y + 56, { size: 15, weight: 600, fam: FM, color: COL.soft, align: 'center' });
      });
    });
    fade(g, ramp(u, 3.5, 0.6), () => txt(g, '점수를 −1~+1로 줄이는 한 방법: 합 ÷ √(합² + 15)  (VADER의 방식)', x0, y + 92, { size: 14, color: COL.muted }));
    // 감정의 종류
    fade(g, ramp(u, 6, 0.6) * (1 - ramp(u, 11.6, 0.5)), () => {
      txt(g, '감정의 종류로 나누기 (예: 에크만의 기본 감정)', 160, 446, { size: 17, weight: 600, color: COL.soft });
      ['기쁨', '슬픔', '분노', '두려움', '놀람', '혐오'].forEach((e, k) => {
        const x = 160 + k * 160;
        rr(g, x, 476, 140, 56, 28); g.fillStyle = COL.panel2; g.fill();
        txt(g, e, x + 70, 505, { size: 21, weight: 700, align: 'center' });
      });
    });
    // 분석 단위
    fade(g, ramp(u, 12.2, 0.6) * (1 - ramp(u, 18.6, 0.5)), () => {
      txt(g, '무엇을 한 단위로 볼까?', 160, 438, { size: 17, weight: 600, color: COL.soft });
      [[['문장', '서평 한 편', '서평 모음'], 160], [['문장', '장(章)', '소설 한 권'], 660]].forEach(([lv, x]) => {
        // 바깥 상자부터 그려서 안쪽 상자가 위에 오게 함
        for (let k = lv.length - 1; k >= 0; k--) {
          const w = 160 + k * 150, h = 46 + k * 24, yy = 548 - h;
          rr(g, x, yy, w, h, 10); g.fillStyle = k === 0 ? COL.panel2 : 'rgba(255,255,255,0.03)'; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke();
          txt(g, lv[k], x + w - 12, yy + 22, { size: 16, weight: 600, align: 'right', color: k === 0 ? COL.text : COL.soft });
        }
      });
    });
    fade(g, ramp(u, 19.2, 0.6), () => {
      txt(g, '글 속 단서를 세어', 160, 470, { size: 30, weight: 700, fam: FD });
      txt(g, '마음을 추정한다', 160, 516, { size: 30, weight: 700, fam: FD, color: COL.accent });
      txt(g, '컴퓨터는 느끼지 않아요 — 세고, 더하고, 비교할 뿐', 560, 496, { size: 18, color: COL.soft });
    });
  }

  /* ---------- 02 감성 사전 ---------- */
  function sceneLexicon(g, u) {
    const px = 840, py = 150;
    fade(g, ramp(u, 0.4, 0.6), () => {
      panelBox(g, px, py, 360, 420);
      txt(g, '감성 사전 (일부)', px + 22, py + 30, { size: 18, weight: 700, color: COL.accent });
      txt(g, '실제 사전은 단어 수천~수만 개', px + 22, py + 56, { size: 13, color: COL.muted });
    });
    const res = score(EX.lexicon), used = res.words.filter(w => w.key).map(w => w.key);
    const rowY = {};
    LEX_SHOW.forEach(([k, v], i) => {
      const y = py + 92 + i * 27, a = ramp(u, 0.8 + i * 0.12, 0.4), on = used.indexOf(k) >= 0 && u > 18 && u < 26;
      rowY[k] = y;
      fade(g, a, () => {
        if (on) { rr(g, px + 12, y - 12, 336, 24, 6); g.fillStyle = 'rgba(201,167,255,0.14)'; g.fill(); }
        txt(g, SA.SHOW[k] || k, px + 30, y, { size: 16, weight: on ? 700 : 500, color: on ? COL.accent : COL.text });
        const tag = sf(v, 0), tw_ = tw(g, tag, 14, 600, FM) + 14;
        rr(g, px + 330 - tw_, y - 10, tw_, 20, 5); g.fillStyle = polCol(v); g.fill();
        txt(g, tag, px + 330 - tw_ / 2, y + 1, { size: 14, weight: 600, fam: FM, color: '#0F0F14', align: 'center' });
      });
    });
    // 예문 1
    const sx = 90, sy = 250;
    fade(g, ramp(u, 12, 0.6), () => {
      txt(g, '예문', sx, 190, { size: 15, weight: 600, color: COL.muted });
      const keys = [];
      const pos = drawTokens(g, res, sx, sy, { size: 28, zeros: ramp(u, 26.2, 0.6), show: (i, w) => { if (w.key) keys.push(w.key); return ramp(u, 13 + keys.length * 1.6, 0.5); } });
      // 낱말 → 사전 줄을 잇는 선
      fade(g, ramp(u, 14, 0.6) * (1 - ramp(u, 25.6, 0.5)), () => {
        res.words.forEach((w, i) => {
          if (!w.key || rowY[w.key] == null) return;
          const p = pos[i], al = ramp(u, 13 + (used.indexOf(w.key) + 1) * 1.6, 0.5);
          fade(g, al, () => { g.save(); g.setLineDash([5, 5]); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p.cx, sy + 22); g.bezierCurveTo(p.cx, sy + 120, px - 80, rowY[w.key], px + 14, rowY[w.key]); g.stroke(); g.restore(); });
        });
      });
      fade(g, ramp(u, 19.4, 0.6), () => {
        const parts = res.words.filter(w => w.key).map(w => sf(w.score, 0)).join('  ');
        txt(g, parts + '  =', sx, 350, { size: 22, weight: 600, fam: FM, color: COL.soft });
        verdict(g, sx + tw(g, parts + '  =', 22, 600, FM) + 18, 350, res.total);
      });
    });
    // 예문 2, 3
    EX.lexicon2.forEach((t, k) => {
      const r = score(t), y = 474 + k * 66;
      fade(g, ramp(u, 32.2 + k * 0.8, 0.6), () => {
        const pos = drawTokens(g, r, sx, y, { size: 20, notes: false, zeros: 1 });
        const end = pos[pos.length - 1];
        verdict(g, end.x + end.w + 30, y, r.total, { size: 20 });
      });
    });
    fade(g, ramp(u, 32, 0.6), () => txt(g, '합 > 0 긍정 · 합 < 0 부정 · 합 = 0 중립', sx, 398, { size: 16, weight: 600, color: COL.accent }));
  }

  /* ---------- 03 규칙 더하기 ---------- */
  function sceneRules(g, u) {
    const lx = 80, sx = 250, rx = 1000;
    const none = { neg: false, boost: false, contrast: false };
    // 부정어
    fade(g, ramp(u, 0.4, 0.5), () => {
      const y = 214, on = ramp(u, 6.4, 0.6) * (S.rules.neg ? 1 : 0);
      txt(g, '부정어', lx, y, { size: 20, weight: 700, color: COL.accent });
      txt(g, '안 · 못 · 않다 · 없다', lx, y + 28, { size: 13, color: COL.muted });
      const r0 = SA.score(EX.neg, none, S.extra), r1 = SA.score(EX.neg, S.rules, S.extra), r = on > 0.5 ? r1 : r0;
      drawTokens(g, r, sx, y, { size: 26 });
      const ok = (on > 0.5 ? r1 : r0).label === 'neg';
      verdict(g, rx - 160, y, r.total, { size: 22 });
      fade(g, ramp(u, 2.6, 0.5), () => mark(g, ok, rx + 140, y, 12));
    });
    // 강조어
    fade(g, ramp(u, 13, 0.5), () => {
      const y = 330;
      txt(g, '강조어', lx, y, { size: 20, weight: 700, color: COL.accent });
      txt(g, '정말 ×1.5 · 조금 ×0.5', lx, y + 28, { size: 13, color: COL.muted });
      EX.boost.forEach((t, k) => {
        const r = score(t), xx = sx + k * 380;
        const pos = drawTokens(g, r, xx, y, { size: 24 });
        const end = pos[pos.length - 1];
        txt(g, `= ${sf(r.total)}`, end.x + end.w + 14, y, { size: 18, weight: 600, fam: FM, color: COL.soft });
      });
    });
    // 대조
    fade(g, ramp(u, 20, 0.5), () => {
      const y = 456, r = score(EX.contrast);
      txt(g, '대조', lx, y, { size: 20, weight: 700, color: COL.accent });
      txt(g, '하지만 · ~지만', lx, y + 28, { size: 13, color: COL.muted });
      const show = ramp(u, 24, 0.6);
      const pos = drawTokens(g, r, sx, y, { size: 26, show: () => show, notes: false });
      const ci = r.words.findIndex(w => /지만$/.test(w.w) || SA.CONTRAST.indexOf(w.w) >= 0);
      if (ci >= 0 && S.rules.contrast) fade(g, ramp(u, 21.4, 0.6), () => {
        const a0 = pos[0].x - 6, a1 = pos[ci].x + pos[ci].w + 6, b0 = pos[ci + 1] ? pos[ci + 1].x - 6 : a1, b1 = pos[pos.length - 1].x + pos[pos.length - 1].w + 6, by = y + 44;
        g.strokeStyle = COL.dim; g.lineWidth = 2;
        [[a0, a1, '앞 ×0.5'], [b0, b1, '뒤 ×1.5']].forEach(([p0, p1, s]) => {
          g.beginPath(); g.moveTo(p0, by - 6); g.lineTo(p0, by); g.lineTo(p1, by); g.lineTo(p1, by - 6); g.stroke();
          txt(g, s, (p0 + p1) / 2, by + 18, { size: 15, weight: 700, color: COL.accent, align: 'center' });
        });
      });
      fade(g, ramp(u, 28, 0.6), () => { verdict(g, rx - 160, y, r.total, { size: 22 }); mark(g, r.label === 'neg', rx + 140, y, 12); });
    });
    // VADER
    fade(g, ramp(u, 36.2, 0.6), () => {
      panelBox(g, 80, 536, 1120, 40, COL.panel2);
      txt(g, 'VADER (Hutto & Gilbert, 2014): 영어 감성 사전 + 규칙. ‘but’ 앞의 감정은 ×0.5, 뒤는 ×1.5', 100, 557, { size: 16, color: COL.soft });
    });
  }

  /* ---------- 04 사전의 한계 ---------- */
  function sceneLimits(g, u) {
    EX.limits.forEach(([t, truth, why], k) => {
      const y = 152 + k * 128, a = ramp(u, 0.5 + k * 7, 0.6), r = score(t);
      fade(g, a, () => {
        panelBox(g, 80, y, 1120, 116);
        drawTokens(g, r, 110, y + 82, { size: 24, zeros: 1 });
        txt(g, '사전', 760, y + 40, { size: 14, color: COL.muted });
        verdict(g, 760, y + 76, r.total, { size: 20 });
        txt(g, '실제', 1000, y + 40, { size: 14, color: COL.muted });
        txt(g, truth, 1000, y + 76, { size: 20, weight: 700, color: truth.indexOf('긍정') === 0 ? COL.pos : COL.neg });
        mark(g, SA.label(r.total) === (truth.indexOf('긍정') === 0 ? 'pos' : 'neg'), 1160, y + 76, 12);
        txt(g, why, 110, y + 20, { size: 14, weight: 600, color: COL.accent });
      });
    });
    fade(g, ramp(u, 21, 0.6), () => txt(g, '→ 점수를 사람이 정하지 말고 데이터에서 배운다면?', 110, 560, { size: 24, weight: 700, color: COL.accent }));
  }

  /* ---------- 05 데이터로 배우기 ---------- */
  function sceneLearn(g, u) {
    const nb = SA.NB, pos = SA.TRAIN.filter(r => r[0] === '+'), neg = SA.TRAIN.filter(r => r[0] === '-');
    const hiWord = u >= 21 && u < 28 ? '눈물' : null;
    [[pos, 80, '긍정 서평 12', COL.pos], [neg, 340, '부정 서평 12', COL.neg]].forEach(([list, x, title, c]) => {
      fade(g, ramp(u, 0.4, 0.5), () => txt(g, title, x, 160, { size: 16, weight: 700, color: c }));
      list.forEach((r, k) => {
        const y = 192 + k * 31, a = ramp(u, 0.6 + k * 0.08 + (x > 100 ? 0.4 : 0), 0.4);
        const has = hiWord && SA.lemmas(r[1]).indexOf(hiWord) >= 0;
        fade(g, a, () => {
          rr(g, x, y - 13, 244, 26, 6); g.fillStyle = has ? 'rgba(201,167,255,0.22)' : COL.panel; g.fill();
          g.fillStyle = c; g.fillRect(x, y - 13, 4, 26);
          let s = r[1]; while (tw(g, s, 13) > 226 && s.length > 4) s = s.slice(0, -2);
          if (s !== r[1]) s += '…';
          txt(g, s, x + 12, y, { size: 13, color: has ? COL.text : COL.soft });
        });
      });
    });
    // 낱말 횟수와 무게
    const words = LEARN_WORDS.slice();
    if (S.word && words.indexOf(S.word) < 0 && nb.index[S.word] != null) words[words.length - 1] = S.word;   // 고른 낱말은 마지막 줄에
    const tx = 640, ty = 220, rh = 46, showW = ramp(u, 28, 0.8);
    fade(g, ramp(u, 7, 0.6), () => {
      txt(g, '낱말', tx, ty - 34, { size: 14, color: COL.muted });
      txt(g, '긍정', tx + 150, ty - 34, { size: 14, color: COL.pos, align: 'center' });
      txt(g, '부정', tx + 220, ty - 34, { size: 14, color: COL.neg, align: 'center' });
      fade(g, showW, () => txt(g, '무게 (− 부정 · 긍정 +)', tx + 400, ty - 34, { size: 14, color: COL.muted, align: 'center' }));
    });
    words.forEach((wd, k) => {
      const o = nb.weights.find(x => x.w === wd), y = ty + k * rh, a = ramp(u, 7.4 + k * 0.5, 0.5);
      const hl = (u >= 14 && u < 21 && ['꿀잼', '추천', '아깝다', '지루하다'].indexOf(wd) >= 0) || (hiWord === wd) || (wd === S.word);
      fade(g, a, () => {
        if (hl) { rr(g, tx - 12, y - 19, 560, 38, 8); g.fillStyle = 'rgba(201,167,255,0.12)'; g.fill(); }
        txt(g, wd, tx, y, { size: 20, weight: 700, color: hl ? COL.accent : COL.text });
        txt(g, o.pos, tx + 150, y, { size: 20, fam: FM, weight: 600, align: 'center', color: COL.text });
        txt(g, o.neg, tx + 220, y, { size: 20, fam: FM, weight: 600, align: 'center', color: COL.text });
        fade(g, showW, () => polBar(g, tx + 400, y, o.x, 70, showW));
      });
    });
    fade(g, ramp(u, 28.4, 0.6), () => {
      panelBox(g, tx - 12, 498, 572, 76, COL.panel2);
      txt(g, '무게 = ln( P(낱말|긍정) ÷ P(낱말|부정) )', tx + 6, 520, { size: 17, weight: 600, fam: FM, color: COL.accent });
      fade(g, ramp(u, 34, 0.6), () => txt(g, `P(낱말|긍정) = (긍정 속 횟수 + 1) ÷ (긍정 낱말 ${nb.tot['+']} + 어휘 ${nb.V})`, tx + 6, 552, { size: 14, fam: FM, color: COL.soft }));
    });
  }

  /* ---------- 06 예측과 평가 ---------- */
  function sceneEval(g, u) {
    const nb = SA.NB, ev = SA.evaluate(SA.TEST, nb, S.rules, S.extra);
    // A. 서평 하나 예측
    fade(g, ramp(u, 0.4, 0.6) * (1 - ramp(u, 13, 0.6)), () => {
      const t = EX.limits[0][0], p = nb.predict(t), lx = score(t);
      txt(g, '새 서평', 120, 180, { size: 15, weight: 600, color: COL.muted });
      txt(g, `“${t}”`, 120, 222, { size: 30, weight: 700, fam: FD });
      txt(g, '낱말 원형', 120, 286, { size: 15, weight: 600, color: COL.muted });
      p.lemmas.forEach((wd, k) => {
        const x = 120 + k * 230, y = 340, known = nb.index[wd] != null, x_ = known ? nb.weight(wd) : 0, al = ramp(u, 1.4 + k * 0.6, 0.5);
        fade(g, al, () => {
          panelBox(g, x, y - 32, 210, 64, COL.panel2);
          txt(g, wd, x + 18, y - 8, { size: 20, weight: 700, color: known ? COL.text : COL.muted });
          txt(g, known ? `무게 ${sf(x_, 2)}` : '배운 적 없음 → 빼고 셈', x + 18, y + 18, { size: 14, fam: known ? FM : FB, color: known ? polCol(x_) : COL.muted });
        });
      });
      fade(g, ramp(u, 4, 0.6), () => {
        txt(g, `합 ${sf(p.logit, 2)}  →  긍정일 확률 ${(p.prob * 100).toFixed(0)}%`, 120, 432, { size: 24, weight: 700, fam: FM });
        verdict(g, 120, 486, p.logit, { size: 22 });
        txt(g, `(감성 사전으로는 ${sf(lx.total)}, ${SA.LABEL_KO[lx.label]})`, 330, 486, { size: 18, color: COL.muted });
      });
    });
    // B. 시험 데이터 표
    fade(g, ramp(u, 13.6, 0.6), () => {
      const x0 = 80, y0 = 196, rh = 41, cx = { truth: 600, lex: 760, nb: 1000 };
      txt(g, `시험 서평 ${ev.n}개 (학습에 쓰지 않음)`, x0, 158, { size: 16, weight: 600, color: COL.soft });
      txt(g, '실제', cx.truth, 158, { size: 14, color: COL.muted, align: 'center' });
      txt(g, '감성 사전 + 규칙', cx.lex, 158, { size: 14, color: COL.muted, align: 'center' });
      txt(g, '나이브 베이즈', cx.nb, 158, { size: 14, color: COL.muted, align: 'center' });
      ev.rows.forEach((r, k) => {
        const y = y0 + k * rh, a = ramp(u, 14 + k * 0.3, 0.4), sel = S.test === k, hl = (u >= 28 && u < 34 && !r.nbOk) || sel;
        fade(g, a, () => {
          rr(g, x0 - 10, y - 18, 1140, 36, 8); g.fillStyle = hl ? 'rgba(201,167,255,0.16)' : k % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)'; g.fill();
          txt(g, r.text, x0, y, { size: 18, weight: 500 });
          txt(g, r.y === 'pos' ? '긍정' : '부정', cx.truth, y, { size: 17, weight: 700, color: r.y === 'pos' ? COL.pos : COL.neg, align: 'center' });
          txt(g, `${sf(r.lex.total)} ${SA.LABEL_KO[r.lex.label]}`, cx.lex - 12, y, { size: 16, fam: FM, color: COL.soft, align: 'center' });
          mark(g, r.lexOk, cx.lex + 72, y, 9);
          txt(g, `${(r.nb.prob * 100).toFixed(0)}% ${SA.LABEL_KO[r.nb.label]}`, cx.nb - 12, y, { size: 16, fam: FM, color: COL.soft, align: 'center' });
          mark(g, r.nbOk, cx.nb + 72, y, 9);
        });
        HITS.push({ x: x0 - 10, y: y - 18, w: 1140, h: 36, kind: 'test', i: k });
      });
      fade(g, ramp(u, 20.6, 0.6), () => {
        const y = y0 + ev.n * rh + 6;
        g.strokeStyle = COL.line; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 - 10, y - 18); g.lineTo(x0 + 1130, y - 18); g.stroke();
        txt(g, '정확도', x0, y + 4, { size: 18, weight: 700 });
        txt(g, `${ev.lexAcc}/${ev.n} = ${(ev.lexAcc / ev.n * 100).toFixed(1)}%`, cx.lex, y + 4, { size: 18, weight: 700, fam: FM, color: COL.accent, align: 'center' });
        txt(g, `${ev.nbAcc}/${ev.n} = ${(ev.nbAcc / ev.n * 100).toFixed(1)}%`, cx.nb, y + 4, { size: 18, weight: 700, fam: FM, color: COL.accent, align: 'center' });
      });
      fade(g, ramp(u, 28.4, 0.5) * (1 - ramp(u, 33.6, 0.5)), () => {
        const r = ev.rows.find(x => !x.nbOk); if (!r) return;
        const s = r.nb.parts.map(o => `${o.w} ${sf(o.x, 2)}`).join(' · ') + `  →  ${sf(r.nb.logit, 2)}`;
        panelBox(g, 300, 112, 900, 34, COL.panel2);
        txt(g, '나이브 베이즈: ' + s, 316, 129, { size: 15, fam: FM, color: COL.text });
      });
    });
  }

  /* ---------- 07 문맥을 읽는 모델 ---------- */
  function sceneModels(g, u) {
    // 문맥 그림 (비유)
    fade(g, ramp(u, 0.4, 0.6), () => {
      const words = EX.contrast.split(' '), size = 24, y = 236;
      let x = 160; const cx = [];
      words.forEach(w => { const ww = tw(g, w, size, 600); cx.push(x + ww / 2); txt(g, w, x, y, { size, weight: 600 }); x += ww + 34; });
      const k = 1;
      cx.forEach((c, j) => {
        if (j === k) return;
        const al = ramp(u, 1 + j * 0.3, 0.5), h = 24 + Math.abs(j - k) * 10;
        fade(g, al, () => { g.strokeStyle = COL.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(cx[k], y - 20); g.bezierCurveTo(cx[k], y - 20 - h, c, y - 20 - h, c, y - 20); g.stroke(); });
      });
      txt(g, '단어끼리의 관계를 함께 읽어요 (그림은 비유)', x + 10, y, { size: 15, color: COL.muted });
    });
    const cols = ['감성 사전 + 규칙', '나이브 베이즈', '언어 모델 (BERT 등)'];
    const rows = [['필요한 것', ['사전과 규칙', '표시한 학습 데이터', '큰 사전 학습 + 표시한 데이터']], ['문맥 · 순서', ['규칙만큼만', '못 봐요 (단어 가방)', '읽어요']], ['근거 설명', ['쉬워요 (단어 점수)', '쉬워요 (낱말 무게)', '어려워요']], ['계산', ['가벼워요', '가벼워요', '무거워요']]];
    const x0 = 80, cw = 320, y0 = 304, rh = 52, colX = j => 240 + j * cw + cw / 2;
    fade(g, ramp(u, 2, 0.6), () => cols.forEach((c, j) => txt(g, c, colX(j), y0, { size: 18, weight: 700, color: j === 2 ? COL.accent : COL.text, align: 'center' })));
    rows.forEach(([h, cells], r) => {
      const y = y0 + 46 + r * rh, a = ramp(u, 2.6 + r * 0.5 + (r >= 2 ? 11 : 0), 0.5);
      fade(g, a, () => {
        rr(g, x0 - 10, y - 22, 1130, 44, 8); g.fillStyle = r % 2 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.045)'; g.fill();
        txt(g, h, x0, y, { size: 16, weight: 600, color: COL.muted });
        cells.forEach((c, j) => txt(g, c, colX(j), y, { size: 17, weight: 500, align: 'center' }));
      });
    });
    fade(g, ramp(u, 7, 0.6) * (1 - ramp(u, 13.4, 0.5)), () => {
      panelBox(g, 720, 140, 480, 40, COL.panel2);
      txt(g, 'NSMC: 네이버 영화 리뷰 20만 개 · 학습 15만 · 시험 5만', 740, 161, { size: 15, color: COL.soft });
    });
    fade(g, ramp(u, 20, 0.6), () => txt(g, '→ 어떤 방법이든 일부를 사람이 직접 표시해 결과와 비교해요', x0, y0 + 46 + 4 * rh + 4, { size: 20, weight: 700, color: COL.accent }));
  }

  /* ---------- 08 감정 곡선 ---------- */
  const ARCX = i => 150 + i * 74;
  const ARCY = v => 372 - v * 44;
  function sceneArc(g, u) {
    const story = SA.STORY, arc = SA.arc(story, S.win, S.rules, S.extra), n = story.length;
    const shapes = ramp(u, 28, 0.6) * (1 - ramp(u, 34.6, 0.6));
    fade(g, 1 - 0.8 * shapes, () => {
      // 축
      g.strokeStyle = COL.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(110, ARCY(0)); g.lineTo(1170, ARCY(0)); g.stroke();
      [-3, -2, -1, 1, 2, 3].forEach(v => { g.strokeStyle = COL.faint; g.lineWidth = 1; g.beginPath(); g.moveTo(110, ARCY(v)); g.lineTo(1170, ARCY(v)); g.stroke(); txt(g, sf(v, 0), 100, ARCY(v), { size: 12, fam: FM, color: COL.dim, align: 'right' }); });
      txt(g, '문장 →', 1170, ARCY(0) + 18, { size: 13, color: COL.muted, align: 'right' });
      // 지금 점수를 매기는 문장
      const cur = Math.min(n - 1, Math.floor(clamp((u - 0.6) / 0.45, 0, n - 1)));
      const scoring = u < 0.6 + n * 0.45 + 0.4;
      const showIdx = S.sent != null ? S.sent : scoring ? cur : null;
      if (showIdx != null && !(S.sent == null && u > 35)) {
        const r = score(story[showIdx]);
        txt(g, `${showIdx + 1}. ${story[showIdx]}`, 110, 154, { size: 19, weight: 600 });
        txt(g, `${sf(r.total)}`, 1170, 154, { size: 19, weight: 700, fam: FM, color: polCol(r.total), align: 'right' });
      }
      story.forEach((s, i) => {
        const a = ramp(u, 0.6 + i * 0.45, 0.45), v = arc.scores[i], x = ARCX(i), sel = S.sent === i;
        if (a <= 0) return;
        const h = v * 44 * a;
        rr(g, x - 20, h > 0 ? ARCY(0) - h : ARCY(0), 40, Math.max(2, Math.abs(h)), 4); g.fillStyle = polCol(v); g.fill();
        if (sel) { g.strokeStyle = COL.accent; g.lineWidth = 3; rr(g, x - 24, ARCY(3.2), 48, ARCY(-3.4) - ARCY(3.2), 8); g.stroke(); }
        txt(g, i + 1, x, ARCY(-4.2), { size: 13, fam: FM, color: COL.dim, align: 'center' });
        HITS.push({ x: x - 30, y: ARCY(3.4), w: 60, h: ARCY(-4.4) - ARCY(3.4), kind: 'sent', i });
      });
      // 장면 이름
      SA.STORY_MARKS.forEach(([i, label], k) => {
        const a = ramp(u, k < 2 ? 7 + k * 1.2 : 14 + (k - 2) * 1.2, 0.5), v = arc.scores[i], x = ARCX(i);
        fade(g, a, () => {
          const y = v >= 0 ? ARCY(v) - 26 : ARCY(v) + 26;
          const bw = tw(g, label, 15, 700) + 20;
          rr(g, x - bw / 2, y - 14, bw, 28, 14); g.fillStyle = COL.panel2; g.fill(); g.strokeStyle = COL.accent; g.lineWidth = 1.5; g.stroke();
          txt(g, label, x, y + 1, { size: 15, weight: 700, color: COL.accent, align: 'center' });
        });
      });
      // 이동 평균
      const mp = ramp(u, 21.2, 3.2);
      if (mp > 0) {
        g.strokeStyle = COL.accent; g.lineWidth = 3.5; g.lineJoin = 'round'; g.beginPath();
        const last = (n - 1) * mp;
        for (let i = 0; i <= Math.floor(last); i++) { const x = ARCX(i), y = ARCY(arc.smooth[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
        const fr = last - Math.floor(last), i0 = Math.floor(last);
        if (fr > 0 && i0 + 1 < n) g.lineTo(lerp(ARCX(i0), ARCX(i0 + 1), fr), lerp(ARCY(arc.smooth[i0]), ARCY(arc.smooth[i0 + 1]), fr));
        g.stroke();
        for (let i = 0; i <= Math.floor(last); i++) { g.beginPath(); g.arc(ARCX(i), ARCY(arc.smooth[i]), 5, 0, Math.PI * 2); g.fillStyle = COL.accent; g.fill(); }
        fade(g, ramp(u, 22, 0.6), () => txt(g, `── 이동 평균 (문장 ${S.win}개씩)`, 110, 196, { size: 15, weight: 700, color: COL.accent }));
      }
    });
    // 이야기의 기본 모양 (Reagan 외, 2016)
    fade(g, shapes, () => {
      panelBox(g, 240, 190, 800, 330, COL.panel2);
      txt(g, '이야기 감정 곡선의 기본 모양 (Reagan 외, 2016)', 270, 224, { size: 18, weight: 700, color: COL.accent });
      const forms = [['상승', p => p], ['하강', p => 1 - p], ['하강 → 상승', p => Math.cos(p * Math.PI * 2) * 0.5 + 0.5], ['상승 → 하강', p => 0.5 - Math.cos(p * Math.PI * 2) * 0.5], ['상승 → 하강 → 상승', p => 0.5 - Math.cos(p * Math.PI * 3) * 0.5], ['하강 → 상승 → 하강', p => 0.5 + Math.cos(p * Math.PI * 3) * 0.5]];
      forms.forEach(([label, f], k) => {
        const x = 270 + (k % 3) * 250, y = 260 + Math.floor(k / 3) * 130;
        g.strokeStyle = COL.text; g.lineWidth = 3; g.beginPath();
        for (let s = 0; s <= 40; s++) { const p = s / 40, xx = x + p * 200, yy = y + 70 - f(p) * 60; s ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
        g.stroke();
        txt(g, label, x, y + 96, { size: 15, weight: 600, color: COL.soft });
      });
    });
    if (S.sent == null) fade(g, ramp(u, 35.4, 0.6), () => txt(g, '곡선은 길잡이 — 다시 원문으로', 110, 154, { size: 20, weight: 700, color: COL.accent }));
  }

  /* ---------- 09 정리 ---------- */
  function sceneOutro(g, u) {
    const steps = [['글 모으기', '서평 · 일기 · 소설'], ['나누기', '문장 · 낱말'], ['점수 매기기', '사전·규칙 / 학습'], ['확인하기', '시험 데이터 · 정확도'], ['읽고 해석', '틀린 문장 읽기']];
    const bw = 200, gap = 30, x0 = (W - (steps.length * bw + (steps.length - 1) * gap)) / 2, y = 222;
    steps.forEach(([a, b], k) => {
      const al = ramp(u, 0.6 + k * 0.7, 0.5), x = x0 + k * (bw + gap);
      fade(g, al, () => {
        rr(g, x, y - 46, bw, 92, 12); g.fillStyle = COL.panel; g.fill();
        txt(g, `${k + 1}`, x + 18, y - 22, { size: 14, fam: FM, color: COL.accent });
        txt(g, a, x + bw / 2, y - 2, { size: 20, weight: 700, align: 'center' });
        txt(g, b, x + bw / 2, y + 26, { size: 14, color: COL.soft, align: 'center' });
        if (k) arrow(g, x - gap + 4, y, x - 5, y, COL.line, 2, 9);
      });
    });
    fade(g, ramp(u, 7.4, 0.8), () => {
      const cx = 140, cy = 312;
      rr(g, cx - 30, cy, 1060, 236, 14); g.fillStyle = '#0D0D12'; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1; g.stroke();
      const lines = [
        [['from ', COL.accent], ['sklearn.feature_extraction.text ', COL.text], ['import ', COL.accent], ['CountVectorizer', COL.text]],
        [['from ', COL.accent], ['sklearn.naive_bayes ', COL.text], ['import ', COL.accent], ['MultinomialNB', COL.text]],
        [],
        [['vec = CountVectorizer(analyzer=str.split)', COL.text], ['        # 낱말 원형을 띄어쓰기로 이은 서평', COL.muted]],
        [['nb = MultinomialNB(alpha=1.0).fit(vec.fit_transform(train), labels)', COL.text]],
        [['nb.predict(vec.transform(test))', COL.text], ['                 # 긍정 / 부정 예측', COL.muted]],
      ];
      lines.forEach((parts, r) => { let x = cx; parts.forEach(([s, c]) => { x += txt(g, s, x, cy + 40 + r * 32, { size: 18, fam: FM, color: c }); }); });
    });
    fade(g, ramp(u, 14.4, 0.6), () => txt(g, '아래 놀이터에서 내 문장으로 해 보세요 ↓', W / 2, 574, { size: 22, weight: 700, color: COL.accent, align: 'center' }));
  }

  const SCENES = { intro: sceneIntro, what: sceneWhat, lexicon: sceneLexicon, rules: sceneRules, limits: sceneLimits, learn: sceneLearn, eval: sceneEval, models: sceneModels, arc: sceneArc, outro: sceneOutro };

  // 영상 추출용 자막: 아래쪽 띠에 두 줄까지
  function drawCaption(g, text) {
    if (!text) return;
    const words = [];
    text.split('**').forEach((part, k) => { const bold = k % 2 === 1; part.split(/(\s+)/).forEach(w => w && words.push({ w, bold })); });
    const lines = [[]]; let lw = 0;
    words.forEach(o => {
      o.ww = tw(g, o.w, 28, o.bold ? 700 : 500);
      const blank = /^\s+$/.test(o.w), line = lines[lines.length - 1];
      if (!blank && line.length && lw + o.ww > 1080) { lines.push([]); lw = 0; }
      if (blank && !lines[lines.length - 1].length) return;
      lines[lines.length - 1].push(o); lw += o.ww;
    });
    const widthOf = l => l.reduce((s, o) => s + o.ww, 0), lh = 42, h = lines.length * lh + 22, y0 = H - 26 - h;
    const bw = Math.max(...lines.map(widthOf)) + 52;
    rr(g, (W - bw) / 2, y0, bw, h, 12); g.fillStyle = 'rgba(8,8,12,0.86)'; g.fill();
    lines.forEach((l, li) => {
      let x = (W - widthOf(l)) / 2;
      l.forEach(o => { txt(g, o.w, x, y0 + 11 + lh * li + lh / 2, { size: 28, weight: o.bold ? 700 : 500, color: o.bold ? COL.accent : COL.text }); x += o.ww; });
    });
  }

  SV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[SV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u);
    g.restore();
    if (opt.caption) drawCaption(g, SV.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + SA.STORY.join('') + SA.TRAIN.concat(SA.TEST).map(r => r[1]).join('') + Object.keys(SA.STEMS).join('') + '0123456789.,·()[]→↑↓×÷=≈√−+%‘’“”…';
  SV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set();
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { SV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
  SV.baseText = EXTRA;
})();
