/* TF-IDF 튜토리얼 — 영상 장면
 *
 * TV.render(g, t)는 시각 t와 사용자 상태 TV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 * 숫자는 모두 corpus.js의 진짜 계산값이고, 자막 속 숫자와 다르면 콘솔에 경고를 냅니다.
 */
(function () {
  'use strict';
  const TI = window.TI, M = TI.M, D = TI.DOCS;
  const TV = (window.TV = {});
  const W = 1280, H = 720;
  TV.W = W; TV.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const f2 = x => TI.fmt(x, 2);
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  // 고정폭·제목 글꼴에 없는 한글은 본문 글꼴(웹 글꼴)로 그림
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  TV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#12161D', grid: 'rgba(236,239,243,0.045)', text: '#ECEFF3', soft: '#C7CFD8', muted: '#94A1AF', dim: '#5E6976',
    faint: 'rgba(236,239,243,0.14)', line: 'rgba(236,239,243,0.32)', panel: '#1A202A', panel2: '#222A36', bar: '#56637A',
    accent: '#FFCB6B', good: '#7BE0A6',
  };
  TV.COL = COL;
  const SHORT = D.map(d => d.title.replace(/전$/, ''));

  // 사용자 상태 ('직접 해 보기'와 화면 누르기로 바뀜). 영상 추출은 언제나 기본값
  const S = (TV.S = { doc: 0, word: null, ax: '사랑', ay: '이별', long: true, pair: null, th: 0 });
  TV.DEFAULTS = JSON.stringify(S);
  let HITS = [];
  TV.hits = () => HITS;

  const ix = w => M.index[w];
  const RAWW = M.w;                                             // 정규화 전 TF-IDF
  const LONG = M.transform([].concat(D[0].tokens, D[0].tokens, D[0].tokens));   // 춘향전을 세 번 이어 붙인 문서
  const LONG_TITLE = '긴 춘향전';
  const V2 = (vec, a = S.ax, b = S.ay) => [vec[ix(a)] || 0, vec[ix(b)] || 0];
  const WMAX = Math.max(...RAWW.map(r => Math.max(...r)));

  // 글자를 그리는 곳은 모두 txt()를 지남 → 글꼴을 미리 받을 글자를 모을 수 있음
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
  function arrow(g, x0, y0, x1, y1, color, lw = 3, head = 13) {
    const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1) return;
    const hl = Math.min(head, len * 0.6);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(ang) * hl * 0.8, y1 - Math.sin(ang) * hl * 0.8); g.stroke();
    g.beginPath(); g.moveTo(x1, y1);
    g.lineTo(x1 - Math.cos(ang - 0.42) * hl, y1 - Math.sin(ang - 0.42) * hl);
    g.lineTo(x1 - Math.cos(ang + 0.42) * hl, y1 - Math.sin(ang + 0.42) * hl);
    g.closePath(); g.fill();
  }
  function dashed(g, x0, y0, x1, y1, color, lw = 2, dash = [7, 6]) {
    g.save(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = lw;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore();
  }
  function check(g, x, y, s, color) {
    g.strokeStyle = color; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x - s * 0.12, y + s * 0.4); g.lineTo(x + s * 0.55, y - s * 0.45); g.stroke();
  }
  function docCard(g, i, x, y, w, h, o = {}) {
    rr(g, x, y, w, h, 12); g.fillStyle = o.fill || COL.panel; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = D[i].dark; rr(g, x + 10, y + 14, 5, Math.min(h - 28, 34), 2.5); g.fill();
    txt(g, D[i].title, x + 26, y + 31, { size: o.titleSize || 22, weight: 700, fam: FD });
  }
  function wrap(g, s, maxW, size, weight = 400) {
    g.font = fnt(size, weight);
    const words = String(s).split(' '), lines = [];
    let line = '';
    words.forEach(w => { const t = line ? line + ' ' + w : w; if (line && g.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t; });
    if (line) lines.push(line);
    return lines;
  }
  // 줄거리를 어절(띄어쓰기) 단위로 줄 바꿈하고, 명사 조각(k ≥ 0)의 위치를 기록
  function layoutMarked(g, doc, maxW, size) {
    g.font = fnt(size, 400);
    const pieces = []; let pos = 0;
    doc.spans.forEach((sp, k) => { if (sp.start > pos) pieces.push({ s: doc.text.slice(pos, sp.start), k: -1 }); pieces.push({ s: sp.word, k }); pos = sp.end; });
    if (pos < doc.text.length) pieces.push({ s: doc.text.slice(pos), k: -1 });
    const units = []; let cur = [];
    pieces.forEach(p => {
      if (p.k >= 0) { cur.push(p); return; }
      p.s.split(/( )/).forEach(t => { if (t === ' ') { if (cur.length) units.push(cur); cur = []; } else if (t) cur.push({ s: t, k: -1 }); });
    });
    if (cur.length) units.push(cur);
    const sp = g.measureText(' ').width, out = [];
    let x = 0, line = 0;
    units.forEach(un => {
      const w = un.reduce((a, p) => a + g.measureText(p.s).width, 0);
      if (x > 0 && x + w > maxW) { x = 0; line++; }
      un.forEach(p => { const pw = g.measureText(p.s).width; out.push({ s: p.s, k: p.k, x, line, w: pw }); x += pw; });
      x += sp;
    });
    return out;
  }
  // 흰색 계열 한 가지 색으로 크기를 나타냄 (0이면 바탕에 가깝게)
  const shade = p => { const c = Math.round(lerp(34, 236, clamp(p))); return `rgb(${c},${Math.round(lerp(40, 239, clamp(p)))},${Math.round(lerp(52, 243, clamp(p)))})`; };

  /* ---------- 장면 정의 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '고전 소설 여섯 편', t: 0 },
    { id: 'bag', n: '01', title: '단어 가방', sub: '문서-단어 행렬', t: 20 },
    { id: 'tf', n: '02', title: 'TF · 단어 빈도', sub: '얼마나 자주 나오나', t: 48 },
    { id: 'idf', n: '03', title: 'DF와 IDF', sub: '얼마나 드문가', t: 76 },
    { id: 'tfidf', n: '04', title: 'TF-IDF', sub: '문서의 독특성', t: 116 },
    { id: 'vector', n: '05', title: '벡터로 바꾸기', sub: '문서는 화살표', t: 158 },
    { id: 'euclid', n: '06', title: '유클리드 거리', sub: '화살표 끝 사이', t: 190 },
    { id: 'cosine', n: '07', title: '코사인 유사도', sub: '화살표 사이의 각도', t: 222 },
    { id: 'norm', n: '08', title: '길이를 1로', sub: 'L2 정규화', t: 262 },
    { id: 'map', n: '09', title: '문서 사이의 관계', sub: '유사도 표와 네트워크', t: 290 },
    { id: 'outro', n: '10', title: '정리', sub: '파이썬으로 해 보기', t: 332 },
  ];
  const END = 356;
  // [시작, 끝, 문장]. **굵게**는 강조색
  const CAPTIONS = [
    [0.6, 5.6, '여기 우리 고전 소설 여섯 편의 줄거리가 있어요.'],
    [5.6, 11, '어떤 이야기들이 서로 닮았을까요? 그리고 각 이야기만의 **독특한 단어**는 무엇일까요?'],
    [11, 16, '사람은 읽으면 알지만, 컴퓨터가 비교하려면 글을 **숫자**로 바꿔야 해요.'],
    [16, 20, '그 방법이 **TF-IDF**와 **벡터**, 그리고 **거리**예요.'],

    [20.4, 26, '먼저 줄거리에서 **명사**만 골라요. 한국어는 형태소 분석기가 이 일을 해 줘요.'],
    [26, 32.6, '그다음 순서는 버리고, 단어마다 몇 번 나왔는지만 세요. 이것을 **단어 가방**이라고 해요.'],
    [32.6, 40, '여섯 문서의 단어 가방을 한 줄씩 쌓으면 **문서-단어 행렬**이 돼요.'],
    [40, 48, '줄은 문서, 칸은 단어예요. 춘향전 줄의 ‘사랑’ 칸에 든 2는 춘향전에 ‘사랑’이 두 번 나왔다는 뜻이에요.'],

    [48.4, 54, '**TF**(Term Frequency)는 한 문서 안에서 단어가 나온 횟수예요.'],
    [54, 60, '춘향전에서는 ‘춘향’이 네 번, ‘몽룡’이 세 번 나와요. 자주 나올수록 중요한 단어겠죠?'],
    [60, 68, '그런데 ‘이야기’는 여섯 편 모두에 나와요. 어느 문서에나 있는 단어는 그 문서만의 특징이 될 수 없어요.'],
    [68, 76, '그래서 단어가 **몇 개의 문서**에 나오는지도 함께 봐야 해요.'],

    [76.4, 82, '**DF**(Document Frequency)는 그 단어가 나온 문서의 수예요.'],
    [82, 89, '‘이야기’는 여섯 문서 모두에, ‘사랑’은 두 문서에, ‘제비’는 흥부전 한 문서에만 나와요.'],
    [89, 97, '**IDF**는 DF를 뒤집은 값이에요. 전체 문서 수를 DF로 나누고 로그를 씌워요.'],
    [97, 104, '한 문서에만 나오면 ln(6 ÷ 1) ≈ 1.79, 모든 문서에 나오면 ln(6 ÷ 6) = 0이에요.'],
    [104, 110, '드문 단어일수록 IDF가 크고, 어디에나 있는 단어는 무게가 0이 돼요.'],
    [110, 116, '로그를 쓰면 문서가 아주 많아져도 값이 지나치게 커지지 않아요.'],

    [116.4, 122, '이제 둘을 곱해요. **TF-IDF = TF × IDF**.'],
    [122, 129, '한 문서에 자주 나오면서(TF가 크고) 다른 문서에는 드문(IDF가 큰) 단어가 높은 점수를 받아요.'],
    [129, 136, '춘향전을 보세요. ‘이야기’는 0이 되고, 운영전에도 나오는 ‘사랑’은 ‘사또’ 아래로 내려가요.'],
    [136, 143, '‘춘향’, ‘몽룡’, ‘사또’처럼 춘향전에만 나오는 단어가 맨 위로 올라와요.'],
    [143, 151, '문서마다 점수가 가장 높은 단어를 뽑으면, 그 문서의 **독특성**을 보여 주는 **특징어**가 돼요.'],
    [151, 158, '흥부전은 제비·다리·박, 심청전은 아버지·심청·눈. 단어만 봐도 어떤 이야기인지 알겠죠?'],

    [158.4, 165, '문서마다 모든 단어의 TF-IDF 점수를 한 줄로 늘어놓으면 숫자 목록, 곧 **벡터**가 돼요.'],
    [165, 172, '단어가 65개이니 문서 하나는 65차원 공간의 화살표 하나예요. 여섯 문서는 화살표 여섯 개죠.'],
    [172, 180, '65차원은 그릴 수 없으니, ‘사랑’과 ‘이별’ 두 칸만 골라 평면에 그려 볼게요.'],
    [180, 190, '춘향전과 운영전은 두 단어를 모두 가져서 비슷한 쪽을 가리켜요. 두 단어가 없는 문서는 원점에 머물러요.'],

    [190.4, 197, '두 화살표 끝 사이의 곧은 거리를 **유클리드 거리**라고 해요. 가까울수록 닮은 문서예요.'],
    [197, 204, '칸마다 차이를 제곱해 모두 더한 뒤 제곱근을 씌워요. 피타고라스 정리와 같아요.'],
    [204, 211, '그런데 춘향전을 **세 번 이어 붙인** 긴 문서를 만들면 어떨까요? 내용은 똑같은데요.'],
    [211, 222, '점수가 세 배가 되어 화살표가 길어지고, 원래 춘향전과의 거리가 다른 어느 소설보다도 멀어져요. 유클리드 거리는 글의 **길이**에 흔들려요.'],

    [222.4, 229, '그래서 길이 대신 **방향**을 봐요. 두 화살표 사이의 각도가 작을수록 닮은 문서예요.'],
    [229, 236, '**코사인 유사도**는 그 각도의 코사인 값이에요. 같은 방향이면 1, 직각이면 0이에요.'],
    [236, 243, '세 번 이어 붙인 춘향전은 원래 춘향전과 방향이 같아요. 길이는 달라도 코사인 유사도는 1이에요.'],
    [243, 251, '흥부전처럼 같은 단어가 하나도 없으면 직각이 되어 0이에요. TF-IDF에는 음수가 없어서 값은 0과 1 사이예요.'],
    [251, 256.5, '계산은 칸마다 곱해 더한 값(내적)을 두 화살표 길이의 곱으로 나눠요.'],
    [256.5, 262, '65칸 모두로 계산하면 춘향전과 운영전은 0.10. 서로 다른 단어가 훨씬 많아서 그림보다 멀어요.'],

    [262.4, 269, '벡터를 자기 길이로 나누면 모든 화살표의 길이가 1이 돼요. 이것을 **L2 정규화**라고 해요.'],
    [269, 276, '화살표 끝이 모두 반지름 1인 원 위에 놓이고, 세 번 이어 붙인 춘향전은 원래 춘향전과 같은 점이 돼요.'],
    [276, 283, '이제 유클리드 거리와 코사인 유사도는 같은 이야기를 해요. 거리 = √(2 − 2 × 코사인).'],
    [283, 290, 'scikit-learn의 TfidfVectorizer는 처음부터 길이를 1로 맞춰 줘요.'],

    [290.4, 297, '이제 모든 단어로 여섯 문서끼리 코사인 유사도를 계산해 표로 만들어요.'],
    [297, 304, '칸이 밝을수록 닮은 문서예요. 대각선은 자기 자신과의 비교라서 1이에요.'],
    [304, 311, '춘향전과 운영전이 서로 가장 닮았고, 장화홍련전과 콩쥐팥쥐전이 짝을 이뤄요.'],
    [311, 318, '‘사랑’과 ‘이별’, ‘계모’와 ‘어머니’와 ‘구박’처럼 같은 단어를 함께 쓰기 때문이에요.'],
    [318, 325, '유사도가 0보다 큰 문서끼리 선으로 이으면, 이야기 사이의 관계가 **네트워크**로 보여요.'],
    [325, 332, '사랑 이야기 둘과, 계모와 가족 이야기로 이어진 넷. 숫자만으로 이야기의 무리를 찾았어요.'],

    [332.4, 339, '정리해 볼까요? 단어를 세고(TF), 흔한 단어의 무게를 덜고(IDF), 문서를 벡터로 바꿔요.'],
    [339, 346, '벡터 사이의 각도(코사인 유사도)나 거리(유클리드 거리)로 문서 사이의 관계를 잴 수 있어요.'],
    [346, 356, '파이썬에서는 TfidfVectorizer와 cosine_similarity 몇 줄이면 돼요. 아래 놀이터에서 내 문서로 해 보세요.'],
  ];
  TV.CHAPTERS = CHAPTERS; TV.CAPTIONS = CAPTIONS; TV.END = END;
  TV.POSTER = 327;
  TV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  TV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 자막 속 숫자와 계산이 어긋나면 알려 줌
  (function verify() {
    const warn = m => console.warn('TF-IDF 영상: ' + m);
    const tf = (d, w) => M.tf[d][ix(w)], top = (d, k) => M.top(d, k).map(v => M.vocab[v]).join(',');
    if (M.V !== 65) warn(`단어 수가 65가 아니라 ${M.V}`);
    if (tf(0, '춘향') !== 4 || tf(0, '몽룡') !== 3 || tf(0, '사랑') !== 2) warn('춘향전의 TF가 자막과 다름');
    if (M.df[ix('이야기')] !== 6 || M.df[ix('사랑')] !== 2 || M.df[ix('제비')] !== 1) warn('DF가 자막과 다름');
    if (top(0, 3) !== '춘향,몽룡,사또' || M.top(0).indexOf(ix('사랑')) !== 3) warn('춘향전 TF-IDF 순서가 자막과 다름: ' + top(0, 4));
    if (top(5, 3) !== '제비,다리,박' || top(2, 3) !== '아버지,심청,눈') warn('흥부전/심청전 특징어가 자막과 다름');
    if (f2(M.cos[0][1]) !== '0.10') warn('춘향전–운영전 코사인이 0.10이 아님: ' + f2(M.cos[0][1]));
    const far = TI.euclid(LONG, RAWW[0]);
    if (!RAWW.every((r, i) => i === 0 || TI.euclid(r, RAWW[0]) < far)) warn('긴 춘향전이 가장 멀지 않음');
    const best = i => M.cos[i].reduce((b, x, j) => j !== i && x > M.cos[i][b] ? j : b, i === 0 ? 1 : 0);
    if (best(0) !== 1 || best(1) !== 0 || best(3) !== 4 || best(4) !== 3) warn('가장 닮은 짝이 자막과 다름');
  })();

  /* ---------- 공통 그림 ---------- */
  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, 80, 80, { size: 15, weight: 500, fam: FM, color: COL.accent, base: 'alphabetic' });
    txt(g, ch.title, 80, 124, { size: 38, weight: 700, fam: FD, base: 'alphabetic' });
  }
  // 평면 (두 단어 칸만 골라 그린 그림)
  const PL = { ox: 200, oy: 556, unit: 85, xlen: 630, ylen: 306 };
  const P = (x, y, unit = PL.unit) => [PL.ox + x * unit, PL.oy - y * unit];
  function axes(g, xw, yw, unit = PL.unit, a = 1, yAlpha = 1) {
    fade(g, a, () => {
      g.strokeStyle = COL.line; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(PL.ox, PL.oy); g.lineTo(PL.ox + PL.xlen, PL.oy); g.moveTo(PL.ox, PL.oy); g.lineTo(PL.ox, PL.oy - PL.ylen); g.stroke();
      for (let k = 1; k * unit <= PL.xlen - 10; k++) {
        const x = PL.ox + k * unit;
        g.strokeStyle = COL.faint; g.beginPath(); g.moveTo(x, PL.oy); g.lineTo(x, PL.oy + 6); g.stroke();
        txt(g, k, x, PL.oy + 18, { size: 13, fam: FM, color: COL.dim, align: 'center' });
      }
      for (let k = 1; k * unit <= PL.ylen - 10; k++) {
        const y = PL.oy - k * unit;
        g.strokeStyle = COL.faint; g.beginPath(); g.moveTo(PL.ox - 6, y); g.lineTo(PL.ox, y); g.stroke();
        txt(g, k, PL.ox - 12, y, { size: 13, fam: FM, color: COL.dim, align: 'right' });
      }
      txt(g, `‘${xw}’의 TF-IDF →`, PL.ox + PL.xlen, PL.oy + 40, { size: 16, weight: 600, color: COL.soft, align: 'right' });
      fade(g, yAlpha, () => txt(g, `↑ ‘${yw}’의 TF-IDF`, PL.ox - 4, PL.oy - PL.ylen - 22, { size: 16, weight: 600, color: COL.soft }));
      txt(g, '0', PL.ox - 10, PL.oy + 16, { size: 13, fam: FM, color: COL.dim, align: 'right' });
    });
  }
  function vecArrow(g, v, color, label, p = 1, unit = PL.unit, o = {}) {
    if (p <= 0) return;
    const [x1, y1] = P(v[0] * p, v[1] * p, unit);
    if (Math.hypot(v[0], v[1]) < 1e-9) return;
    arrow(g, PL.ox, PL.oy, x1, y1, color, o.lw || 3.4, 14);
    if (label && p > 0.9) fade(g, (p - 0.9) * 10, () => {
      const ang = Math.atan2(-(y1 - PL.oy), x1 - PL.ox), dx = o.dx != null ? o.dx : 12, dy = o.dy != null ? o.dy : -14;
      txt(g, label, x1 + dx, y1 + dy, { size: 17, weight: 700, color: COL.text, align: o.align || 'left' });
      if (o.coord) txt(g, `(${f2(v[0])}, ${f2(v[1])})`, x1 + dx, y1 + dy + 20, { size: 14, fam: FM, color: COL.muted, align: o.align || 'left' });
      return ang;
    });
  }
  // 문서별 이름표 자리 (평면 그림)
  const LB = { 0: { align: 'right', dx: -14, dy: -14 }, 1: { dx: 12, dy: 18 }, long: { dx: 14, dy: -2 }, 5: { dx: 14, dy: 0 } };
  const lbOf = (i, k) => LB[i] || (k % 2 ? { dx: 12, dy: 18 } : { dx: 12, dy: -14 });
  function panelBox(g, x, y, w, h) { rr(g, x, y, w, h, 12); g.fillStyle = COL.panel; g.fill(); }

  /* ---------- 00 들어가며 ---------- */
  const GRID = { x: [80, 455, 830], y: [158, 366], w: 370, h: 190 };
  function sceneIntro(g, u) {
    D.forEach((d, i) => {
      const x = GRID.x[i % 3], y = GRID.y[Math.floor(i / 3)];
      const a = ramp(u, 0.5 + i * 0.3, 0.6);
      fade(g, a, () => {
        g.save(); g.translate(0, (1 - a) * 16);
        docCard(g, i, x, y, GRID.w, GRID.h);
        const num = ramp(u, 11 + i * 0.2, 1);
        const lines = wrap(g, d.text, GRID.w - 46, 16);
        fade(g, 1 - num, () => lines.slice(0, 4).forEach((l, k) => txt(g, k === 3 && lines.length > 4 ? l + ' …' : l, x + 24, y + 68 + k * 27, { size: 16, color: COL.muted })));
        // 숫자로: 이 문서의 진짜 TF-IDF 벡터 앞부분
        fade(g, num, () => {
          const vals = RAWW[i].map(f2);
          let line = '';
          const rows = [];
          vals.forEach(v => { const t = line ? line + '  ' + v : v; if (tw(g, t, 15, 400, FM) > GRID.w - 50) { rows.push(line); line = v; } else line = t; });
          rows.push(line);
          rows.slice(0, 4).forEach((l, r) => txt(g, l + (r === 3 ? ' …' : ''), x + 24, y + 68 + r * 27, { size: 15, fam: FM, color: COL.soft }));
        });
        g.restore();
      });
      HITS.push({ x, y, w: GRID.w, h: GRID.h, kind: 'doc', i });
    });
    // 어떤 짝이 닮았을까? (카드 사이의 물음표)
    const qs = [[452.5, 253], [827.5, 253], [452.5, 461], [827.5, 461], [265, 362], [640, 362], [1015, 362]];
    const qa = 1 - ramp(u, 10.6, 0.6);
    qs.forEach(([x, y], k) => {
      const a = ramp(u, 5.9 + k * 0.25, 0.4) * qa;
      fade(g, a, () => {
        g.beginPath(); g.arc(x, y, 17 * (0.6 + 0.4 * a), 0, Math.PI * 2); g.fillStyle = COL.bg; g.fill();
        g.strokeStyle = COL.accent; g.lineWidth = 2; g.stroke();
        txt(g, '?', x, y + 1, { size: 19, weight: 700, color: COL.accent, align: 'center' });
      });
    });
    // 16초~: 앞으로 할 일
    const p = ramp(u, 16, 0.6);
    fade(g, p, () => {
      g.fillStyle = 'rgba(18,22,29,0.86)'; g.fillRect(0, 140, W, H - 140);
      const steps = ['줄거리', '단어 세기', 'TF × IDF', '벡터', '거리 · 유사도'];
      const bw = 176, gap = 52, x0 = (W - (steps.length * bw + (steps.length - 1) * gap)) / 2, y = 330;
      steps.forEach((s, k) => {
        const a = ramp(u, 16.3 + k * 0.45, 0.5);
        fade(g, a, () => {
          const x = x0 + k * (bw + gap);
          rr(g, x, y - 34, bw, 68, 12); g.fillStyle = k === 2 || k === 4 ? COL.panel2 : COL.panel; g.fill();
          g.strokeStyle = k === 2 || k === 4 ? COL.accent : COL.faint; g.lineWidth = 1.5; g.stroke();
          txt(g, s, x + bw / 2, y, { size: 21, weight: 700, align: 'center', color: k === 2 || k === 4 ? COL.accent : COL.text });
          if (k) arrow(g, x - gap + 8, y, x - 8, y, COL.line, 2, 10);
        });
      });
    });
  }

  /* ---------- 01 단어 가방 ---------- */
  const DTM_COLS = ['춘향', '몽룡', '사랑', '이별', '운영', '아버지', '심청', '계모', '자매', '콩쥐', '제비', '벌', '이야기'];
  function bagLayout(g, d) {
    const seen = [], first = {};
    D[d].tokens.forEach(t => { if (!(t in first)) { first[t] = seen.length; seen.push(t); } });
    const box = { x: 690, y: 150, w: 510, h: 386 };
    let x = box.x + 22, y = box.y + 66;
    const chips = seen.map(w => {
      const cw = tw(g, w, 19, 600) + 52;
      if (x + cw > box.x + box.w - 18) { x = box.x + 22; y += 50; }
      const c = { w, x, y, cw };
      x += cw + 10;
      return c;
    });
    return { box, chips, index: first };
  }
  function sceneBag(g, u) {
    const d = S.doc, doc = D[d];
    const out = 1 - ramp(u, 12, 0.8);
    fade(g, out, () => {
      docCard(g, d, 80, 150, 568, 386);
      const L = layoutMarked(g, doc, 516, 23), lx = 104, ly = 220, lh = 40;
      const pos = [];
      L.forEach(p => {
        const on = p.k >= 0 ? ramp(u, 0.6 + p.k * 0.2, 0.3) : 0;
        const x = lx + p.x, y = ly + p.line * lh;
        if (p.k >= 0) pos[p.k] = [x + p.w / 2, y];
        if (on > 0) { g.fillStyle = `rgba(255,203,107,${0.16 * on})`; rr(g, x - 2, y - 16, p.w + 4, 32, 5); g.fill(); g.fillStyle = COL.accent; g.fillRect(x, y + 14, p.w * on, 2); }
        txt(g, p.s, x, y, { size: 23, color: p.k >= 0 && on > 0.5 ? COL.text : COL.soft });
      });
      // 단어 가방
      const bagA = ramp(u, 5.6, 0.6);
      const B = bagLayout(g, d), counts = {};
      fade(g, bagA, () => {
        rr(g, B.box.x, B.box.y, B.box.w, B.box.h, 16); g.fillStyle = COL.panel; g.fill();
        g.save(); g.setLineDash([6, 6]); g.strokeStyle = COL.line; g.lineWidth = 1.5; rr(g, B.box.x, B.box.y, B.box.w, B.box.h, 16); g.stroke(); g.restore();
        txt(g, '단어 가방', B.box.x + 22, B.box.y + 32, { size: 21, weight: 700, fam: FD });
        txt(g, 'bag of words · 순서는 버리고 개수만', B.box.x + 128, B.box.y + 33, { size: 14, color: COL.muted });
      });
      const flying = [];
      doc.tokens.forEach((w, k) => {
        const p = clamp((u - (6.2 + k * 0.2)) / 0.55);
        if (p >= 1) counts[w] = (counts[w] || 0) + 1;
        else if (p > 0) flying.push({ w, k, p });
      });
      B.chips.forEach(c => {
        const n = counts[c.w] || 0;
        fade(g, n > 0 ? bagA : 0, () => {
          rr(g, c.x, c.y - 19, c.cw, 38, 19); g.fillStyle = COL.panel2; g.fill();
          txt(g, c.w, c.x + 16, c.y, { size: 19, weight: 600 });
          g.beginPath(); g.arc(c.x + c.cw - 20, c.y, 13, 0, Math.PI * 2); g.fillStyle = n > 1 ? COL.accent : COL.dim; g.fill();
          txt(g, n, c.x + c.cw - 20, c.y + 1, { size: 15, weight: 700, fam: FM, color: n > 1 ? COL.bg : COL.text, align: 'center' });
        });
      });
      flying.forEach(({ w, k, p }) => {
        const c = B.chips[B.index[w]], from = pos[k] || [lx, ly], e = ease(p);
        const x = lerp(from[0], c.x + c.cw / 2, e), y = lerp(from[1], c.y, e) - Math.sin(Math.PI * e) * 60;
        txt(g, w, x, y, { size: 19, weight: 700, color: COL.accent, align: 'center' });
      });
    });
    fade(g, ramp(u, 12.6, 0.6), () => sceneDTM(g, u - 12.6));
  }
  function sceneDTM(g, v) {
    const x0 = 262, cw = 66, y0 = 214, rh = 47;
    txt(g, `문서-단어 행렬 · 문서 ${M.N}개 × 단어 ${M.V}개`, 80, 158, { size: 18, weight: 600, color: COL.soft });
    DTM_COLS.forEach((w, c) => txt(g, w, x0 + c * cw + cw / 2, y0 - 26, { size: 16, weight: 600, align: 'center', color: COL.soft }));
    txt(g, `… ${M.V - DTM_COLS.length}개 더`, x0 + DTM_COLS.length * cw + 12, y0 - 26, { size: 14, color: COL.muted });
    D.forEach((d, r) => {
      const a = ramp(v, r * 0.35, 0.4), y = y0 + r * rh;
      fade(g, a, () => {
        g.fillStyle = d.dark; rr(g, 80, y + 2, 5, rh - 14, 2); g.fill();
        txt(g, d.title, 96, y + rh / 2 - 4, { size: 18, weight: 600 });
        DTM_COLS.forEach((w, c) => {
          const n = M.tf[r][ix(w)], x = x0 + c * cw;
          if (n) { rr(g, x + 4, y, cw - 8, rh - 8, 7); g.fillStyle = `rgba(236,239,243,${0.07 + 0.07 * n})`; g.fill(); }
          txt(g, n, x + cw / 2, y + rh / 2 - 4, { size: 18, fam: FM, weight: n ? 500 : 400, align: 'center', color: n ? COL.text : COL.dim });
        });
        txt(g, '…', x0 + DTM_COLS.length * cw + 30, y + rh / 2 - 4, { size: 18, color: COL.dim, align: 'center' });
      });
    });
    // 줄 = 문서, 칸 = 단어 (자막의 예: 춘향전 줄, ‘사랑’ 칸)
    const ra = ramp(v, 7.6, 0.5), ca = ramp(v, 9.4, 0.5), cella = ramp(v, 11.2, 0.5);
    const colX = x0 + DTM_COLS.indexOf('사랑') * cw;
    fade(g, ra, () => { g.strokeStyle = COL.accent; g.lineWidth = 2; rr(g, 74, y0 - 6, x0 + DTM_COLS.length * cw - 74 + 50, rh, 9); g.stroke(); txt(g, '줄 = 문서', x0 + DTM_COLS.length * cw + 60, y0 + 16, { size: 15, weight: 700, color: COL.accent }); });
    fade(g, ca, () => { g.strokeStyle = COL.accent; g.lineWidth = 2; rr(g, colX + 1, y0 - 48, cw - 2, D.length * rh + 46, 9); g.stroke(); txt(g, '칸 = 단어', colX + cw / 2, y0 + D.length * rh + 14, { size: 15, weight: 700, color: COL.accent, align: 'center' }); });
    fade(g, cella, () => {
      const x = colX + cw / 2, y = y0 + rh / 2 - 4;
      g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.strokeStyle = COL.accent; g.lineWidth = 3; g.stroke();
    });
  }

  /* ---------- 02 TF ---------- */
  function barsTF(g, d, u, hl) {
    const order = M.top(d, null, 'tf'), n = order.length, rh = Math.min(30, 372 / n), y0 = 176, lx = 236, bx = 252, unit = 76;
    txt(g, `${D[d].title}의 TF`, 80, 150, { size: 18, weight: 600, color: COL.soft });
    order.forEach((v, r) => {
      const y = y0 + r * rh, c = M.tf[d][v], grow = ramp(u, 0.5 + r * 0.07, 0.6), on = hl(M.vocab[v], r);
      txt(g, M.vocab[v], lx, y, { size: Math.min(18, rh * 0.62), weight: on ? 700 : 500, align: 'right', color: on ? COL.accent : COL.text });
      rr(g, bx, y - rh * 0.32, Math.max(2, c * unit * grow), rh * 0.64, 4); g.fillStyle = on ? COL.accent : COL.bar; g.fill();
      fade(g, grow, () => txt(g, c, bx + c * unit * grow + 10, y + 1, { size: Math.min(16, rh * 0.55), fam: FM, color: on ? COL.accent : COL.muted }));
    });
  }
  function sceneTF(g, u) {
    const d = S.doc;
    barsTF(g, d, u, (w, r) => (u > 6 && u < 12 && r < 2) || (u >= 12 && w === '이야기'));
    const px = 740;
    fade(g, ramp(u, 0.6, 0.6) * (1 - ramp(u, 11.6, 0.5)), () => {
      panelBox(g, px, 170, 440, 150);
      txt(g, 'TF (Term Frequency)', px + 24, 206, { size: 17, weight: 600, fam: FM, color: COL.accent });
      txt(g, '단어 빈도 = 한 문서 안에서', px + 24, 248, { size: 22, weight: 700 });
      txt(g, '그 단어가 나온 횟수', px + 24, 282, { size: 22, weight: 700 });
    });
    fade(g, ramp(u, 6.4, 0.5) * (1 - ramp(u, 11.6, 0.5)), () => txt(g, '자주 나올수록 중요한 단어?', px + 24, 372, { size: 22, weight: 700, color: COL.accent }));
    // ‘이야기’는 여섯 편 모두에
    fade(g, ramp(u, 12, 0.6), () => {
      txt(g, '‘이야기’가 나오는 문서', px, 186, { size: 20, weight: 700 });
      D.forEach((doc, i) => {
        const x = px + (i % 2) * 222, y = 214 + Math.floor(i / 2) * 64, a = ramp(u, 12.6 + i * 0.35, 0.4);
        rr(g, x, y, 206, 50, 10); g.fillStyle = COL.panel; g.fill();
        g.fillStyle = doc.dark; rr(g, x + 10, y + 13, 5, 24, 2.5); g.fill();
        txt(g, doc.title, x + 26, y + 25, { size: 18, weight: 600 });
        fade(g, a, () => check(g, x + 180, y + 25, 18, COL.accent));
      });
      fade(g, ramp(u, 15.2, 0.5), () => txt(g, `여섯 편 모두에 나오는 단어 — 어느 문서의 특징도 아님`, px, 434, { size: 17, color: COL.muted }));
    });
    fade(g, ramp(u, 20.2, 0.6), () => {
      txt(g, '→ 몇 개의 문서에 나올까?', px, 486, { size: 24, weight: 700, color: COL.accent });
    });
  }

  /* ---------- 03 DF와 IDF ---------- */
  function sceneIDF(g, u) {
    const words = ['이야기', '사랑', '제비'];
    if (S.word && words.indexOf(S.word) < 0 && ix(S.word) != null) words.push(S.word);
    const y0 = 182, rh = 56, sx = 214, ss = 40, sg = 48;
    txt(g, '단어가 나온 문서', sx, 150, { size: 15, color: COL.muted });
    words.forEach((w, r) => {
      const v = ix(w), y = y0 + r * rh, a = ramp(u, 0.4 + r * 0.4, 0.5);
      fade(g, a, () => {
        txt(g, w, 80, y, { size: 22, weight: 700, color: r >= 3 ? COL.accent : COL.text });
        D.forEach((doc, i) => {
          const x = sx + i * sg, on = M.tf[i][v] > 0;
          // 직접 고른 단어(넷째 줄)는 바로 채우고, 영상의 세 단어는 자막에 맞춰 차례로 채움
          const fill = !on ? 0 : r >= 3 ? 1 : ramp(u, 6 + r * 2.2 + i * 0.1, 0.35);
          rr(g, x, y - ss / 2, ss, ss, 8); g.strokeStyle = COL.faint; g.lineWidth = 1.5; g.stroke();
          fade(g, fill, () => { rr(g, x, y - ss / 2, ss, ss, 8); g.fillStyle = doc.dark; g.fill(); txt(g, SHORT[i][0], x + ss / 2, y + 1, { size: 15, weight: 700, color: '#10141A', align: 'center' }); });
        });
        const dfShown = r >= 3 || u > 6 + r * 2.2 + 0.8;
        fade(g, dfShown ? 1 : 0, () => txt(g, `DF = ${M.df[v]}`, sx + 6 * sg + 14, y, { size: 19, weight: 700, fam: FM, color: COL.soft }));
      });
    });
    // IDF 공식
    const fx = 676;
    fade(g, ramp(u, 13.2, 0.6), () => {
      panelBox(g, fx, 150, 520, 110);
      txt(g, 'IDF = ln( N ÷ DF )', fx + 26, 196, { size: 30, weight: 600, fam: FM, color: COL.accent });
      txt(g, `N = 전체 문서 수 = ${M.N}`, fx + 26, 236, { size: 17, color: COL.muted });
    });
    words.forEach((w, r) => {
      const v = ix(w), y = 292 + r * 36, a = r >= 3 ? ramp(u, 21, 0.5) : ramp(u, 21.2 + r * 1.4, 0.5);
      fade(g, a, () => {
        txt(g, `${w}:`, fx + 26, y, { size: 18, weight: 600, color: r >= 3 ? COL.accent : COL.soft });
        txt(g, `ln(${M.N} ÷ ${M.df[v]}) = ${f2(M.idf[v])}`, fx + 140, y, { size: 20, fam: FM, weight: 500, color: COL.text });
      });
    });
    // IDF 곡선
    const gx = 230, gy = 548, gw = 340, gu = 74, ga = ramp(u, 28, 0.6);
    const xOf = df => gx + (df - 1) / (M.N - 1) * gw, yOf = idf => gy - idf * gu;
    fade(g, ga, () => {
      g.strokeStyle = COL.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(gx - 16, gy); g.lineTo(gx + gw + 16, gy); g.moveTo(gx - 16, gy); g.lineTo(gx - 16, gy - 2 * gu - 4); g.stroke();
      for (let k = 1; k <= M.N; k++) txt(g, k, xOf(k), gy + 16, { size: 13, fam: FM, color: COL.dim, align: 'center' });
      txt(g, 'DF →', gx + gw + 22, gy + 16, { size: 13, fam: FM, color: COL.muted });
      [0, 1].forEach(k => txt(g, k, gx - 24, yOf(k), { size: 13, fam: FM, color: COL.dim, align: 'right' }));
      txt(g, 'IDF', gx - 24, gy - 2 * gu - 10, { size: 13, fam: FM, color: COL.muted, align: 'right' });
      const cp = ramp(u, 28.4, 1.6);
      g.strokeStyle = COL.accent; g.lineWidth = 2.5; g.beginPath();
      for (let s = 0; s <= 60 * cp; s++) { const df = 1 + (M.N - 1) * s / 60, x = xOf(df), y = yOf(Math.log(M.N / df)); s ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      const groups = {};
      M.df.forEach((n, v) => { (groups[n] = groups[n] || []).push(M.vocab[v]); });
      Object.keys(groups).forEach((n, k) => {
        n = +n;
        const a = ramp(u, 29.6 + k * 0.4, 0.4), x = xOf(n), y = yOf(Math.log(M.N / n)), ws = groups[n];
        fade(g, a, () => {
          g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fillStyle = COL.text; g.fill();
          const label = ws.length > 2 ? `단어 ${ws.length}개` : ws.join(', ');
          txt(g, label, x + (n === 1 ? 12 : 0), y - (n === 1 ? 0 : 16), { size: 14, weight: 600, color: COL.soft, align: n === 1 ? 'left' : 'center' });
        });
      });
    });
    // 로그를 쓰는 까닭
    fade(g, ramp(u, 34, 0.6), () => {
      panelBox(g, fx, 438, 520, 128);
      txt(g, '문서 100만 개 중 1개에만 나오는 단어라면', fx + 24, 472, { size: 17, color: COL.soft });
      txt(g, 'N ÷ DF = 1,000,000', fx + 24, 506, { size: 19, fam: FM, color: COL.muted });
      txt(g, `ln(1,000,000) ≈ ${f2(Math.log(1e6))}`, fx + 24, 540, { size: 19, fam: FM, weight: 600, color: COL.accent });
    });
  }

  /* ---------- 04 TF-IDF ---------- */
  function sceneTFIDF(g, u) {
    const d = S.doc;
    fade(g, 1 - ramp(u, 26.4, 0.6), () => {
      const byTF = M.top(d, null, 'tf'), byW = M.top(d, null), n = byTF.length, rh = Math.min(30, 380 / n), y0 = 192;
      const rankTF = {}, rankW = {};
      byTF.forEach((v, r) => { rankTF[v] = r; });
      byW.forEach((v, r) => { rankW[v] = r; });
      const showIdf = ramp(u, 6.4, 0.8), p = ramp(u, 13, 2.6), unitTF = 100, unitW = 400 / WMAX;
      const cx = { word: 236, tf: 284, x: 322, idf: 372, eq: 428, bar: 456 };
      txt(g, `${D[d].title}`, 80, 152, { size: 18, weight: 600, color: COL.soft });
      txt(g, 'TF', cx.tf, 160, { size: 15, weight: 600, fam: FM, color: COL.muted, align: 'center' });
      fade(g, showIdf, () => txt(g, 'IDF', cx.idf, 160, { size: 15, weight: 600, fam: FM, color: COL.muted, align: 'center' }));
      txt(g, p > 0.5 ? 'TF-IDF' : 'TF', cx.bar, 160, { size: 15, weight: 600, fam: FM, color: p > 0.5 ? COL.accent : COL.muted });
      byTF.forEach(v => {
        const r = lerp(rankTF[v], rankW[v], p), y = y0 + r * rh, c = M.tf[d][v], w = RAWW[d][v];
        const top = p > 0.95 && rankW[v] < 3, zero = p > 0.95 && w < 1e-9, fs = Math.min(18, rh * 0.62);
        txt(g, M.vocab[v], cx.word, y, { size: fs, weight: top ? 700 : 500, align: 'right', color: top ? COL.accent : zero ? COL.dim : COL.text });
        txt(g, c, cx.tf, y, { size: fs - 1, fam: FM, color: COL.muted, align: 'center' });
        fade(g, showIdf, () => {
          txt(g, '×', cx.x, y, { size: fs - 1, color: COL.dim, align: 'center' });
          txt(g, f2(M.idf[v]), cx.idf, y, { size: fs - 1, fam: FM, color: M.idf[v] < 1e-9 ? COL.dim : COL.soft, align: 'center' });
          txt(g, '=', cx.eq, y, { size: fs - 1, color: COL.dim, align: 'center' });
        });
        const len = lerp(c * unitTF * ramp(u, 0.3, 0.6), w * unitW, p);
        rr(g, cx.bar, y - rh * 0.32, Math.max(2, len), rh * 0.64, 4); g.fillStyle = top ? COL.accent : zero ? COL.dim : COL.bar; g.fill();
        txt(g, p > 0.5 ? f2(w) : c, cx.bar + len + 10, y + 1, { size: fs - 2, fam: FM, color: top ? COL.accent : COL.muted });
      });
      fade(g, ramp(u, 0.8, 0.6), () => {
        const px = 930;
        panelBox(g, px, 170, 270, 210);
        txt(g, 'TF-IDF', px + 22, 204, { size: 18, weight: 600, fam: FM, color: COL.accent });
        txt(g, '= TF × IDF', px + 22, 238, { size: 24, weight: 600, fam: FM });
        txt(g, '이 문서에 자주 나오고 (TF↑)', px + 22, 290, { size: 16, color: COL.soft });
        txt(g, '다른 문서에는 드문 (IDF↑)', px + 22, 320, { size: 16, color: COL.soft });
        txt(g, '단어일수록 커요', px + 22, 350, { size: 16, color: COL.soft });
      });
      fade(g, ramp(u, 13.2, 0.5), () => {
        const px = 930;
        panelBox(g, px, 400, 270, 120);
        txt(g, '위로: 이 문서만의 단어', px + 22, 436, { size: 16, weight: 600, color: COL.accent });
        txt(g, '아래로: 다른 문서에도', px + 22, 466, { size: 16, color: COL.soft });
        txt(g, '0: 모든 문서에 있는 단어', px + 22, 496, { size: 16, color: COL.muted });
      });
    });
    // 문서마다 특징어
    D.forEach((doc, i) => {
      const x = GRID.x[i % 3], y = GRID.y[Math.floor(i / 3)], a = ramp(u, 27 + i * 0.3, 0.5);
      fade(g, a, () => {
        docCard(g, i, x, y, GRID.w, GRID.h, { stroke: u > 35 && (i === 5 || i === 2) ? COL.accent : null });
        txt(g, '특징어', x + GRID.w - 22, y + 31, { size: 13, color: COL.muted, align: 'right' });
        M.top(i, 3).forEach((v, r) => {
          const yy = y + 78 + r * 38, w = RAWW[i][v];
          txt(g, M.vocab[v], x + 26, yy, { size: 20, weight: 700 });
          rr(g, x + 118, yy - 8, w / WMAX * 170, 16, 4); g.fillStyle = r === 0 ? COL.accent : COL.bar; g.fill();
          txt(g, f2(w), x + 126 + w / WMAX * 170, yy + 1, { size: 14, fam: FM, color: COL.muted });
        });
      });
      if (a > 0.5) HITS.push({ x, y, w: GRID.w, h: GRID.h, kind: 'doc', i });
    });
  }

  /* ---------- 05 벡터 ---------- */
  function sceneVector(g, u) {
    const out = 1 - ramp(u, 13.4, 0.6);
    fade(g, out, () => {
      const x0 = 236, cw = 960 / M.V, y0 = 186, rh = 38, gap = 8;
      txt(g, `단어 ${M.V}개 →`, x0, 160, { size: 15, color: COL.muted });
      txt(g, '▲ 여러 문서에 나오는 단어', x0 + 960, 160, { size: 14, color: COL.accent, align: 'right' });
      M.vocab.forEach((w, v) => { if (M.df[v] > 1) { const x = x0 + v * cw + cw / 2; g.fillStyle = COL.accent; g.beginPath(); g.moveTo(x, y0 - 6); g.lineTo(x - 4, y0 - 13); g.lineTo(x + 4, y0 - 13); g.closePath(); g.fill(); } });
      D.forEach((doc, i) => {
        const y = y0 + i * (rh + gap), a = ramp(u, 0.4 + i * 0.3, 0.5);
        fade(g, a, () => {
          txt(g, doc.title, x0 - 14, y + rh / 2, { size: 17, weight: 600, align: 'right' });
          RAWW[i].forEach((val, v) => {
            const x = x0 + v * cw;
            if (val > 1e-9) { g.save(); g.globalAlpha *= 0.25 + 0.75 * val / WMAX; g.fillStyle = doc.dark; g.fillRect(x + 1, y, cw - 2, rh); g.restore(); }
            else { g.fillStyle = 'rgba(236,239,243,0.06)'; g.fillRect(x + 1, y + rh / 2 - 1, cw - 2, 2); }
          });
        });
      });
      fade(g, ramp(u, 3.6, 0.6), () => {
        const vals = RAWW[0].slice(0, 12).map(f2).join(', ');
        txt(g, `춘향전 = [ ${vals}, 0, 0, … ]`, 80, 486, { size: 17, fam: FM, color: COL.soft });
      });
      fade(g, ramp(u, 7, 0.6), () => {
        txt(g, `문서 하나 = ${M.V}칸짜리 숫자 목록 = ${M.V}차원 공간의 화살표 하나`, 80, 532, { size: 22, weight: 700, color: COL.accent });
      });
    });
    const pa = ramp(u, 14, 0.7);
    fade(g, pa, () => {
      axes(g, S.ax, S.ay);
      const shown = [], zero = [];
      D.forEach((doc, i) => { const v = V2(RAWW[i]); (Math.hypot(v[0], v[1]) > 1e-9 ? shown : zero).push(i); });
      shown.forEach((i, k) => vecArrow(g, V2(RAWW[i]), D[i].dark, D[i].title, ramp(u, 15.4 + k * 0.7, 0.9), PL.unit, lbOf(i, k)));
      const px = 880;
      fade(g, ramp(u, 16.8, 0.6), () => {
        panelBox(g, px, 170, 320, 76 + 30 * shown.length + 30 * Math.ceil(zero.length / 2) + 50);
        txt(g, '두 칸만 골라 그린 그림', px + 22, 200, { size: 16, weight: 700, color: COL.accent });
        txt(g, `x: ‘${S.ax}’   y: ‘${S.ay}’`, px + 22, 228, { size: 15, fam: FM, color: COL.muted });
        shown.forEach((i, k) => {
          const v = V2(RAWW[i]);
          g.fillStyle = D[i].dark; rr(g, px + 22, 254 + k * 30, 5, 18, 2); g.fill();
          txt(g, D[i].title, px + 36, 263 + k * 30, { size: 16, weight: 600 });
          txt(g, `(${f2(v[0])}, ${f2(v[1])})`, px + 300, 263 + k * 30, { size: 15, fam: FM, color: COL.soft, align: 'right' });
        });
        if (zero.length) {
          const y = 266 + shown.length * 30;
          txt(g, '원점 (0, 0):', px + 22, y + 10, { size: 15, color: COL.muted });
          zero.forEach((i, k) => txt(g, D[i].title, px + 22 + (k % 2) * 140, y + 40 + Math.floor(k / 2) * 28, { size: 15, color: COL.muted }));
        }
      });
    });
  }

  /* ---------- 06 유클리드 거리 ---------- */
  function rightBars(g, x, y, rows, max, title, hl) {
    txt(g, title, x, y, { size: 16, weight: 700, color: COL.soft });
    rows.forEach((r, k) => {
      const yy = y + 34 + k * 32, on = hl(r);
      txt(g, r.label, x, yy, { size: 15, weight: on ? 700 : 500, color: on ? COL.accent : COL.text });
      rr(g, x + 104, yy - 8, r.value / max * 150, 16, 4); g.fillStyle = on ? COL.accent : COL.bar; g.fill();
      txt(g, f2(r.value), x + 112 + r.value / max * 150, yy + 1, { size: 14, fam: FM, color: on ? COL.accent : COL.muted });
    });
  }
  function sceneEuclid(g, u) {
    axes(g, S.ax, S.ay);
    const a = V2(RAWW[0]), b = V2(RAWW[1]), L = V2(LONG), longP = S.long ? ramp(u, 14, 1.4) : 0;
    vecArrow(g, a, D[0].dark, D[0].title, 1, PL.unit, LB[0]);
    vecArrow(g, b, D[1].dark, D[1].title, 1, PL.unit, LB[1]);
    if (longP > 0) vecArrow(g, L, COL.text, LONG_TITLE, longP, PL.unit, LB.long);
    // 춘향전–운영전
    const [ax_, ay_] = P(a[0], a[1]), [bx_, by_] = P(b[0], b[1]);
    fade(g, ramp(u, 0.6, 0.6) * (1 - ramp(u, 20.6, 0.5)), () => {
      dashed(g, ax_, ay_, bx_, by_, COL.accent, 2.4);
      const d2 = TI.euclid(a, b);
      txt(g, f2(d2), (ax_ + bx_) / 2, (ay_ + by_) / 2 - 16, { size: 16, fam: FM, weight: 600, color: COL.accent, align: 'center' });
    });
    // 춘향전–긴 춘향전 (피타고라스)
    if (S.long) fade(g, ramp(u, 21, 0.6), () => {
      const [lx, ly] = P(L[0], L[1]);
      g.save(); g.setLineDash([4, 5]); g.strokeStyle = COL.muted; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(ax_, ay_); g.lineTo(lx, ay_); g.lineTo(lx, ly); g.stroke(); g.restore();
      dashed(g, ax_, ay_, lx, ly, COL.accent, 2.6);
      txt(g, `Δ ${f2(L[0] - a[0])}`, (ax_ + lx) / 2, ay_ + 16, { size: 14, fam: FM, color: COL.muted, align: 'center' });
      txt(g, `Δ ${f2(L[1] - a[1])}`, lx + 8, (ay_ + ly) / 2, { size: 14, fam: FM, color: COL.muted });
      txt(g, f2(TI.euclid(a, L)), (ax_ + lx) / 2 - 10, (ay_ + ly) / 2 - 16, { size: 16, fam: FM, weight: 600, color: COL.accent, align: 'right' });
    });
    const px = 880;
    fade(g, ramp(u, 6.8, 0.6) * (1 - ramp(u, 20.4, 0.5)), () => {
      panelBox(g, px, 160, 330, 250);
      txt(g, '유클리드 거리', px + 22, 192, { size: 17, weight: 700, color: COL.accent });
      txt(g, '√( (x₁−x₂)² + (y₁−y₂)² + … )', px + 22, 226, { size: 17, fam: FM });
      txt(g, '칸마다 차이를 제곱해 더하고 √', px + 22, 258, { size: 15, color: COL.muted });
      txt(g, `춘향전 ↔ 운영전`, px + 22, 300, { size: 16, weight: 600 });
      txt(g, `그림 속 두 칸: ${f2(TI.euclid(a, b))}`, px + 22, 330, { size: 16, fam: FM, color: COL.soft });
      txt(g, `${M.V}칸 모두: ${f2(TI.euclid(RAWW[0], RAWW[1]))}`, px + 22, 360, { size: 16, fam: FM, weight: 600, color: COL.text });
      txt(g, '실제 계산은 모든 칸으로', px + 22, 390, { size: 14, color: COL.muted });
    });
    fade(g, ramp(u, 21.6, 0.6), () => {
      const rows = D.map((d, i) => ({ label: d.title, value: TI.euclid(RAWW[i], RAWW[0]) })).filter((r, i) => i > 0);
      if (S.long) rows.push({ label: LONG_TITLE, value: TI.euclid(LONG, RAWW[0]), long: true });
      rows.sort((x, y) => x.value - y.value);
      panelBox(g, px, 160, 340, 60 + rows.length * 32);
      rightBars(g, px + 20, 190, rows, Math.max(...rows.map(r => r.value)), `춘향전과의 거리 (${M.V}칸 모두)`, r => r.long);
    });
  }

  /* ---------- 07 코사인 유사도 ---------- */
  function angleArc(g, v1, v2, r, color, unit = PL.unit, label) {
    const t1 = Math.atan2(v1[1], v1[0]), t2 = Math.atan2(v2[1], v2[0]);
    g.strokeStyle = color; g.lineWidth = 2.2; g.beginPath(); g.arc(PL.ox, PL.oy, r, -Math.max(t1, t2), -Math.min(t1, t2)); g.stroke();
    if (label) { const m = (t1 + t2) / 2; txt(g, label, PL.ox + Math.cos(m) * (r + 14), PL.oy - Math.sin(m) * (r + 14), { size: 15, fam: FM, weight: 600, color }); }
  }
  const deg = (v1, v2) => Math.abs(Math.atan2(v1[1], v1[0]) - Math.atan2(v2[1], v2[0])) * 180 / Math.PI;
  function gauge(g, cx, cy, R, angDeg, label) {
    g.strokeStyle = COL.faint; g.lineWidth = 10; g.lineCap = 'butt';
    g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, 0); g.stroke();
    [[0, '1'], [60, '0.5'], [90, '0']].forEach(([dg, c]) => {
      const th = dg * Math.PI / 180, x = cx + Math.cos(th) * (R + 14), y = cy - Math.sin(th) * (R + 14);
      g.strokeStyle = COL.muted; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + Math.cos(th) * (R - 6), cy - Math.sin(th) * (R - 6)); g.lineTo(cx + Math.cos(th) * (R + 6), cy - Math.sin(th) * (R + 6)); g.stroke();
      txt(g, `${dg}° → ${c}`, x + (dg === 0 ? 4 : dg === 90 ? 0 : 6), y - (dg === 90 ? 10 : dg === 60 ? 6 : 0), { size: 13, fam: FM, color: COL.muted, align: dg === 90 ? 'center' : 'left' });
    });
    const th = angDeg * Math.PI / 180;
    arrow(g, cx, cy, cx + Math.cos(th) * (R - 4), cy - Math.sin(th) * (R - 4), COL.accent, 3, 12);
    txt(g, label, cx, cy + 30, { size: 17, fam: FM, weight: 600, color: COL.accent });
  }
  function sceneCosine(g, u) {
    const sw = ramp(u, 21.2, 1.6);                       // y축을 ‘제비’로 바꿈
    const unit = lerp(PL.unit, 50, sw), yw = sw > 0.5 ? '제비' : S.ay;
    const formula = ramp(u, 29, 0.8);
    const planeA = 1 - 0.75 * formula;
    fade(g, planeA, () => {
      axes(g, S.ax, yw, unit, 1, sw > 0 ? Math.abs(sw - 0.5) * 2 : 1);
      const a = V2(RAWW[0], S.ax, yw), b = V2(RAWW[1], S.ax, yw), L = V2(LONG, S.ax, yw);
      const ab = 1 - sw;
      vecArrow(g, a, D[0].dark, D[0].title, 1, unit, sw > 0.5 ? { dx: 0, dy: -16, align: 'right' } : LB[0]);
      fade(g, ab, () => {
        vecArrow(g, b, D[1].dark, D[1].title, 1, unit, LB[1]);
        if (S.long) vecArrow(g, L, COL.text, LONG_TITLE, ramp(u, 14, 1), unit, LB.long);
        fade(g, ramp(u, 0.8, 0.6) * (1 - ramp(u, 14, 0.4)), () => angleArc(g, a, b, 150, COL.accent, unit, `${deg(a, b).toFixed(1)}°`));
        if (S.long) fade(g, ramp(u, 15.4, 0.5), () => txt(g, `각도 0° → 코사인 ${f2(TI.cosine(LONG, RAWW[0]))}`, P(L[0], L[1], unit)[0] - 40, P(L[0], L[1], unit)[1] - 34, { size: 16, weight: 700, color: COL.accent, align: 'right' }));
      });
      // 흥부전: ‘제비’ 축 위로
      fade(g, ramp(u, 22.4, 0.6), () => {
        const h = V2(RAWW[5], S.ax, '제비');
        vecArrow(g, h, D[5].dark, D[5].title, ramp(u, 22.6, 1), unit, LB[5]);
        const s = 18;
        g.strokeStyle = COL.accent; g.lineWidth = 2; g.beginPath(); g.moveTo(PL.ox + s, PL.oy); g.lineTo(PL.ox + s, PL.oy - s); g.lineTo(PL.ox, PL.oy - s); g.stroke();
        fade(g, ramp(u, 24, 0.5), () => txt(g, `직각 90° → 코사인 ${f2(M.cos[0][5])}`, PL.ox + 40, PL.oy - 40, { size: 17, weight: 700, color: COL.accent }));
      });
    });
    // 오른쪽: 각도와 코사인
    fade(g, ramp(u, 7, 0.6) * (1 - formula), () => {
      const a = V2(RAWW[0]), b = V2(RAWW[1]);
      let ang = deg(a, b);
      if (u > 14) ang = lerp(ang, S.long ? 0 : ang, ramp(u, 14, 1));
      if (u > 21.2) ang = lerp(ang, 90, sw);
      panelBox(g, 860, 160, 350, 300);
      txt(g, '각도와 코사인', 882, 192, { size: 17, weight: 700, color: COL.accent });
      gauge(g, 896, 410, 168, ang, `cos ${ang.toFixed(0)}° = ${f2(Math.cos(ang * Math.PI / 180))}`);
    });
    // 계산
    fade(g, formula, () => {
      const x = 470, i = 0, j = 1, sh = M.shared(i, j).filter(s => RAWW[i][s.v] * RAWW[j][s.v] > 1e-9);
      const dotv = TI.dot(RAWW[i], RAWW[j]), la = M.len[i], lb = M.len[j];
      panelBox(g, x - 30, 150, 770, 420);
      txt(g, '코사인 유사도 = (A · B) ÷ ( |A| × |B| )', x, 190, { size: 25, weight: 600, fam: FM, color: COL.accent });
      txt(g, 'A · B (내적) = 칸마다 곱해서 더하기 · |A| = 화살표 길이', x, 226, { size: 16, color: COL.muted });
      txt(g, `${D[i].title} · ${D[j].title}`, x, 276, { size: 19, weight: 700 });
      sh.forEach((s, k) => txt(g, `${s.word}  ${f2(RAWW[i][s.v])} × ${f2(RAWW[j][s.v])} = ${f2(RAWW[i][s.v] * RAWW[j][s.v])}`, x + 20, 312 + k * 30, { size: 18, fam: FM, color: COL.soft }));
      const y = 312 + sh.length * 30;
      txt(g, `나머지 ${M.V - sh.length}칸은 한쪽이 0 → 곱도 0`, x + 20, y, { size: 16, color: COL.muted });
      txt(g, `합 = ${f2(dotv)}`, x + 20, y + 32, { size: 18, fam: FM, weight: 600 });
      fade(g, ramp(u, 31, 0.6), () => {
        txt(g, `${f2(dotv)} ÷ (${f2(la)} × ${f2(lb)}) = ${f2(M.cos[i][j])}`, x, y + 84, { size: 24, fam: FM, weight: 600, color: COL.accent });
      });
      fade(g, ramp(u, 34.6, 0.6), () => {
        txt(g, `그림 속 두 칸만 보면 ${f2(TI.cosine(V2(RAWW[i]), V2(RAWW[j])))} → ${M.V}칸 모두로는 ${f2(M.cos[i][j])}`, x, y + 124, { size: 17, color: COL.soft });
      });
    });
  }

  /* ---------- 08 L2 정규화 ---------- */
  function sceneNorm(g, u) {
    const p = ramp(u, 1.4, 2.6), R = 250;
    const rawUnit = PL.unit, unitNow = lerp(rawUnit, R, p);           // 정규화한 뒤에는 1 = 원의 반지름
    axes(g, S.ax, S.ay, unitNow);
    fade(g, ramp(u, 1.2, 0.8), () => {
      g.save(); g.setLineDash([5, 6]); g.strokeStyle = COL.accent; g.lineWidth = 1.6;
      g.beginPath(); g.arc(PL.ox, PL.oy, R, -Math.PI / 2, 0); g.stroke(); g.restore();
      txt(g, '반지름 1', PL.ox + R * 0.72 + 8, PL.oy - R * 0.72 - 8, { size: 15, weight: 600, color: COL.accent });
    });
    const items = [[V2(RAWW[0]), D[0].dark, D[0].title, LB[0]], [V2(RAWW[1]), D[1].dark, D[1].title, LB[1]]];
    if (S.long) items.push([V2(LONG), COL.text, LONG_TITLE, LB.long]);
    items.forEach(([v, color, label, o], k) => {
      const len = Math.hypot(v[0], v[1]);
      if (len < 1e-9) return;
      // 두 칸짜리 그림에서 길이를 1로: 화면 위 길이를 원래 길이에서 반지름 R까지 바꿈
      const px = [lerp(v[0] * rawUnit, v[0] / len * R, p), lerp(v[1] * rawUnit, v[1] / len * R, p)];
      const show = k === 2 && p > 0.95 ? null : label;
      vecArrow(g, [px[0] / unitNow, px[1] / unitNow], color, show, 1, unitNow, o);
    });
    fade(g, ramp(u, 4.4, 0.6), () => txt(g, `그림: ‘${S.ax}’, ‘${S.ay}’ 두 칸만 있다고 할 때 · 실제로는 ${M.V}칸 전체 길이로 나눠요`, PL.ox, PL.oy + 64, { size: 14, color: COL.muted }));
    const px = 860;
    fade(g, ramp(u, 0.6, 0.6) * (1 - ramp(u, 13.4, 0.5)), () => {
      const rows = D.map((d, i) => ({ t: d.title, len: M.len[i] }));
      if (S.long) rows.push({ t: LONG_TITLE, len: TI.norm(LONG) });
      panelBox(g, px, 160, 350, 70 + rows.length * 32);
      txt(g, `화살표 길이 (${M.V}칸 전체)`, px + 22, 192, { size: 16, weight: 700, color: COL.accent });
      rows.forEach((r, k) => {
        const y = 230 + k * 32;
        txt(g, r.t, px + 22, y, { size: 16, weight: 600 });
        txt(g, f2(lerp(r.len, 1, p)), px + 220, y, { size: 16, fam: FM, color: p > 0.98 ? COL.accent : COL.soft, align: 'right' });
        txt(g, p > 0.98 ? '= 1' : `÷ ${f2(r.len)}`, px + 236, y, { size: 14, fam: FM, color: COL.muted });
      });
    });
    fade(g, ramp(u, 14, 0.6), () => {
      const pairs = [[0, 1, D[1].title], [0, 5, D[5].title]];
      panelBox(g, px, 160, 350, 266);
      txt(g, '거리 = √(2 − 2 × 코사인)', px + 22, 194, { size: 19, weight: 600, fam: FM, color: COL.accent });
      txt(g, '춘향전과 …', px + 22, 230, { size: 15, color: COL.muted });
      const rows = pairs.map(([i, j, t]) => ({ t, c: M.cos[i][j], d: M.dist[i][j] }));
      if (S.long) rows.splice(1, 0, { t: LONG_TITLE, c: TI.cosine(LONG, RAWW[0]), d: TI.euclid(TI.unit(LONG), M.u[0]) });
      txt(g, '코사인', px + 220, 230, { size: 13, color: COL.muted, align: 'right' });
      txt(g, '거리', px + 320, 230, { size: 13, color: COL.muted, align: 'right' });
      rows.forEach((r, k) => {
        const y = 266 + k * 34, a = ramp(u, 15 + k * 0.8, 0.4);
        fade(g, a, () => {
          txt(g, r.t, px + 22, y, { size: 16, weight: 600 });
          txt(g, f2(r.c), px + 220, y, { size: 16, fam: FM, color: COL.soft, align: 'right' });
          txt(g, f2(r.d), px + 320, y, { size: 16, fam: FM, weight: 600, color: COL.text, align: 'right' });
        });
      });
      txt(g, '코사인이 클수록 거리가 짧아요', px + 22, 266 + rows.length * 34 + 10, { size: 14, color: COL.muted });
    });
    fade(g, ramp(u, 21, 0.6), () => {
      panelBox(g, px, 450, 350, 96);
      txt(g, 'TfidfVectorizer(norm="l2")', px + 22, 486, { size: 17, fam: FM, weight: 500, color: COL.text });
      txt(g, '← 기본값: 처음부터 길이 1', px + 22, 518, { size: 15, color: COL.accent });
    });
  }

  /* ---------- 09 관계: 유사도 표와 네트워크 ---------- */
  const NODES = [[800, 248], [990, 222], [752, 470], [900, 418], [1050, 472], [1160, 398]];
  function sceneMap(g, u) {
    const x0 = 214, y0 = 204, cs = 60, n = D.length;
    const offMax = Math.max(...M.cos.flatMap((r, i) => r.filter((x, j) => j !== i)));
    txt(g, '코사인 유사도 (모든 단어)', 80, 150, { size: 18, weight: 600, color: COL.soft });
    fade(g, ramp(u, 3, 0.5), () => {
      const lx = 330;
      for (let s = 0; s < 80; s++) { g.fillStyle = shade(s / 79); g.fillRect(lx + s * 1.6, 144, 1.7, 12); }
      txt(g, '0', lx - 8, 150, { size: 13, fam: FM, color: COL.muted, align: 'right' });
      txt(g, `${f2(offMax)} · 밝을수록 닮음`, lx + 136, 150, { size: 13, fam: FM, color: COL.muted });
    });
    D.forEach((d, i) => {
      txt(g, SHORT[i], x0 - 12, y0 + i * cs + cs / 2, { size: 15, weight: 600, align: 'right' });
      g.save(); g.translate(x0 + i * cs + cs / 2, y0 - 10); g.rotate(-Math.PI / 5);
      txt(g, SHORT[i], 0, 0, { size: 15, weight: 600 });
      g.restore();
    });
    const pairs = [[0, 1], [3, 4]], hlPair = ramp(u, 14, 0.5);
    const isHl = (i, j) => pairs.some(([a, b]) => (a === i && b === j) || (a === j && b === i));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const k = i * n + j, a = ramp(u, 0.4 + k * 0.05, 0.3), x = x0 + j * cs, y = y0 + i * cs, c = M.cos[i][j];
      fade(g, a, () => {
        rr(g, x + 2, y + 2, cs - 4, cs - 4, 6);
        if (i === j) { g.fillStyle = COL.panel2; g.fill(); }
        else { const p = c / offMax; g.fillStyle = shade(p); g.fill(); }
        const light = i !== j && c / offMax > 0.55;
        txt(g, i === j ? '1' : f2(c), x + cs / 2, y + cs / 2 + 1, { size: 15, fam: FM, weight: 600, align: 'center', color: i === j ? COL.dim : light ? '#10141A' : COL.soft });
        const sel = S.pair && ((S.pair[0] === i && S.pair[1] === j) || (S.pair[0] === j && S.pair[1] === i));
        if (sel || (hlPair > 0 && isHl(i, j))) { g.save(); g.globalAlpha *= sel ? 1 : hlPair; rr(g, x + 2, y + 2, cs - 4, cs - 4, 6); g.strokeStyle = COL.accent; g.lineWidth = 3; g.stroke(); g.restore(); }
      });
      if (i !== j) HITS.push({ x: x + 2, y: y + 2, w: cs - 4, h: cs - 4, kind: 'pair', i, j });
    }
    // 대각선
    fade(g, ramp(u, 7, 0.5) * (1 - ramp(u, 13.6, 0.5)), () => {
      g.save(); g.setLineDash([6, 6]); g.strokeStyle = COL.accent; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + n * cs, y0 + n * cs); g.stroke(); g.restore();
      txt(g, '자기 자신 = 1', x0 + n * cs - 6, y0 + n * cs + 22, { size: 15, weight: 600, color: COL.accent, align: 'right' });
    });
    // 함께 쓰는 단어
    fade(g, ramp(u, 21, 0.6) * (1 - ramp(u, 27.4, 0.5)), () => {
      panelBox(g, 690, 170, 510, 250);
      pairs.forEach(([i, j], k) => {
        const y = 210 + k * 112, sh = M.shared(i, j).filter(s => s.part > 1e-9);
        txt(g, `${D[i].title} ↔ ${D[j].title}   ${f2(M.cos[i][j])}`, 714, y, { size: 18, weight: 700, color: COL.accent });
        txt(g, '함께 쓰는 단어: ' + sh.map(s => s.word).join(', '), 714, y + 36, { size: 17, color: COL.text });
        const zero = M.shared(i, j).filter(s => s.part <= 1e-9).map(s => s.word);
        if (zero.length) txt(g, `(${zero.join(', ')}: 모든 문서에 있어 IDF 0)`, 714, y + 66, { size: 14, color: COL.muted });
      });
    });
    // 네트워크
    const na = ramp(u, 28, 0.6);
    fade(g, na, () => {
      // 무리
      fade(g, ramp(u, 35, 0.8), () => {
        [[[0, 1], '사랑 이야기'], [[2, 3, 4, 5], '계모와 가족 이야기']].forEach(([ids, label]) => {
          const xs = ids.map(i => NODES[i][0]), ys = ids.map(i => NODES[i][1]);
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
          const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 70, ry = (Math.max(...ys) - Math.min(...ys)) / 2 + 52;
          g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = 'rgba(255,203,107,0.06)'; g.fill();
          g.save(); g.setLineDash([5, 6]); g.strokeStyle = 'rgba(255,203,107,0.55)'; g.lineWidth = 1.5; g.stroke(); g.restore();
          if (ids.length === 2) txt(g, label, cx + rx + 10, cy, { size: 16, weight: 700, color: COL.accent });
          else txt(g, label, cx, cy + ry + 18, { size: 16, weight: 700, color: COL.accent, align: 'center' });
        });
      });
      let e = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const c = M.cos[i][j];
        if (!(c > S.th + 1e-9)) continue;
        const p = ramp(u, 28.6 + e * 0.35, 0.6); e++;
        const [x1, y1] = NODES[i], [x2, y2] = NODES[j], sel = S.pair && S.pair.indexOf(i) >= 0 && S.pair.indexOf(j) >= 0;
        g.strokeStyle = sel ? COL.accent : `rgba(236,239,243,${0.35 + 0.5 * c / offMax})`; g.lineWidth = Math.max(1.2, c / offMax * 9); g.lineCap = 'round';
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(lerp(x1, x2, p), lerp(y1, y2, p)); g.stroke();
        fade(g, ramp(u, 29.2 + e * 0.35, 0.4), () => {
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          rr(g, mx - 22, my - 11, 44, 22, 6); g.fillStyle = COL.bg; g.fill();
          txt(g, f2(c), mx, my + 1, { size: 13, fam: FM, color: sel ? COL.accent : COL.soft, align: 'center' });
        });
      }
      D.forEach((d, i) => {
        const [x, y] = NODES[i];
        g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.fillStyle = d.dark; g.fill();
        g.strokeStyle = COL.bg; g.lineWidth = 3; g.stroke();
        txt(g, d.title, x, y + 32, { size: 16, weight: 700, align: 'center' });
      });
      txt(g, S.th > 0 ? `코사인 유사도 > ${f2(S.th)}인 짝만 이음` : '코사인 유사도 > 0인 짝을 이음 · 굵을수록 닮음', 690, 156, { size: 14, color: COL.muted });
    });
  }

  /* ---------- 10 정리 ---------- */
  function sceneOutro(g, u) {
    const steps = [['명사 고르기', '형태소 분석'], ['단어 세기', 'TF'], ['흔한 단어 덜기', '× IDF'], ['벡터로', '길이 1 (L2)'], ['관계 재기', '코사인 · 거리']];
    const bw = 200, gap = 30, x0 = (W - (steps.length * bw + (steps.length - 1) * gap)) / 2, y = 222;
    steps.forEach(([a, b], k) => {
      const al = ramp(u, 0.6 + k * 0.7, 0.5), x = x0 + k * (bw + gap);
      fade(g, al, () => {
        rr(g, x, y - 46, bw, 92, 12); g.fillStyle = COL.panel; g.fill();
        txt(g, `${k + 1}`, x + 18, y - 22, { size: 14, fam: FM, color: COL.accent });
        txt(g, a, x + bw / 2, y - 2, { size: 20, weight: 700, align: 'center' });
        txt(g, b, x + bw / 2, y + 26, { size: 15, fam: FM, color: COL.soft, align: 'center' });
        if (k) arrow(g, x - gap + 4, y, x - 5, y, COL.line, 2, 9);
      });
    });
    fade(g, ramp(u, 7.4, 0.8), () => {
      const cx = 140, cy = 312;
      rr(g, cx - 30, cy, 1060, 236, 14); g.fillStyle = '#0D1117'; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1; g.stroke();
      const lines = [
        [['from ', COL.accent], ['sklearn.feature_extraction.text ', COL.text], ['import ', COL.accent], ['TfidfVectorizer', COL.text]],
        [['from ', COL.accent], ['sklearn.metrics.pairwise ', COL.text], ['import ', COL.accent], ['cosine_similarity', COL.text]],
        [],
        [['vec = TfidfVectorizer(analyzer=str.split)', COL.text], ['    # 명사를 띄어쓰기로 이어 붙인 문서', COL.muted]],
        [['X = vec.fit_transform(docs)', COL.text], ['                  # 문서 × 단어, 길이 1', COL.muted]],
        [['sim = cosine_similarity(X)', COL.text], ['                   # 문서 × 문서 유사도 표', COL.muted]],
      ];
      lines.forEach((parts, r) => {
        let x = cx;
        parts.forEach(([s, c]) => { x += txt(g, s, x, cy + 40 + r * 32, { size: 18, fam: FM, color: c }); });
      });
    });
    fade(g, ramp(u, 14.4, 0.6), () => txt(g, '아래 놀이터에서 내 문서로 해 보세요 ↓', W / 2, 574, { size: 22, weight: 700, color: COL.accent, align: 'center' }));
  }

  const SCENES = { intro: sceneIntro, bag: sceneBag, tf: sceneTF, idf: sceneIDF, tfidf: sceneTFIDF, vector: sceneVector, euclid: sceneEuclid, cosine: sceneCosine, norm: sceneNorm, map: sceneMap, outro: sceneOutro };

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
    rr(g, (W - bw) / 2, y0, bw, h, 12); g.fillStyle = 'rgba(6,9,13,0.84)'; g.fill();
    lines.forEach((l, li) => {
      let x = (W - widthOf(l)) / 2;
      l.forEach(o => { txt(g, o.w, x, y0 + 11 + lh * li + lh / 2, { size: 28, weight: o.bold ? 700 : 500, color: o.bold ? COL.accent : COL.text }); x += o.ww; });
    });
  }

  TV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[TV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u);
    g.restore();
    if (opt.caption) drawCaption(g, TV.captionAt(t));
    if (opt.dry) HITS = keep;                 // 글자 모으기용으로 그릴 때는 누를 곳을 바꾸지 않음
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => M.vocab.join('') + D.map(d => d.text + d.title).join('') + CAPTIONS.map(c => c[2]).join('') + '0123456789.,·()[]→↑↓×÷=≈√−';
  TV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set();
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { TV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
  TV.baseText = EXTRA;
})();
