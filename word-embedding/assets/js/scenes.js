/* 워드 임베딩 튜토리얼 — 영상 장면
 *
 * EV.render(g, t)는 시각 t와 사용자 상태 EV.S만으로 그립니다. 같은 t면 언제나 같은 그림이라
 * 되감기와 MP4 추출(tools/render-video.cjs)이 정확합니다. 화면 좌표는 1280×720 기준.
 * 벡터, 유사도, 지도 좌표는 모두 embedding.js의 진짜 계산값이고, 자막 속 숫자와 다르면 콘솔에 경고를 냅니다.
 * 2차원 화살표로 내적을 설명하는 장면(05)만 설명용 그림입니다.
 */
(function () {
  'use strict';
  const WE = window.WE, M = WE.MODEL, D = WE.DATA;
  const EV = (window.EV = {});
  const W = 1280, H = 720;
  EV.W = W; EV.H = H;

  /* ---------- 도우미 ---------- */
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const ramp = (u, start, dur) => ease(clamp((u - start) / dur));
  const f2 = x => WE.fmt(x, 2);
  const FD = '"Hahmlet"', FB = '"IBM Plex Sans KR"', FM = '"IBM Plex Mono"';
  const fnt = (px, w = 400, fam = FB) => `${w} ${px}px ${fam}${fam === FB ? '' : ', ' + FB}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  EV.fonts = { FD, FB, FM, fnt };
  const COL = {
    bg: '#10151B', grid: 'rgba(237,241,244,0.045)', text: '#EDF1F4', soft: '#C5CED6', muted: '#93A0AC', dim: '#5C6875',
    faint: 'rgba(237,241,244,0.14)', line: 'rgba(237,241,244,0.32)', panel: '#18202A', panel2: '#212B37',
    accent: '#6EE7C8', ok: '#7BE0A6', no: '#FF8E8E', neg: '#FF8A7A',
  };
  EV.COL = COL;
  // 단어 묶음과 색 (지도·표에서 같은 색)
  const GROUP = [
    ['royal', '임금과 신하', '#F5C451', ['왕', '임금', '신하', '백성']],
    ['state', '나라', '#FF8A7A', ['조선', '고려', '신라']],
    ['capital', '도읍', '#7AA7FF', ['한양', '개경', '서라벌']],
    ['boat', '배와 물', '#C6A0FF', ['나룻배', '돛단배', '강', '바다']],
    ['fruit', '과일', '#FF9ECF', ['사과', '감', '가을']],
  ];
  const GROUP_OF = {};
  GROUP.forEach(([id, name, color, words]) => words.forEach(w => { GROUP_OF[w] = { id, name, color }; }));
  const wcol = w => (GROUP_OF[w] || { color: '#8B93A1' }).color;
  EV.wcol = wcol; EV.GROUP = GROUP;

  // 사용자 상태 ('직접 해 보기'와 화면 누르기로 바뀜). 영상 추출은 언제나 기본값
  const S = (EV.S = { word: null, epoch: null, analogy: null });
  let HITS = [];
  EV.hits = () => HITS;

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
  function arrow(g, x0, y0, x1, y1, color, lw = 2, head = 10, dash) {
    const ang = Math.atan2(y1 - y0, x1 - x0);
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round';
    if (dash) g.setLineDash(dash);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - Math.cos(ang) * head * 0.7, y1 - Math.sin(ang) * head * 0.7); g.stroke();
    g.setLineDash([]);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - Math.cos(ang - 0.42) * head, y1 - Math.sin(ang - 0.42) * head); g.lineTo(x1 - Math.cos(ang + 0.42) * head, y1 - Math.sin(ang + 0.42) * head); g.closePath(); g.fill();
  }
  function mark(g, ok, x, y, s = 10) {
    g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = ok ? COL.ok : COL.no; g.beginPath();
    if (ok) { g.moveTo(x - s * 0.6, y); g.lineTo(x - s * 0.15, y + s * 0.5); g.lineTo(x + s * 0.7, y - s * 0.55); }
    else { g.moveTo(x - s * 0.55, y - s * 0.55); g.lineTo(x + s * 0.55, y + s * 0.55); g.moveTo(x + s * 0.55, y - s * 0.55); g.lineTo(x - s * 0.55, y + s * 0.55); }
    g.stroke();
  }
  // 낱말 칩. 돌려주는 값: 칩 너비
  function chip(g, w, x, y, o = {}) {
    const size = o.size || 22, cw = tw(g, w, size, 600) + 28, h = size + 18;
    rr(g, x, y - h / 2, cw, h, 10);
    g.fillStyle = o.fill || COL.panel2; g.fill();
    if (o.stroke) { g.strokeStyle = o.stroke; g.lineWidth = o.lw || 2; g.stroke(); }
    txt(g, w, x + cw / 2, y + 1, { size, weight: 600, color: o.color || COL.text, align: 'center' });
    return cw;
  }
  const chipW = (g, w, size = 22) => tw(g, w, size, 600) + 28;
  // 값에 따라 칠한 칸 (양수 민트, 음수 산호색)
  function cellColor(v, maxAbs) {
    const a = clamp(Math.abs(v) / maxAbs) * 0.75 + 0.08;
    return v >= 0 ? `rgba(110,231,200,${a.toFixed(3)})` : `rgba(255,138,122,${a.toFixed(3)})`;
  }
  function vecCells(g, v, x, y, cw, ch, o = {}) {
    const n = o.count == null ? v.length : o.count;
    for (let k = 0; k < v.length; k++) {
      const a = k < n ? 1 : 0;
      if (!a) continue;
      rr(g, x + k * cw, y - ch / 2, cw - 4, ch, 6); g.fillStyle = cellColor(v[k], o.max || 3.2); g.fill();
      if (o.numbers !== false) txt(g, WE.fmt(v[k], o.digits == null ? 1 : o.digits), x + k * cw + (cw - 4) / 2, y + 1, { size: o.size || 14, fam: FM, weight: 500, color: COL.text, align: 'center' });
    }
  }
  // 2차원 점을 상자 안에 같은 비율로 맞추기
  function fitter(pts, box, pad = 40) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    const s = Math.min((box.w - 2 * pad) / (x1 - x0 || 1), (box.h - 2 * pad) / (y1 - y0 || 1));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return ([x, y]) => [box.x + box.w / 2 + (x - cx) * s, box.y + box.h / 2 - (y - cy) * s];
  }
  // 단어 점과 이름표 (겹치지 않게 이름표 자리를 고름)
  function dot(g, w, x, y, r = 7) {
    if (w === '배') {                 // 두 뜻: 반은 배 색, 반은 과일 색
      g.beginPath(); g.arc(x, y, r, Math.PI / 2, Math.PI * 1.5); g.closePath(); g.fillStyle = '#C6A0FF'; g.fill();
      g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2); g.closePath(); g.fillStyle = '#FF9ECF'; g.fill();
      g.beginPath(); g.arc(x, y, r + 2.5, 0, Math.PI * 2); g.strokeStyle = COL.text; g.lineWidth = 1.5; g.stroke();
      return;
    }
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = wcol(w); g.fill();
  }
  function drawPoints(g, words, P, o = {}) {
    const placed = [], size = o.size || 17;
    words.forEach((w, i) => {
      const [x, y] = P[i], a = o.alpha ? o.alpha(i, w) : 1;
      if (a <= 0) return;
      fade(g, a, () => {
        dot(g, w, x, y, o.r || 7);
        const lw = tw(g, w, size, 600), lh = size + 4;
        const cands = [[x + 12, y, 'left'], [x - 12, y, 'right'], [x, y + 20, 'center'], [x, y - 20, 'center'], [x + 12, y + 18, 'left'], [x - 12, y - 18, 'right']];
        const hl = o.highlight && o.highlight.indexOf(w) >= 0;
        let best = null;
        for (const c of cands) {
          const bx = c[2] === 'left' ? c[0] : c[2] === 'right' ? c[0] - lw : c[0] - lw / 2;
          const rect = [bx - 2, c[1] - lh / 2, lw + 4, lh];
          if (!placed.some(q => rect[0] < q[0] + q[2] && q[0] < rect[0] + rect[2] && rect[1] < q[1] + q[3] && q[1] < rect[1] + rect[3]) && !P.some((p, k) => k !== i && p[0] > rect[0] - 4 && p[0] < rect[0] + rect[2] + 4 && p[1] > rect[1] - 4 && p[1] < rect[1] + rect[3] + 4)) { best = c; placed.push(rect); break; }
        }
        if (!best && hl) best = cands[0];          // 자리가 없으면 이름표를 생략 (짚어 말하는 단어는 늘 씀)
        if (best) txt(g, w, best[0], best[1], { size, weight: hl ? 700 : 600, color: hl ? COL.text : (o.labelColor || COL.soft), align: best[2] });
        HITS.push({ x: x - 14, y: y - 14, w: 28, h: 28, kind: 'word', w2: w });
      });
    });
  }
  function legend(g, x, y, ids) {
    let cx = x;
    GROUP.filter(gr => !ids || ids.indexOf(gr[0]) >= 0).forEach(([id, name, color]) => {
      g.beginPath(); g.arc(cx + 6, y, 6, 0, Math.PI * 2); g.fillStyle = color; g.fill();
      cx += 16 + txt(g, name, cx + 16, y + 1, { size: 14, color: COL.muted }) + 18;
    });
    return cx;
  }

  /* ---------- 미리 계산: 지도 ---------- */
  const vecs = (words, W_) => words.map(w => (W_ || M.W)[D.index[w]]);
  const MAPS = {
    learn: WE.pca2(vecs(WE.MAP_LEARN)),
    analogy: WE.pca2(vecs(WE.MAP_ANALOGY)),
    poly: WE.pca2(vecs(WE.MAP_POLY)),
  };
  EV.MAPS = MAPS;
  const learnProj = [];
  const learnAt = e => {               // e번 읽은 뒤의 벡터를 마지막 지도의 축에 올려놓은 좌표 (소수 e는 사이를 이음)
    const f = Math.floor(e), c = Math.min(200, f + 1), p = e - f;
    const get = k => learnProj[k] || (learnProj[k] = WE.project(MAPS.learn, vecs(WE.MAP_LEARN, M.snaps[k])));
    const A = get(f), B = get(c);
    return A.map((pt, i) => [lerp(pt[0], B[i][0], p), lerp(pt[1], B[i][1], p)]);
  };
  EV.learnAt = learnAt;
  const AN = WE.analogy(M, '조선', '한양', '고려', 3, true), AN_BAD = WE.analogy(M, '신라', '서라벌', '고려', 3, true);
  EV.AN = AN; EV.AN_BAD = AN_BAD;
  let SEEDS = null;      // 시드에 따라 달라지는 ‘신하’의 이웃 (처음 그릴 때 계산)
  const seedDemo = () => SEEDS || (SEEDS = [7, 1, 3].map(seed => ({ seed, list: WE.similar(seed === WE.CONFIG.seed ? M : WE.train(D, Object.assign({}, WE.CONFIG, { seed })), '신하', 3, true) })));
  EV.seedDemo = seedDemo;

  /* ---------- 장면 정의 ---------- */
  const CHAPTERS = [
    { id: 'intro', n: '00', title: '들어가며', sub: '단어를 숫자로', t: 0 },
    { id: 'onehot', n: '01', title: '원-핫 인코딩', sub: '칸 하나만 1', t: 20 },
    { id: 'idea', n: '02', title: '분포 가설', sub: '이웃을 보면 뜻이 보인다', t: 46 },
    { id: 'count', n: '03', title: '함께 나오는 단어 세기', sub: '창과 동시 출현 행렬', t: 74 },
    { id: 'dense', n: '04', title: '짧고 촘촘한 벡터', sub: '임베딩', t: 118 },
    { id: 'w2v', n: '05', title: 'word2vec', sub: '이웃 맞히기로 배우기', t: 146 },
    { id: 'train', n: '06', title: '학습', sub: '단어가 자리를 찾아가요', t: 196 },
    { id: 'use', n: '07', title: '가까운 단어와 유추', sub: '벡터로 계산하기', t: 236 },
    { id: 'limits', n: '08', title: '한계', sub: '다의어 · 편향 · 흔들림', t: 278 },
    { id: 'dh', n: '09', title: '디지털 인문학에서', sub: '뜻의 변화 · 개념 · 문맥', t: 316 },
    { id: 'outro', n: '10', title: '정리', sub: '파이썬으로 해 보기', t: 352 },
  ];
  const END = 374;
  const CAPTIONS = [
    [0.6, 6, '컴퓨터는 글자를 그대로 이해하지 못해요. 단어도 숫자로 바꿔야 계산할 수 있어요.'],
    [6, 13, '**워드 임베딩**(word embedding)은 단어를 짧은 숫자 목록인 벡터로 바꿔, 뜻이 비슷한 단어를 가까이 두는 방법이에요.'],
    [13, 20, '오늘은 옛 나라와 도읍, 배와 과일 이야기가 담긴 짧은 문장 52개로 단어 지도를 만들어 볼게요.'],

    [20.4, 27, '가장 단순한 방법은 **원-핫 인코딩**(one-hot)이에요. 단어가 59개면 칸 59개 가운데 자기 칸만 1이에요.'],
    [27, 33, '그러면 ‘왕’과 ‘임금’의 코사인 유사도는 0이에요. ‘왕’과 ‘사과’도 0이고요.'],
    [33, 40, '모든 단어가 서로 똑같이 떨어져 있어서, 어떤 단어끼리 뜻이 비슷한지 알 수 없어요.'],
    [40, 46, '게다가 단어가 10만 개면 칸도 10만 개예요. 길고, 거의 다 0이죠.'],

    [46.4, 53, '언어학자 퍼스(J. R. Firth)는 말했어요. “단어는 그 단어가 어울리는 짝을 보면 알 수 있다.”'],
    [53, 60, '‘____은 백성을 다스렸다’, ‘신하는 ____에게 글을 올렸다’. 빈칸에 들어갈 말은 무엇일까요?'],
    [60, 67, '‘왕’도 ‘임금’도 들어갈 수 있어요. 비슷한 자리에 쓰이는 단어는 뜻도 비슷하다고 보는 거예요.'],
    [67, 74, '이것을 **분포 가설**(distributional hypothesis)이라고 해요. 워드 임베딩은 모두 이 생각에서 출발해요.'],

    [74.4, 81, '먼저 문장을 낱말로 나눠요. 조사를 떼고 원형으로 적고, ‘있다’처럼 아주 흔한 말은 뺐어요.'],
    [81, 88, '각 낱말의 앞뒤 두 낱말까지를 이웃으로 봐요. 이 범위를 **창**(window)이라고 하고, 크기는 2예요.'],
    [88, 95, '창을 옮기며 이웃으로 나온 횟수를 세면, 단어마다 한 줄씩 **동시 출현 행렬**이 생겨요.'],
    [95, 103, '‘왕’과 ‘임금’은 한 번도 이웃이 된 적이 없어요. 그런데 두 단어의 이웃은 거의 같아요. 신하, 백성, 다스리다…'],
    [103, 110, '두 줄의 코사인 유사도는 0.96이에요. ‘왕’과 ‘사과’는 이웃이 하나도 겹치지 않아 0이고요.'],
    [110, 118, '세기만 해도 뜻을 조금 담을 수 있어요. 하지만 줄은 여전히 단어 수만큼 길고, 대부분 0이에요.'],

    [118.4, 125, '그래서 단어마다 숫자 몇 개로 된 짧은 벡터를 만들어요. 여기서는 8개, 실제로는 보통 100~300개예요.'],
    [125, 132, '이 짧고 촘촘한 벡터가 **임베딩**이에요. 단어를 뜻의 공간 속 한 점에 ‘심는다’는 뜻이에요.'],
    [132, 139, '숫자 하나하나에 ‘왕다움’ 같은 이름이 있는 건 아니에요. 여러 숫자가 함께 뜻을 나타내요.'],
    [139, 146, '그럼 이 숫자는 어떻게 정할까요? 사람이 정하지 않고, 말뭉치에서 배워요.'],

    [146.4, 153, '**word2vec**은 2013년 미콜로프(Mikolov) 연구진이 내놓은 방법이에요. 세는 대신 맞히기를 하며 배워요.'],
    [153, 160, '**스킵그램**(skip-gram)은 가운데 낱말로 이웃 낱말을 맞혀요. ‘왕’ 옆에 ‘다스리다’가 올까?'],
    [160, 167, '두 벡터의 칸끼리 곱해 더한 값, **내적**이 크면 ‘이웃이다’, 작으면 ‘아니다’라고 답해요.'],
    [167, 174, '진짜 이웃이면 다음에는 내적이 더 커지도록 두 벡터를 조금 당겨요.'],
    [174, 182, '아무 단어나 몇 개 뽑아 ‘가짜 이웃’으로 삼고, 이쪽은 조금 밀어내요. 이것이 **네거티브 샘플링**이에요.'],
    [182, 189, '여기서는 진짜 이웃 하나에 가짜 이웃 5개를 뽑았어요. 말뭉치를 한 번 읽을 때 이런 짝이 424개예요.'],
    [189, 196, '처음 벡터는 아주 작은 무작위 값이에요. 말뭉치를 여러 번 읽으며 조금씩 고쳐 나가요.'],

    [196.4, 203, '말뭉치를 200번 되풀이해 읽는 동안 단어들이 자리를 찾아가요. 8차원 벡터를 2차원으로 줄여 그렸어요.'],
    [203, 210, '처음 몇 번은 모든 단어가 한쪽으로 함께 쏠려요. 10번 읽었을 때는 ‘왕’과 ‘사과’의 유사도도 0.98이에요.'],
    [210, 217, '더 읽을수록 이웃이 다른 단어끼리 갈라져요. 나라는 나라끼리, 도읍은 도읍끼리, 과일은 과일끼리 모여요.'],
    [217, 224, '200번을 다 읽으면 ‘왕’과 ‘임금’의 유사도는 1.00, ‘왕’과 ‘사과’는 0.30이에요.'],
    [224, 230, '한 번도 함께 나오지 않은 ‘왕’과 ‘임금’이 같은 자리에 왔어요. 이웃이 같았기 때문이에요.'],
    [230, 236, '‘배’는 어디 있을까요? 배 무리와 과일 무리 사이에 있어요. 조금 뒤에 다시 볼게요.'],

    [236.4, 243, '이제 단어마다 가까운 단어를 찾을 수 있어요. 코사인 유사도가 큰 순서로, 명사만 골랐어요.'],
    [243, 250, '‘한양’과 가장 가까운 단어는 ‘개경’ 0.90, ‘서라벌’ 0.87. 셋 다 옛 도읍이에요.'],
    [250, 257, '벡터는 더하고 뺄 수도 있어요. 한양 − 조선 + 고려를 계산해, 질문에 쓴 세 단어를 빼고 가장 가까운 단어를 찾으면 ‘개경’(0.93)이에요.'],
    [257, 264, '‘나라에서 도읍으로’ 가는 방향이 나라마다 비슷해서 생기는 일이에요. 이것을 **유추**(analogy)라고 해요.'],
    [264, 271, '영어 뉴스로 배운 벡터에서 king − man + woman이 queen에 가깝다는 결과가 유명해요.'],
    [271, 278, '하지만 늘 맞지는 않아요. 신라 : 서라벌 = 고려 : ? 에는 ‘개경’이 아니라 ‘한양’이 나와요.'],

    [278.4, 285, '‘배’는 타는 배이기도 하고 먹는 배이기도 해요. 그런데 단어 하나에 벡터는 하나뿐이에요.'],
    [285, 292, '그래서 두 뜻이 섞여요. ‘배’와 가까운 단어에 ‘돛단배’, ‘나룻배’와 ‘감’, ‘사과’가 함께 있어요.'],
    [292, 299, '임베딩은 말뭉치를 그대로 배워요. 글에 담긴 고정관념도 함께 배운다는 연구가 여럿 있어요.'],
    [299, 306, '영어 뉴스로 배운 벡터에서 ‘남자 : 프로그래머 = 여자 : 주부’ 같은 유추가 나오기도 했어요.'],
    [306, 316, '작은 말뭉치에서는 시작값(시드)만 바꿔도 결과가 흔들려요. 큰 말뭉치를 쓰고, 여러 번 학습해 확인하세요.'],

    [316.4, 323, '시대별 말뭉치로 따로 학습해 비교하면 단어 뜻이 어떻게 바뀌었는지 볼 수 있어요.'],
    [323, 330, '영어 ‘gay’는 ‘즐거운’에서 ‘동성애자’로, ‘broadcast’는 ‘씨를 뿌리다’에서 ‘방송하다’로 이웃이 바뀌었어요.'],
    [330, 337, '어떤 개념과 가까운 단어로 검색어를 넓히거나, ‘부유–가난’ 같은 축을 만들어 문화 속 의미를 재기도 해요.'],
    [337, 344, '요즘은 BERT처럼 문장마다 다른 벡터를 주는 **문맥 임베딩**도 써요. 그러면 ‘배’의 두 뜻도 구별할 수 있어요.'],
    [344, 352, 'BERTopic 튜토리얼에서 본 문장 임베딩도 같은 생각을 문장으로 넓힌 거예요.'],

    [352.4, 359, '정리해 볼까요? 단어는 이웃으로 알 수 있고, 이웃을 맞히며 짧은 벡터를 배워요.'],
    [359, 366, '가까운 단어와 유추, 시대별 비교로 글을 읽고, 결과는 꼭 원문으로 확인해요.'],
    [366, 374, '아래 놀이터에서 내 문장으로 단어 지도를 만들어 보세요.'],
  ];
  EV.CHAPTERS = CHAPTERS; EV.CAPTIONS = CAPTIONS; EV.END = END;
  EV.POSTER = 229;
  EV.chapterAt = t => { let i = 0; CHAPTERS.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
  EV.captionAt = t => { const c = CAPTIONS.find(c => t >= c[0] && t < c[1]); return c ? c[2] : ''; };

  // 학습 장면의 시각 → 읽은 횟수 (처음에 변화가 커서 앞쪽을 천천히)
  const epochAt = u => u < 3 ? 0 : u >= 30 ? 200 : 200 * Math.pow((u - 3) / 27, 2);
  EV.epochAt = epochAt;
  const EX = {
    count: { raw: '어진 왕은 백성을 아꼈다', lem: ['어질다', '왕', '백성', '아끼다'] },
    matrixRows: ['왕', '임금', '사과'],
    blanks: [['왕은 백성을 다스렸다', '왕'], ['신하는 왕에게 글을 올렸다', '왕']],
    dense: ['왕', '임금', '사과', '배'],
  };
  EV.EX = EX;

  // 자막 속 숫자가 계산과 맞는지 확인
  (function verify() {
    const warn = m => console.warn('워드 임베딩 영상: ' + m);
    const near = (x, s) => f2(x) === s;
    if (D.vocab.length !== 59 || D.sents.length !== 52) warn('단어 59개 / 문장 52개가 아님');
    if (WE.together('왕', '임금') !== 0) warn('‘왕’과 ‘임금’이 이웃으로 나옴');
    if (!near(WE.coocCos('왕', '임금'), '0.96') || WE.coocCos('왕', '사과') !== 0) warn('동시 출현 코사인이 자막과 다름');
    if (WE.CONFIG.negative !== 5 || M.pairs !== 424 || WE.CONFIG.epochs !== 200 || WE.CONFIG.dim !== 8) warn('학습 설정이 자막과 다름');
    if (!near(WE.sim(M, '왕', '사과', 10), '0.98')) warn('10번 읽은 뒤 왕–사과 유사도가 0.98이 아님');
    if (!near(WE.sim(M, '왕', '임금'), '1.00') || !near(WE.sim(M, '왕', '사과'), '0.30')) warn('학습 뒤 유사도가 자막과 다름');
    const nb = WE.similar(M, '한양', 2, true);
    if (nb[0].w !== '개경' || !near(nb[0].s, '0.90') || nb[1].w !== '서라벌' || !near(nb[1].s, '0.87')) warn('‘한양’의 이웃이 자막과 다름');
    if (AN.list[0].w !== '개경' || !near(AN.list[0].s, '0.93')) warn('유추 결과가 자막과 다름');
    if (AN_BAD.list[0].w !== '한양') warn('틀리는 유추 예가 자막과 다름');
    const bae = WE.similar(M, '배', 4, true).map(o => o.w).sort().join();
    if (bae !== ['감', '나룻배', '돛단배', '사과'].sort().join()) warn('‘배’의 이웃이 자막과 다름');
  })();

  function heading(g, ch) {
    txt(g, `${ch.n} · ${ch.sub}`, 80, 80, { size: 15, weight: 500, fam: FM, color: COL.accent, base: 'alphabetic' });
    txt(g, ch.title, 80, 124, { size: 38, weight: 700, fam: FD, base: 'alphabetic' });
  }

  /* ---------- 00 들어가며 ---------- */
  function sceneIntro(g, u) {
    EX.dense.forEach((w, i) => {
      const y = 214 + i * 86, a = ramp(u, 0.8 + i * 0.5, 0.6);
      fade(g, a, () => {
        chip(g, w, 80, y, { size: 24, stroke: wcol(w) });
        arrow(g, 168, y, 206, y, COL.line, 2, 9);
        vecCells(g, WE.vec(M, w), 220, y, 54, 42, { count: Math.round(clamp((u - 1.2 - i * 0.5) / 1.2) * 8) });
      });
    });
    fade(g, ramp(u, 4, 0.6), () => txt(g, '단어 하나 = 숫자 8개 (이 말뭉치에서 배운 벡터)', 220, 570, { size: 15, color: COL.muted }));
    fade(g, ramp(u, 12.6, 0.9), () => {
      const box = { x: 700, y: 150, w: 500, h: 440 };
      panelBox(g, box.x, box.y, box.w, box.h);
      const P = MAPS.learn.pts.map(fitter(MAPS.learn.pts, box, 52));
      drawPoints(g, WE.MAP_LEARN, P, { alpha: i => ramp(u, 13 + i * 0.08, 0.5) });
      txt(g, '단어 지도', box.x + 20, box.y + 26, { size: 15, weight: 700, color: COL.accent });
    });
  }

  /* ---------- 01 원-핫 ---------- */
  function sceneOnehot(g, u) {
    const words = ['왕', '임금', '사과', '배'], x0 = 190, cw = 15, V = D.vocab.length;
    words.forEach((w, r) => {
      const y = 200 + r * 54, a = ramp(u, 0.6 + r * 0.4, 0.5), on = D.index[w];
      fade(g, a, () => {
        txt(g, w, 80, y, { size: 22, weight: 700, color: wcol(w) });
        for (let k = 0; k < V; k++) {
          rr(g, x0 + k * cw, y - 14, cw - 3, 28, 3);
          g.fillStyle = k === on ? COL.accent : 'rgba(237,241,244,0.07)'; g.fill();
        }
        txt(g, `${on + 1}번 칸만 1`, x0 + V * cw + 16, y, { size: 15, fam: FB, color: COL.muted });
      });
    });
    fade(g, ramp(u, 2.4, 0.5), () => txt(g, `칸 ${V}개 = 이 말뭉치의 단어 수`, x0, 160, { size: 15, color: COL.muted }));
    [['왕', '임금'], ['왕', '사과']].forEach(([a, b], k) => {
      fade(g, ramp(u, 6.8 + k * 1.4, 0.6), () => {
        const x = 190 + k * 440, y = 460;
        panelBox(g, x, y - 46, 400, 92, COL.panel2);
        txt(g, `‘${a}’ · ‘${b}’  코사인 유사도`, x + 24, y - 14, { size: 17, color: COL.soft });
        txt(g, f2(WE.cos(WE.onehot(D, a), WE.onehot(D, b))), x + 24, y + 22, { size: 30, weight: 700, fam: FM, color: COL.text });
        txt(g, '겹치는 칸이 없어요', x + 160, y + 22, { size: 15, color: COL.muted });
      });
    });
    fade(g, ramp(u, 20, 0.7), () => {
      txt(g, '단어 10만 개 → 칸 10만 개, 그중 1은 한 칸뿐', 190, 560, { size: 18, weight: 600, color: COL.neg });
    });
  }

  /* ---------- 02 분포 가설 ---------- */
  function sceneIdea(g, u) {
    fade(g, ramp(u, 0.6, 0.7), () => {
      panelBox(g, 80, 152, 1120, 96, COL.panel);
      txt(g, '“You shall know a word by the company it keeps.”', 110, 186, { size: 24, weight: 500, fam: FD, color: COL.text });
      txt(g, '단어는 그 단어가 어울리는 짝을 보면 알 수 있다 — J. R. Firth, 1957', 110, 224, { size: 16, color: COL.muted });
    });
    const fillAt = u >= 14 ? Math.floor((u - 14) / 1.6) % 2 : -1;    // 0: 왕, 1: 임금을 번갈아 넣어 봄
    EX.blanks.forEach(([raw], r) => {
      fade(g, ramp(u, 7 + r * 0.8, 0.6), () => {
        const y = 320 + r * 76, parts = raw.split('왕');
        let x = 110;
        x += txt(g, parts[0], x, y, { size: 28, weight: 500 });
        const cand = fillAt < 0 ? '' : fillAt === 0 ? '왕' : '임금', bw = 108;
        rr(g, x + 4, y - 24, bw, 48, 8); g.fillStyle = cand ? 'rgba(245,196,81,0.18)' : 'rgba(237,241,244,0.06)'; g.fill();
        g.strokeStyle = cand ? wcol(cand) : COL.line; g.lineWidth = 2; g.setLineDash(cand ? [] : [6, 6]); g.stroke(); g.setLineDash([]);
        if (cand) txt(g, cand, x + 4 + bw / 2, y + 1, { size: 28, weight: 700, color: wcol(cand), align: 'center' });
        x += bw + 8;
        txt(g, parts[1], x, y, { size: 28, weight: 500 });
        if (cand) mark(g, true, 760, y, 12);
      });
    });
    ['왕', '임금', '사과'].forEach((w, k) => {
      fade(g, ramp(u, 8 + k * 0.5, 0.5), () => {
        const y = 320 + k * 60, x = 900;
        chip(g, w, x, y, { size: 24, stroke: wcol(w) });
        if (u > 15.5) {
          if (w === '사과') mark(g, false, x + chipW(g, w, 24) + 22, y, 11);
          else mark(g, true, x + chipW(g, w, 24) + 22, y, 11);
        }
      });
    });
    fade(g, ramp(u, 9, 0.5), () => txt(g, '후보', 900, 280, { size: 15, color: COL.muted }));
    fade(g, ramp(u, 21, 0.8), () => {
      panelBox(g, 110, 496, 1060, 64, 'rgba(110,231,200,0.12)');
      txt(g, '분포 가설', 140, 528, { size: 20, weight: 700, color: COL.accent });
      txt(g, '비슷한 자리(이웃)에 쓰이는 단어는 뜻도 비슷하다', 260, 528, { size: 20, weight: 600 });
    });
  }

  /* ---------- 03 함께 나오는 단어 세기 ---------- */
  function sceneCount(g, u) {
    const A = 1 - ramp(u, 14, 0.6);
    fade(g, A, () => {
      fade(g, ramp(u, 0.6, 0.6), () => txt(g, `“${EX.count.raw}”`, 80, 186, { size: 26, weight: 500, fam: FD }));
      const xs = []; let x = 80;
      EX.count.lem.forEach(w => { xs.push(x); x += chipW(g, w, 24) + 14; });
      const cIdx = u < 7 ? -1 : Math.min(3, Math.floor((u - 7) / 1.7));
      if (cIdx >= 0) {
        const lo = Math.max(0, cIdx - 2), hi = Math.min(3, cIdx + 2);
        rr(g, xs[lo] - 10, 222, xs[hi] + chipW(g, EX.count.lem[hi], 24) - xs[lo] + 20, 64, 14);
        g.strokeStyle = COL.accent; g.lineWidth = 2; g.setLineDash([7, 6]); g.stroke(); g.setLineDash([]);
        txt(g, '창 (앞뒤 2낱말)', xs[lo] - 6, 304, { size: 14, color: COL.accent });
      }
      EX.count.lem.forEach((w, i) => {
        fade(g, ramp(u, 2 + i * 0.35, 0.5), () => {
          const isC = i === cIdx, inWin = cIdx >= 0 && i !== cIdx && Math.abs(i - cIdx) <= 2;
          chip(g, w, xs[i], 254, { size: 24, fill: isC ? 'rgba(110,231,200,0.22)' : inWin ? 'rgba(110,231,200,0.08)' : COL.panel2, stroke: isC ? COL.accent : null });
        });
      });
      fade(g, ramp(u, 4, 0.6), () => txt(g, '조사를 떼고 원형으로 · ‘있다’처럼 아주 흔한 말은 뺌', 80, 340, { size: 15, color: COL.muted }));
      // 세어 나가는 짝
      fade(g, ramp(u, 7, 0.5), () => {
        txt(g, '이웃으로 센 짝', 760, 172, { size: 15, weight: 700, color: COL.accent });
        let n = 0;
        EX.count.lem.forEach((w, i) => {
          if (i > cIdx) return;
          WE.neighbors(EX.count.lem, i, 2).forEach(j => {
            const y = 204 + n * 34; n++;
            fade(g, ramp(u, 7 + i * 1.7 + 0.2, 0.4), () => {
              txt(g, w, 760, y, { size: 18, weight: 600, color: wcol(w) === '#8B93A1' ? COL.text : wcol(w) });
              txt(g, '→', 860, y, { size: 16, color: COL.muted });
              txt(g, EX.count.lem[j], 892, y, { size: 18, weight: 500, color: COL.soft });
              txt(g, '+1', 1010, y, { size: 16, fam: FM, color: COL.accent });
            });
          });
        });
      });
    });
    // 동시 출현 행렬 (일부)
    const cols = ['왕', '임금', '신하', '백성', '다스리다', '나라', '궁궐', '어질다', '아끼다', '글', '올리다', '섬기다', '먹다', '가을', '익다', '붉다', '깎다', '따다'];
    fade(g, ramp(u, 14.4, 0.7), () => {
      const x0 = 170, cw = 56, y0 = 200, rh = 50;
      txt(g, `동시 출현 행렬 (전체 ${D.vocab.length} × ${D.vocab.length} 가운데 일부)`, 80, 160, { size: 15, color: COL.muted });
      cols.forEach((c, k) => txt(g, c, x0 + k * cw + cw / 2 - 2, y0 - 2, { size: c.length > 2 ? 12 : 14, weight: 600, color: wcol(c) === '#8B93A1' ? COL.soft : wcol(c), align: 'center' }));
      EX.matrixRows.forEach((w, r) => {
        const y = y0 + 40 + r * rh, a = ramp(u, 15 + r * 0.6, 0.5);
        fade(g, a, () => {
          txt(g, w, 80, y, { size: 22, weight: 700, color: wcol(w) });
          cols.forEach((c, k) => {
            const n = WE.COOC[D.index[w]][D.index[c]];
            rr(g, x0 + k * cw, y - 18, cw - 4, 36, 6);
            g.fillStyle = n ? `rgba(110,231,200,${(0.16 + n * 0.2).toFixed(2)})` : 'rgba(237,241,244,0.05)'; g.fill();
            txt(g, n, x0 + k * cw + (cw - 4) / 2, y + 1, { size: 15, fam: FM, weight: n ? 600 : 400, color: n ? COL.text : COL.dim, align: 'center' });
          });
        });
      });
      // ‘왕’ 줄의 ‘임금’ 칸 = 0
      fade(g, ramp(u, 21.5, 0.5), () => {
        rr(g, x0 + cw - 3, y0 + 40 - 21, cw + 2, 42, 8); g.strokeStyle = COL.no; g.lineWidth = 2.5; g.stroke();
        txt(g, '↑ ‘왕’ 줄의 ‘임금’ 칸: 함께 이웃이 된 횟수 0', x0 + cw - 3, y0 + 40 + 3 * rh - 16, { size: 14, weight: 600, color: COL.no });
      });
    });
    [['왕', '임금'], ['왕', '사과']].forEach(([a, b], k) => {
      fade(g, ramp(u, 29 + k * 1.2, 0.6), () => {
        const x = 170 + k * 440, y = 432;
        panelBox(g, x, y - 46, 400, 92, COL.panel2);
        txt(g, `‘${a}’ 줄 · ‘${b}’ 줄  코사인 유사도`, x + 24, y - 14, { size: 17, color: COL.soft });
        txt(g, f2(WE.coocCos(a, b)), x + 24, y + 22, { size: 30, weight: 700, fam: FM, color: k ? COL.text : COL.accent });
        txt(g, k ? '겹치는 이웃 없음' : '이웃이 거의 같아요', x + 120, y + 22, { size: 15, color: COL.muted });
      });
    });
    fade(g, ramp(u, 36.4, 0.6), () => {
      let zero = 0, all = 0; WE.COOC.forEach(r => r.forEach(n => { all++; if (!n) zero++; }));
      txt(g, `한 줄 = ${D.vocab.length}칸 · 행렬 칸의 ${Math.round(zero / all * 100)}%가 0`, 170, 548, { size: 18, weight: 600, color: COL.neg });
    });
  }

  /* ---------- 04 짧고 촘촘한 벡터 ---------- */
  function sceneDense(g, u) {
    const V = D.vocab.length, row = WE.COOC[D.index['왕']];
    fade(g, ramp(u, 0.4, 0.6) * (1 - ramp(u, 12.8, 0.6) * 0.6), () => {
      txt(g, '세기: ‘왕’의 줄', 80, 168, { size: 16, weight: 600, color: COL.muted });
      for (let k = 0; k < V; k++) {
        rr(g, 80 + k * 18.6, 186, 15, 30, 3);
        g.fillStyle = row[k] ? `rgba(110,231,200,${(0.25 + row[k] * 0.2).toFixed(2)})` : 'rgba(237,241,244,0.06)'; g.fill();
      }
      txt(g, `${V}칸, 대부분 0`, 80 + V * 18.6 + 12, 201, { size: 15, color: COL.muted });
    });
    fade(g, ramp(u, 1.4, 0.5), () => arrow(g, 120, 236, 120, 276, COL.line, 2, 9));
    fade(g, ramp(u, 1.8, 0.6), () => txt(g, '임베딩: 8칸, 모두 채워짐 (word2vec로 배운 값)', 80, 300, { size: 16, weight: 600, color: COL.accent }));
    EX.dense.forEach((w, r) => {
      const y = 350 + r * 56;
      fade(g, ramp(u, 2.2 + r * 0.5, 0.6), () => {
        txt(g, w, 80, y, { size: 22, weight: 700, color: wcol(w) });
        vecCells(g, WE.vec(M, w), 170, y, 70, 42, { size: 15 });
      });
    });
    fade(g, ramp(u, 6.8, 0.6), () => {
      txt(g, '‘왕’과 ‘임금’은 칸마다 값이 닮았어요', 760, 378, { size: 17, weight: 600, color: COL.soft });
      txt(g, '‘사과’는 다른 무늬예요', 760, 412, { size: 17, weight: 600, color: COL.soft });
    });
    fade(g, ramp(u, 13.6, 0.6), () => {
      rr(g, 166, 322, 70, 260, 10); g.strokeStyle = COL.accent; g.lineWidth = 2; g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
      txt(g, '1번째 칸의 뜻은? → 이름이 없어요. 여러 칸이 함께 뜻을 나타내요', 760, 470, { size: 16, color: COL.accent });
    });
    fade(g, ramp(u, 20.8, 0.6), () => txt(g, '이 숫자는 사람이 정하지 않고, 말뭉치에서 배워요 →', 760, 540, { size: 19, weight: 700 }));
  }

  /* ---------- 05 word2vec ---------- */
  function sceneW2v(g, u) {
    // 스킵그램과 CBOW
    fade(g, ramp(u, 0.6, 0.6) * (1 - ramp(u, 7, 0.6)), () => {
      [['스킵그램 (skip-gram, sg=1)', '가운데 낱말 → 이웃 낱말 맞히기', true], ['CBOW (sg=0, gensim 기본값)', '이웃 낱말들 → 가운데 낱말 맞히기', false]].forEach(([t1, t2, sg], k) => {
        const x = 110 + k * 560, y = 300;
        panelBox(g, x - 30, 170, 500, 300, k ? COL.panel : COL.panel2);
        txt(g, t1, x, 206, { size: 19, weight: 700, color: k ? COL.soft : COL.accent });
        txt(g, t2, x, 236, { size: 15, color: COL.muted });
        const cx = x + 220, cy = y + 60;
        const box = (s, bx, by, hi) => { rr(g, bx - 44, by - 18, 88, 36, 8); g.fillStyle = hi ? 'rgba(110,231,200,0.2)' : COL.panel2; g.fill(); txt(g, s, bx, by + 1, { size: 16, weight: 600, align: 'center' }); };
        const ctx = [[cx - 160, cy - 50], [cx - 160, cy + 50], [cx + 160, cy - 50], [cx + 160, cy + 50]];
        box('왕', cx, cy, true);
        ctx.forEach(([bx, by], i) => {
          box(['어질다', '백성', '다스리다', '아끼다'][i], bx, by, false);
          if (sg) arrow(g, cx + (bx < cx ? -46 : 46), cy, bx + (bx < cx ? 46 : -46), by, COL.accent, 2, 8);
          else arrow(g, bx + (bx < cx ? 46 : -46), by, cx + (bx < cx ? -46 : 46), cy, COL.line, 2, 8);
        });
      });
    });
    // 실제 학습 한 걸음: 가운데 ‘왕’, 진짜 이웃 ‘다스리다’, 가짜 이웃 5개
    const st = WE.STEP, cw = D.vocab[st.center], cx = D.vocab[st.ctx], negs = st.drawn.map(i => D.vocab[i]);
    const sent = D.sents.find(s => s.indexOf(cw) >= 0 && s.indexOf(cx) >= 0);
    fade(g, ramp(u, 7.4, 0.6), () => {
      let x = 80;
      sent.forEach(w => {
        const isC = w === cw, isX = w === cx;
        x += chip(g, w, x, 186, { size: 22, fill: isC ? 'rgba(110,231,200,0.22)' : isX ? 'rgba(245,196,81,0.18)' : COL.panel2, stroke: isC ? COL.accent : isX ? '#F5C451' : null }) + 12;
      });
      txt(g, `‘${cx}’가 ‘${cw}’의 이웃일까?`, 80, 244, { size: 20, weight: 700 });
    });
    fade(g, ramp(u, 14, 0.6), () => {
      txt(g, '내적 = 두 벡터의 칸끼리 곱해서 더한 값', 80, 300, { size: 17, weight: 600, color: COL.soft });
      txt(g, '크면 → ‘이웃이다’   작으면 → ‘아니다’', 80, 332, { size: 17, color: COL.soft });
      txt(g, '(시그모이드 함수로 0~1 사이 확률로 바꿔요)', 80, 362, { size: 15, color: COL.muted });
    });
    // 오른쪽: 2차원 화살표 설명 그림
    const OX = 930, OY = 396, R = 130;
    fade(g, ramp(u, 14, 0.6) * (1 - ramp(u, 42.6, 0.6)), () => {
      panelBox(g, 700, 220, 460, 340, COL.panel);
      txt(g, '설명용 그림 (실제는 8차원)', 1144, 242, { size: 13, color: COL.dim, align: 'right' });
      const a0 = -0.35, pull = ramp(u, 21, 4), push = ramp(u, 28.5, 4);
      const ax = a0 - lerp(1.5, 0.35, pull);
      arrow(g, OX, OY, OX + Math.cos(a0) * R, OY + Math.sin(a0) * R, COL.accent, 4, 14);
      txt(g, cw, OX + Math.cos(a0) * (R + 26), OY + Math.sin(a0) * (R + 26), { size: 18, weight: 700, color: COL.accent, align: 'center' });
      arrow(g, OX, OY, OX + Math.cos(ax) * R * 0.92, OY + Math.sin(ax) * R * 0.92, '#F5C451', 4, 14);
      txt(g, cx, OX + Math.cos(ax) * (R * 0.92 + 30), OY + Math.sin(ax) * (R * 0.92 + 30), { size: 17, weight: 700, color: '#F5C451', align: 'center' });
      if (u > 21) fade(g, ramp(u, 21, 0.5) * (1 - ramp(u, 27, 0.6)), () => txt(g, '당기기: 내적이 커지도록', 720, 544, { size: 16, weight: 700, color: '#F5C451' }));
      fade(g, ramp(u, 28, 0.6), () => {
        negs.forEach((w, i) => {
          const ang = 0.85 + i * 0.6 + push * 0.15, L = R * lerp(0.52, 0.68, push);   // 같은 쪽으로 조금 돌며 멀어짐
          arrow(g, OX, OY, OX + Math.cos(ang) * L, OY + Math.sin(ang) * L, 'rgba(237,241,244,0.45)', 2, 10);
          txt(g, w, OX + Math.cos(ang) * (L + 24), OY + Math.sin(ang) * (L + 22), { size: 14, color: COL.muted, align: 'center' });
        });
        fade(g, ramp(u, 29, 0.5) * (1 - ramp(u, 35, 0.6)), () => txt(g, '밀어내기: 가짜 이웃과는 내적이 작아지도록', 720, 544, { size: 16, weight: 700, color: COL.soft }));
      });
    });
    fade(g, ramp(u, 28.4, 0.6), () => {
      txt(g, `실제로 뽑힌 가짜 이웃 (학습 ${st.step + 1}번째 걸음)`, 80, 420, { size: 15, weight: 700, color: COL.muted });
      let x = 80;
      negs.forEach(w => { x += chip(g, w, x, 458, { size: 17, fill: COL.panel2 }) + 8; });
    });
    fade(g, ramp(u, 36, 0.6), () => {
      const items = [['가짜 이웃', `${WE.CONFIG.negative}개`, '진짜 이웃 하나마다'], ['한 번 읽을 때', `${M.pairs}쌍`, '가운데–이웃 짝'], [`${WE.CONFIG.epochs}번 읽기`, `${(M.pairs * WE.CONFIG.epochs).toLocaleString('en-US')}번`, '벡터 고치기']];
      items.forEach(([a, b, c], k) => {
        const x = 80 + k * 200;
        panelBox(g, x, 492, 186, 80, COL.panel2);
        txt(g, a, x + 16, 512, { size: 14, color: COL.muted });
        txt(g, b, x + 16, 544, { size: 24, weight: 700, fam: FM, color: COL.accent });
        txt(g, c, x + 16, 564, { size: 12, color: COL.dim });
      });
    });
    fade(g, ramp(u, 43, 0.6), () => {
      panelBox(g, 700, 220, 460, 340, COL.panel);
      txt(g, '‘왕’ 벡터', 724, 254, { size: 17, weight: 700, color: COL.accent });
      txt(g, '처음 (작은 무작위 값)', 724, 300, { size: 15, color: COL.muted });
      vecCells(g, M.snaps[0][D.index['왕']], 724, 340, 52, 34, { size: 12, digits: 2, max: 0.08 });
      txt(g, `${WE.CONFIG.epochs}번 읽은 뒤`, 724, 412, { size: 15, color: COL.muted });
      vecCells(g, WE.vec(M, '왕'), 724, 452, 52, 34, { size: 13, digits: 1 });
      txt(g, '진짜 이웃은 당기고 가짜 이웃은 밀어낸 결과', 724, 512, { size: 14, color: COL.soft });
    });
  }

  /* ---------- 06 학습 ---------- */
  function sceneTrain(g, u) {
    const e = S.epoch != null ? S.epoch : epochAt(u);
    const box = { x: 80, y: 150, w: 660, h: 440 };
    panelBox(g, box.x, box.y, box.w, box.h);
    const fit = fitter(MAPS.learn.pts, box, 56);
    const P = learnAt(e).map(fit);
    drawPoints(g, WE.MAP_LEARN, P, { alpha: () => ramp(u, 0.4, 0.6), highlight: u > 34 ? ['배'] : u > 24 ? ['왕', '임금'] : ['왕', '사과'] });
    fade(g, ramp(u, 0.8, 0.5), () => legend(g, box.x + 18, box.y + 24));
    if (u > 33.6) fade(g, ramp(u, 33.6, 0.6), () => {
      const p = P[WE.MAP_LEARN.indexOf('배')], pulse = 18 + 4 * Math.sin((u - 33.6) * 4);
      g.beginPath(); g.arc(p[0], p[1], pulse, 0, Math.PI * 2); g.strokeStyle = COL.text; g.lineWidth = 2; g.stroke();
    });
    // 오른쪽: 읽은 횟수와 유사도 그래프
    const cx0 = 800, cy0 = 190, cwid = 400, chgt = 220;
    fade(g, ramp(u, 0.6, 0.6), () => {
      txt(g, '읽은 횟수', cx0, 172, { size: 15, color: COL.muted });
      txt(g, `${Math.round(e)} / ${WE.CONFIG.epochs}`, cx0 + 90, 172, { size: 22, weight: 700, fam: FM, color: COL.accent });
      const X = ep => cx0 + Math.sqrt(ep / 200) * cwid, Y = v => cy0 + 30 + (1 - (v + 0.4) / 1.4) * chgt;
      g.strokeStyle = COL.faint; g.lineWidth = 1;
      [-0.4, 0, 0.5, 1].forEach(v => { g.beginPath(); g.moveTo(cx0, Y(v)); g.lineTo(cx0 + cwid, Y(v)); g.stroke(); txt(g, v.toFixed(1), cx0 - 8, Y(v), { size: 12, fam: FM, color: COL.dim, align: 'right' }); });
      [0, 10, 50, 100, 200].forEach(ep => txt(g, ep, X(ep), Y(-0.4) + 18, { size: 12, fam: FM, color: COL.dim, align: 'center' }));
      txt(g, '읽은 횟수 →', cx0 + cwid, Y(-0.4) + 38, { size: 12, color: COL.dim, align: 'right' });
      [['왕', '임금', '#F5C451'], ['왕', '사과', '#FF9ECF']].forEach(([a, b, c], k) => {
        g.strokeStyle = c; g.lineWidth = 3; g.beginPath();
        for (let ep = 0; ep <= e; ep += ep < 20 ? 0.25 : 1) {
          const f = Math.floor(ep), p = ep - f, v = lerp(WE.sim(M, a, b, f), WE.sim(M, a, b, Math.min(200, f + 1)), p);
          ep ? g.lineTo(X(ep), Y(v)) : g.moveTo(X(ep), Y(v));
        }
        g.stroke();
        const f = Math.floor(e), v = lerp(WE.sim(M, a, b, f), WE.sim(M, a, b, Math.min(200, f + 1)), e - f);
        g.beginPath(); g.arc(X(e), Y(v), 5, 0, Math.PI * 2); g.fillStyle = c; g.fill();
        txt(g, `${a}–${b}  ${f2(v)}`, cx0 + k * 200, cy0 + chgt + 92, { size: 17, weight: 700, fam: FM, color: c });
      });
      txt(g, '코사인 유사도', cx0, cy0 + 14, { size: 13, color: COL.dim });
    });
    fade(g, ramp(u, 24.4, 0.6), () => {
      txt(g, '한 번도 함께 나오지 않았지만', 800, 540, { size: 17, color: COL.soft });
      txt(g, '이웃이 같아 같은 자리로', 800, 568, { size: 17, weight: 700, color: '#F5C451' });
    });
  }

  /* ---------- 07 가까운 단어와 유추 ---------- */
  function sceneUse(g, u) {
    const word = S.word && D.index[S.word] != null ? S.word : '한양';
    const showList = 1 - ramp(u, 27.6, 0.6);
    fade(g, ramp(u, 0.6, 0.6) * showList, () => {
      txt(g, `‘${word}’와 가까운 단어 (명사)`, 80, 168, { size: 18, weight: 700, color: COL.accent });
      WE.similar(M, word, 6, true).forEach((o, i) => {
        const y = 210 + i * 50, a = ramp(u, 1.2 + i * 0.25, 0.4);
        fade(g, a, () => {
          txt(g, o.w, 80, y, { size: 21, weight: 700, color: wcol(o.w) === '#8B93A1' ? COL.text : wcol(o.w) });
          const bw = Math.max(2, o.s * 230);
          rr(g, 190, y - 11, bw, 22, 5); g.fillStyle = 'rgba(110,231,200,0.55)'; g.fill();
          txt(g, f2(o.s), 190 + bw + 10, y + 1, { size: 16, weight: 600, fam: FM, color: COL.soft });
          HITS.push({ x: 70, y: y - 22, w: 460, h: 44, kind: 'word', w2: o.w });
        });
      });
    });
    fade(g, ramp(u, 27.6, 0.6), () => {
      panelBox(g, 80, 160, 440, 210, COL.panel);
      txt(g, '영어 뉴스로 배운 벡터에서', 104, 196, { size: 16, color: COL.muted });
      txt(g, 'king − man + woman', 104, 246, { size: 26, weight: 600, fam: FM });
      txt(g, '≈ queen', 104, 292, { size: 26, weight: 700, fam: FM, color: COL.accent });
      txt(g, 'Mikolov, Yih, Zweig (2013)', 104, 340, { size: 14, color: COL.dim });
    });
    // 오른쪽: 벡터 셈 (단위 길이로 맞춘 8칸) → 질문의 세 단어를 빼고 가장 가까운 단어
    const bad = ramp(u, 34.6, 0.7), good = 1 - bad;
    const arith = (A, B, C, res, color, alpha, startAt) => fade(g, alpha, () => {
      const x0 = 660, cw = 64, rows = [[B, ''], [A, '−'], [C, '+']];
      panelBox(g, 580, 150, 620, 440);
      rows.forEach(([w, op], r) => {
        const y = 196 + r * 54;
        fade(g, ramp(u, startAt + r * 0.8, 0.5), () => {
          txt(g, op, 600, y, { size: 24, weight: 700, fam: FM, color: COL.muted });
          txt(g, w, 622, y, { size: 19, weight: 700, color: wcol(w) });
          vecCells(g, WE.unit(WE.vec(M, w)), x0 + 30, y, cw - 4, 38, { size: 12, digits: 2, max: 0.7 });
        });
      });
      fade(g, ramp(u, startAt + 2.6, 0.6), () => {
        g.strokeStyle = COL.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(600, 336); g.lineTo(1180, 336); g.stroke();
        txt(g, '=', 600, 364, { size: 24, weight: 700, fam: FM, color: COL.muted });
        txt(g, '?', 626, 364, { size: 22, weight: 700, color: COL.text });
        vecCells(g, res.q, x0 + 30, 364, cw - 4, 38, { size: 12, digits: 2, max: 0.7 });
      });
      fade(g, ramp(u, startAt + 4, 0.6), () => {
        txt(g, `질문에 쓴 ${A}·${B}·${C}는 빼고 가장 가까운 단어`, 600, 418, { size: 15, color: COL.muted });
        const top = res.list[0];
        txt(g, top.w, 622, 462, { size: 19, weight: 700, color: color });
        vecCells(g, WE.unit(WE.vec(M, top.w)), x0 + 30, 462, cw - 4, 38, { size: 12, digits: 2, max: 0.7 });
        txt(g, `코사인 유사도 ${f2(top.s)}`, 690, 510, { size: 16, weight: 700, fam: FM, color });
        txt(g, `2위 ${res.list[1].w} ${f2(res.list[1].s)}`, 900, 510, { size: 15, fam: FM, color: COL.muted });
      });
    });
    if (u > 13.4) arith('조선', '한양', '고려', AN, COL.accent, ramp(u, 13.6, 0.6) * good, 14);
    if (bad > 0) arith('신라', '서라벌', '고려', AN_BAD, COL.no, bad, 35);
    fade(g, ramp(u, 20, 0.6) * good, () => txt(g, `조선 : 한양 = 고려 : ?  →  ${AN.list[0].w} ${f2(AN.list[0].s)}`, 604, 566, { size: 18, weight: 700, color: COL.accent }));
    fade(g, ramp(u, 39.4, 0.6), () => {
      const right = AN_BAD.list.find(o => o.w === '개경');
      txt(g, `신라 : 서라벌 = 고려 : ?  →  ${AN_BAD.list[0].w} ${f2(AN_BAD.list[0].s)}  (정답 개경은 ${right ? f2(right.s) : '—'})`, 604, 566, { size: 17, weight: 700, color: COL.no });
    });
  }

  /* ---------- 08 한계 ---------- */
  function sceneLimits(g, u) {
    const A = 1 - ramp(u, 13.6, 0.6), B = ramp(u, 14, 0.6) * (1 - ramp(u, 27.6, 0.6)), C = ramp(u, 28, 0.6);
    fade(g, A, () => {
      const box = { x: 80, y: 150, w: 600, h: 440 };
      fade(g, ramp(u, 0.6, 0.6), () => {
        panelBox(g, box.x, box.y, box.w, box.h);
        const P = MAPS.poly.pts.map(fitter(MAPS.poly.pts, box, 64));
        drawPoints(g, WE.MAP_POLY, P, { size: 19, r: 8, highlight: ['배'] });
        legend(g, box.x + 18, box.y + 26, ['boat', 'fruit']);
      });
      fade(g, ramp(u, 1.6, 0.6), () => {
        txt(g, '배를 타고 강을 건넜다', 740, 196, { size: 20, weight: 500, color: '#C6A0FF' });
        txt(g, '배를 깎아 먹었다', 740, 236, { size: 20, weight: 500, color: '#FF9ECF' });
        txt(g, '→ 같은 ‘배’, 벡터는 하나', 740, 276, { size: 17, color: COL.muted });
      });
      fade(g, ramp(u, 6.8, 0.6), () => {
        txt(g, '‘배’와 가까운 단어 (명사)', 740, 336, { size: 17, weight: 700, color: COL.accent });
        WE.similar(M, '배', 4, true).forEach((o, i) => {
          const y = 376 + i * 46;
          txt(g, o.w, 740, y, { size: 20, weight: 700, color: wcol(o.w) });
          rr(g, 850, y - 10, o.s * 220, 20, 5); g.fillStyle = wcol(o.w); g.globalAlpha *= 0.7; g.fill(); g.globalAlpha /= 0.7;
          txt(g, f2(o.s), 850 + o.s * 220 + 10, y + 1, { size: 15, weight: 600, fam: FM, color: COL.soft });
        });
      });
    });
    fade(g, B, () => {
      panelBox(g, 160, 170, 960, 330, COL.panel);
      txt(g, '말뭉치의 고정관념도 함께 배워요', 200, 214, { size: 22, weight: 700, color: COL.neg });
      txt(g, '영어 구글 뉴스로 배운 word2vec 벡터에서 나온 유추', 200, 262, { size: 17, color: COL.soft });
      txt(g, '남자 : 컴퓨터 프로그래머 = 여자 : 주부', 200, 316, { size: 28, weight: 700, fam: FD });
      txt(g, 'Bolukbasi 외 (2016), “Man is to Computer Programmer as Woman is to Homemaker?”', 200, 372, { size: 14, color: COL.dim });
      txt(g, '사람의 글에 담긴 편견이 벡터에 그대로 드러난다는 연구: Caliskan 외 (2017), Garg 외 (2018)', 200, 404, { size: 14, color: COL.dim });
      txt(g, '→ 결과를 ‘사실’이 아니라 ‘말뭉치가 말하는 방식’으로 읽어요', 200, 456, { size: 18, weight: 600, color: COL.accent });
    });
    fade(g, C, () => {
      txt(g, '같은 말뭉치, 같은 설정 — 시드만 바꿔 학습했을 때 ‘신하’와 가까운 단어', 80, 180, { size: 18, weight: 700, color: COL.accent });
      seedDemo().forEach((o, k) => {
        const y = 240 + k * 84;
        fade(g, ramp(u, 28.6 + k * 0.8, 0.5), () => {
          panelBox(g, 80, y - 32, 900, 64, COL.panel);
          txt(g, `시드 ${o.seed}`, 104, y, { size: 18, weight: 700, fam: FM, color: COL.soft });
          let x = 230;
          o.list.forEach(n => { x += txt(g, `${n.w} ${f2(n.s)}`, x, y, { size: 19, weight: 600, color: wcol(n.w) === '#8B93A1' ? COL.text : wcol(n.w) }) + 34; });
        });
      });
      fade(g, ramp(u, 31.6, 0.6), () => txt(g, '‘한양’ → ‘개경’, ‘배’ → ‘감·돛단배’처럼 뚜렷한 관계는 그대로지만, 약한 관계는 흔들려요', 80, 520, { size: 17, color: COL.soft }));
    });
  }

  /* ---------- 09 디지털 인문학에서 ---------- */
  function sceneDh(g, u) {
    const cards = [
      ['뜻의 변화', '시대별 말뭉치로 따로 학습해 이웃을 비교', [['gay', '즐거운 → 동성애자'], ['broadcast', '씨 뿌리기 → 방송'], ['awful', '경외로운 → 끔찍한']], 'Hamilton 외 (2016)', 0.6],
      ['개념의 축', '반대말 쌍의 차이로 축을 만들고 단어를 올려놓기', [['부유 − 가난', '직업·음식·운동은 어느 쪽?'], ['검색어 넓히기', '‘역병’과 가까운 단어 찾기']], 'Kozlowski 외 (2019)', 13.6],
      ['문맥 임베딩', '문장마다 다른 벡터 (BERT 등)', [['배를 타고 강을 건넜다', '배 → 배·물 쪽'], ['배를 깎아 먹었다', '배 → 과일 쪽']], 'Devlin 외 (2019)', 20.6],
    ];
    cards.forEach(([t, sub, rows, cite, at], k) => {
      const x = 80 + k * 380, y = 160;
      fade(g, ramp(u, at, 0.7), () => {
        panelBox(g, x, y, 360, 360, COL.panel);
        txt(g, t, x + 22, y + 38, { size: 22, weight: 700, color: COL.accent });
        txt(g, sub, x + 22, y + 72, { size: 14, color: COL.muted });
        rows.forEach(([a, b], r) => {
          const yy = y + 124 + r * 70;
          txt(g, a, x + 22, yy, { size: a.length > 8 ? 16 : 19, weight: 700, fam: /^[a-z]/.test(a) ? FM : FB });
          txt(g, b, x + 22, yy + 28, { size: 15, color: COL.soft });
        });
        txt(g, cite, x + 22, y + 334, { size: 13, color: COL.dim });
      });
    });
    fade(g, ramp(u, 28.4, 0.6), () => txt(g, 'BERTopic의 문장 임베딩 = 같은 생각을 문장 단위로', 80, 568, { size: 18, weight: 600, color: COL.soft }));
  }

  /* ---------- 10 정리 ---------- */
  function sceneOutro(g, u) {
    const steps = [['말뭉치 모으기', '시대·갈래별 글'], ['낱말로 나누기', '형태소 분석'], ['이웃 맞히기', 'word2vec 학습'], ['가까운 단어·유추', '코사인 유사도'], ['원문 확인', '결과를 다시 읽기']];
    const bw = 200, gap = 30, x0 = (W - (steps.length * bw + (steps.length - 1) * gap)) / 2, y = 222;
    steps.forEach(([a, b], k) => {
      const al = ramp(u, 0.6 + k * 0.7, 0.5), x = x0 + k * (bw + gap);
      fade(g, al, () => {
        rr(g, x, y - 46, bw, 92, 12); g.fillStyle = COL.panel; g.fill();
        txt(g, `${k + 1}`, x + 18, y - 22, { size: 14, fam: FM, color: COL.accent });
        txt(g, a, x + bw / 2, y - 2, { size: 19, weight: 700, align: 'center' });
        txt(g, b, x + bw / 2, y + 26, { size: 14, color: COL.soft, align: 'center' });
        if (k) arrow(g, x - gap + 4, y, x - 5, y, COL.line, 2, 9);
      });
    });
    fade(g, ramp(u, 7.4, 0.8), () => {
      const cx = 140, cy = 300;
      rr(g, cx - 30, cy, 1060, 248, 14); g.fillStyle = '#0B0F14'; g.fill(); g.strokeStyle = COL.faint; g.lineWidth = 1; g.stroke();
      const lines = [
        [['from ', COL.accent], ['gensim.models ', COL.text], ['import ', COL.accent], ['Word2Vec', COL.text]],
        [],
        [['sents = [["왕", "백성", "다스리다"], ...]', COL.text], ['        # 낱말로 나눈 문장들', COL.muted]],
        [['model = Word2Vec(sents, vector_size=100, window=5, sg=1)', COL.text]],
        [['model.wv.most_similar("한양")', COL.text], ['                          # 가까운 단어', COL.muted]],
        [['model.wv.most_similar(positive=["한양", "고려"], negative=["조선"])', COL.text]],
      ];
      lines.forEach((parts, r) => { let x = cx; parts.forEach(([s, c]) => { x += txt(g, s, x, cy + 38 + r * 34, { size: 18, fam: FM, color: c }); }); });
    });
    fade(g, ramp(u, 14.4, 0.6), () => txt(g, '아래 놀이터에서 내 문장으로 단어 지도를 만들어 보세요 ↓', W / 2, 578, { size: 21, weight: 700, color: COL.accent, align: 'center' }));
  }

  const SCENES = { intro: sceneIntro, onehot: sceneOnehot, idea: sceneIdea, count: sceneCount, dense: sceneDense, w2v: sceneW2v, train: sceneTrain, use: sceneUse, limits: sceneLimits, dh: sceneDh, outro: sceneOutro };

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
    rr(g, (W - bw) / 2, y0, bw, h, 12); g.fillStyle = 'rgba(6,9,12,0.86)'; g.fill();
    lines.forEach((l, li) => {
      let x = (W - widthOf(l)) / 2;
      l.forEach(o => { txt(g, o.w, x, y0 + 11 + lh * li + lh / 2, { size: 28, weight: o.bold ? 700 : 500, color: o.bold ? COL.accent : COL.text }); x += o.ww; });
    });
  }

  EV.render = function (g, t, opt = {}) {
    const s = g.canvas.width / W;
    g.setTransform(s, 0, 0, s, 0, 0);
    g.globalAlpha = 1;
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = COL.grid; for (let x = 20; x < W; x += 40) for (let y = 20; y < H; y += 40) g.fillRect(x - 1, y - 1, 2, 2);
    const ch = CHAPTERS[EV.chapterAt(t)], u = t - ch.t, keep = HITS;
    HITS = [];
    g.save(); g.globalAlpha = ramp(u, 0, 0.45);
    heading(g, ch);
    SCENES[ch.id](g, u);
    g.restore();
    if (opt.caption) drawCaption(g, EV.captionAt(t));
    if (opt.dry) HITS = keep;
  };

  // 영상 전체를 훑어 캔버스에 쓰는 글자를 모음 (글꼴 미리 받기용). 조금씩 나눠 그려 화면이 멈추지 않게 함
  const EXTRA = () => CAPTIONS.map(c => c[2]).join('') + WE.CORPUS.map(r => r.join('')).join('') + D.vocab.join('') + '0123456789.,·()[]→↑↓×÷=≈−+%‘’“”…?';
  EV.collectText = function (cb, budget) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 72;
    const g = c.getContext('2d'), set = new Set();
    let t = 0;
    const step = () => {
      const prev = REC; REC = set;
      try { const until = performance.now() + (budget || 1e9); while (t <= END && performance.now() < until) { EV.render(g, t, { caption: true, dry: true }); t += 0.5; } }
      finally { REC = prev; }
      if (t <= END) setTimeout(step, 0); else cb([...set].join('') + EXTRA());
    };
    step();
  };
  EV.baseText = EXTRA;
})();
