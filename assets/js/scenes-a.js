/* 장면 1~7: 시작, 노드와 링크, 관계의 종류, 데이터, 연결정도, 경로와 거리, 밀도
 *
 * 장면 정의 형식
 *   id, chapter(목차 이름), kicker/title(화면 왼쪽 위 제목), dur(초)
 *   captions: [[시작 초, '자막'], ...]   — **굵게** 표시는 강조색
 *   init()            → 장면 상태 S (한 번만 계산)
 *   draw(g, t, S, env) — t: 장면 안에서의 시간(초). 같은 t면 항상 같은 그림 (영상 렌더링용)
 *   click(S, hit, env) — 화면 속 대상을 클릭 (true를 돌려주면 영상 일시정지)
 *   clickEmpty(S, pt, env) — 빈 곳 클릭 (true를 돌려주면 처리 끝, 아니면 재생/일시정지)
 *   panel: { html, bind(el, S, player) } — 영상 옆 '직접 해 보기' 패널
 *
 * S.ov(override): 사용자가 직접 조작한 상태. 재생을 다시 누르면 null로 돌아가 영상 흐름을 따릅니다.
 */
(function () {
  'use strict';
  const NA = window.NA;
  const { U, C, D, G } = NA;
  NA.scenes = NA.scenes || [];
  const scene = (def) => NA.scenes.push(def);

  /* ---------- 장면 공용 도우미 ---------- */
  const SH = (NA.SH = {});
  // 드래그로 옮긴 만큼 더한 좌표
  SH.pos = (S, key, p) => {
    const o = S.off && S.off[key];
    return o ? { x: p.x + o.x, y: p.y + o.y } : { x: p.x, y: p.y };
  };
  // 사용자가 조작했을 때만 부드럽게 따라가는 값 (영상 흐름일 때는 즉시 값)
  SH.tw = (S, key, target, env, rate = 7) => {
    S._tw = S._tw || {};
    const snap = !S.ov || env.render || S._tw[key] == null;
    if (Array.isArray(target)) {
      const prev = S._tw[key];
      if (snap || !Array.isArray(prev) || prev.length !== target.length) return (S._tw[key] = target.slice());
      const k = 1 - Math.exp(-rate * (env.dt || 0.016));
      return (S._tw[key] = prev.map((v, i) => v + (target[i] - v) * k));
    }
    if (snap) return (S._tw[key] = target);
    const k = 1 - Math.exp(-rate * (env.dt || 0.016));
    return (S._tw[key] = S._tw[key] + (target - S._tw[key]) * k);
  };
  // 마우스를 올렸을 때 뜨는 작은 설명 상자
  SH.tip = (g, x, y, title, lines = []) => {
    const w = Math.max(D.measure(g, title, 18, 'body', 700), ...lines.map((l) => D.measure(g, l.replace(/\*\*/g, ''), 15, 'body', 500))) + 28;
    const h = 34 + lines.length * 22;
    let bx = x + 18, by = y - h - 12;
    if (bx + w > D.W - 10) bx = x - w - 18;
    if (by < 10) by = y + 18;
    D.panel(g, bx, by, w, h, { r: 10, fill: U.rgba('#04090c', 0.92), stroke: U.rgba(C.amber, 0.5) });
    D.text(g, title, bx + 14, by + 25, { size: 18, weight: 700, color: C.amber });
    lines.forEach((l, i) => D.rich(g, l, bx + 14, by + 50 + i * 22, { size: 15, weight: 500, color: C.ink, hl: C.amber }));
  };
  SH.isHover = (env, id) => env.hover && env.hover.id === id;
  // 노드를 그리고 클릭/드래그 영역을 등록
  SH.hitNode = (env, id, x, y, r, extra) => env.hit(Object.assign({ id, x, y, r: Math.max(r, 14) + 4 }, extra || {}));

  const NAMES = ['지민', '서준', '하윤', '도윤', '수아', '예준', '서연', '민준', '지우', '하준', '유나', '시우', '채원', '은우', '다인', '로아'];
  NA.NAMES = NAMES;

  /* =====================================================================
   * 1. 시작 — 세상은 연결되어 있다
   * ===================================================================== */
  scene({
    id: 'intro',
    chapter: '시작하며',
    dur: 21,
    captions: [
      [0.4, '우리 주변은 온통 **연결**로 가득합니다.'],
      [5, '친구 관계, 지하철 노선, 웹페이지의 링크, 논문의 인용까지…'],
      [11.2, '이 연결의 **구조**를 들여다보는 방법이 바로 **네트워크 분석**입니다.'],
      [16.4, '점과 선, 단 두 가지로 시작해 볼까요?'],
    ],
    init() {
      const rnd = U.rng(11);
      const pts = [];
      let guard = 0;
      while (pts.length < 36 && guard++ < 8000) {
        const p = { x: 60 + rnd() * 1160, y: 60 + rnd() * 600 };
        if (pts.every((q) => U.dist(p.x, p.y, q.x, q.y) > 112)) pts.push(p);
      }
      const E = [], seen = new Set();
      pts.forEach((p, i) => {
        pts.map((q, j) => [j, U.dist(p.x, p.y, q.x, q.y)])
          .filter(([j]) => j !== i)
          .sort((a, b) => a[1] - b[1])
          .slice(0, 2)
          .forEach(([j]) => {
            const k = Math.min(i, j) + '-' + Math.max(i, j);
            if (!seen.has(k)) { seen.add(k); E.push([i, j]); }
          });
      });
      const md = Math.max(...pts.map((p) => U.dist(p.x, p.y, 640, 360)));
      pts.forEach((p) => {
        p.t0 = 0.3 + (U.dist(p.x, p.y, 640, 360) / md) * 2.4;
        p.ph = rnd() * 6.28;
        p.c = rnd() < 0.3 ? NA.PALETTE[Math.floor(rnd() * 6)] : C.node;
        p.r = 6 + rnd() * 5;
      });
      const mid = (e) => U.dist((pts[e[0]].x + pts[e[1]].x) / 2, (pts[e[0]].y + pts[e[1]].y) / 2, 640, 360);
      E.sort((a, b) => mid(a) - mid(b));
      E.forEach((e, i) => (e.t0 = 2.4 + (i / E.length) * 4.4));
      const cards = [
        { title: '친구 관계', icon: 'person', color: C.coral, edges: [[0, 1], [0, 2], [1, 3], [2, 3], [0, 3]], arrows: false },
        { title: '지하철 노선', icon: 'station', color: C.mint, edges: [[0, 1], [1, 3], [0, 2], [2, 3]], arrows: false, subway: true },
        { title: '웹페이지 링크', icon: 'page', color: C.sky, edges: [[0, 1], [1, 3], [2, 0], [3, 2], [2, 1]], arrows: true },
        { title: '논문 인용', icon: 'doc', color: C.lilac, edges: [[1, 0], [2, 0], [3, 1], [3, 2]], arrows: true },
      ];
      return { pts, E, cards };
    },
    draw(g, t, S) {
      const netA = 1 - 0.82 * U.easeInOut(U.seg(t, 5, 6)) + 0.34 * U.easeInOut(U.seg(t, 11.2, 12.6));
      const P = S.pts.map((p) => ({ x: p.x + Math.sin(t * 0.6 + p.ph) * 5, y: p.y + Math.cos(t * 0.45 + p.ph) * 5 }));
      for (const e of S.E) {
        const a = P[e[0]], b = P[e[1]];
        D.edge(g, a.x, a.y, b.x, b.y, { p: U.inn(t, e.t0, 0.8), w: 2, color: C.edge, a: 0.65 * netA });
      }
      S.pts.forEach((p, i) => {
        const s = U.backOut(U.seg(t, p.t0, p.t0 + 0.55));
        const glow = t > 12 ? 0.5 + 0.5 * Math.sin(t * 2 + p.ph * 3) : 0;
        D.node(g, P[i].x, P[i].y, p.r * s, { fill: p.c, a: netA, halo: glow > 0.8 ? 10 * (glow - 0.8) * 5 : 0 });
      });
      // 링크를 타고 흐르는 빛 (제목 장면)
      if (t > 12) {
        for (let k = 0; k < 7; k++) {
          const raw = (t - 12) / 1.7 + k * 0.53;
          const e = S.E[(k * 11 + Math.floor(raw) * 7) % S.E.length];
          const pr = raw % 1;
          const a = P[e[0]], b = P[e[1]];
          D.pulse(g, a.x, a.y, b.x, b.y, pr, { r: 3.5, a: Math.sin(pr * Math.PI) * U.seg(t, 12, 13), halo: 9 });
        }
      }
      // 예시 카드 네 장
      const rel = [[-58, -38], [56, -46], [-38, 44], [60, 36]];
      S.cards.forEach((c, i) => {
        const a = U.vis(t, 5.2 + i * 0.55, 11.3, 0.5);
        if (a <= 0) return;
        const pop = U.backOut(U.seg(t, 5.2 + i * 0.55, 5.8 + i * 0.55));
        const cx = 640 + (i - 1.5) * 280, cy = 345 + (1 - pop) * 30;
        D.panel(g, cx - 120, cy - 120, 240, 240, { r: 22, fill: U.rgba('#08161c', 0.85), stroke: U.rgba(c.color, 0.45), a });
        const pts = rel.map(([dx, dy]) => ({ x: cx + dx, y: cy - 18 + dy }));
        c.edges.forEach(([u, v], k) => {
          const pe = U.inn(t, 5.6 + i * 0.55 + k * 0.12, 0.4);
          if (c.subway) {
            D.edge(g, pts[u].x, pts[u].y, pts[v].x, pts[v].y, { w: 7, color: k < 2 ? C.mint : C.amber, a: a, p: pe });
          } else {
            D.edge(g, pts[u].x, pts[u].y, pts[v].x, pts[v].y, { w: 2.5, color: U.mix(C.edge, c.color, 0.4), a, p: pe, arrow: c.arrows ? 1 : 0, r1: 18, r2: 18 });
          }
        });
        pts.forEach((p) => {
          if (c.subway) {
            D.node(g, p.x, p.y, 15, { fill: '#f4f7f6', stroke: C.bg, lw: 2, a });
            D.icon(g, 'station', p.x, p.y, 20, '#20343b', a);
          } else {
            D.node(g, p.x, p.y, 18, { fill: c.color, a });
            D.icon(g, c.icon, p.x, p.y, 22, C.bg, a);
          }
        });
        D.text(g, c.title, cx, cy + 92, { size: 24, kind: 'display', color: C.ink, align: 'center', a });
      });
      // 제목
      const ta = U.inn(t, 11.9, 1.0);
      if (ta > 0) {
        const glow = g.createRadialGradient(640, 345, 20, 640, 345, 440);
        glow.addColorStop(0, U.rgba('#061218', 0.88 * ta));
        glow.addColorStop(1, U.rgba('#061218', 0));
        g.fillStyle = glow;
        g.fillRect(0, 0, D.W, D.H);
        const dy = (1 - ta) * 24;
        D.text(g, 'NETWORK ANALYSIS', 640, 262 + dy, { size: 18, kind: 'mono', weight: 600, color: C.amber, align: 'center', a: ta, spacing: 8 });
        D.text(g, '네트워크 분석', 640, 368 + dy, { size: 112, kind: 'display', color: C.ink, align: 'center', a: ta, shadow: 24 });
        D.text(g, '점과 선으로 세상의 연결을 읽는 법', 640, 428 + dy, { size: 30, weight: 500, color: C.dim, align: 'center', a: U.inn(t, 12.6, 1.0) });
      }
    },
  });

  /* =====================================================================
   * 2. 노드와 링크
   * ===================================================================== */
  scene({
    id: 'nodes',
    chapter: '노드와 링크',
    kicker: '01 · 네트워크의 재료',
    title: '점과 선: 노드와 링크',
    dur: 25,
    captions: [
      [0.4, '네트워크는 딱 두 가지 재료로 만들어집니다.'],
      [2.6, '첫째, 점. **노드**(node)라고 부르고, 사람·역·웹페이지 같은 **대상**을 뜻해요.'],
      [7.6, '둘째, 선. **링크**(link) 또는 **엣지**(edge)라고 부르고, 대상 사이의 **관계**를 뜻합니다.'],
      [13, '점과 선만 있으면 어떤 관계든 네트워크로 그릴 수 있어요.'],
      [18.4, '배치가 달라져도 누가 누구와 연결됐는지가 같으면 **같은 네트워크**입니다.'],
    ],
    init() {
      const A = [
        { x: 520, y: 300 }, { x: 760, y: 290 }, { x: 640, y: 430 }, { x: 390, y: 420 }, { x: 880, y: 420 },
        { x: 300, y: 270 }, { x: 1000, y: 285 }, { x: 520, y: 530 }, { x: 780, y: 540 },
      ];
      const E = [[0, 1], [0, 2], [1, 2], [0, 3], [3, 5], [0, 5], [1, 4], [4, 6], [1, 6], [2, 7], [3, 7], [2, 8], [4, 8], [7, 8]];
      const circ = G.circle(9, 640, 392, 180);
      // 원형 배치에서 이웃끼리 꼬이지 않게 순서를 정함
      const order = [0, 1, 6, 4, 8, 2, 7, 3, 5];
      const B = new Array(9);
      order.forEach((nid, k) => (B[nid] = circ[k]));
      const g2 = G.make(9, E);
      return { A, B, E, deg: G.degree(g2), off: {} };
    },
    draw(g, t, S, env) {
      const intro = [{ x: 470, y: 340 }, { x: 810, y: 340 }];
      const mv = U.easeInOut(U.seg(t, 13, 14.6));
      const morph = U.easeInOut(U.seg(t, 18.8, 20.8)) - U.easeInOut(U.seg(t, 22.3, 24.1));
      const P = S.A.map((a, i) => {
        let p = { x: U.lerp(a.x, S.B[i].x, morph), y: U.lerp(a.y, S.B[i].y, morph) };
        if (i < 2) p = { x: U.lerp(intro[i].x, p.x, mv), y: U.lerp(intro[i].y, p.y, mv) };
        return SH.pos(S, i, p);
      });
      const appear = (i) => (i === 0 ? 0.8 : i === 1 ? 6.6 : 13.6 + (i - 2) * 0.32);
      // 링크
      S.E.forEach(([a, b], k) => {
        const t0 = k === 0 ? 7.3 : 14.3 + k * 0.26;
        const big = k === 0 && t < 14;
        D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, {
          p: U.inn(t, t0, k === 0 ? 1.4 : 0.5, U.easeInOut), w: big ? U.lerp(7, 3, mv) : 3,
          color: k === 0 ? U.mix(C.amber, C.edge, mv) : C.edge,
          glow: k === 0 && t > 8 && t < 13 ? 14 : 0,
        });
      });
      // 노드
      for (let i = 0; i < 9; i++) {
        const s = U.backOut(U.seg(t, appear(i), appear(i) + 0.55));
        const r = (i < 2 ? U.lerp(34, 20, mv) : 20) * s;
        const hov = SH.isHover(env, 'n' + i);
        D.node(g, P[i].x, P[i].y, r, {
          fill: i === 0 ? C.coral : i === 1 ? C.sky : C.node,
          label: NAMES[i], labelSize: i < 2 ? U.lerp(24, 17, mv) : 17, ring: hov ? 1 : 0,
          halo: i === 0 && t > 2.5 && t < 7.5 ? 18 : 0, haloColor: C.coral,
        });
        if (s > 0.5) SH.hitNode(env, 'n' + i, P[i].x, P[i].y, r, { drag: i, node: i });
      }
      // 설명 상자
      D.callout(g, 446, 366, 200, 452, '노드 (Node)', '점 · 사람, 역, 웹페이지 같은 **대상**', { a: U.vis(t, 2.4, 12.8), color: C.coral });
      D.callout(g, 640, 334, 640, 266, '링크 (Link) · 엣지 (Edge)', '선 · 대상 사이의 **관계**', { a: U.vis(t, 8.2, 12.8), color: C.amber, align: 'center' });
      D.badge(g, '배치는 달라도 연결이 같으면 **같은 네트워크**', 640, 150, { a: U.vis(t, 19.2, 24.8), size: 19 });
      // 마우스 설명
      const h = env.hover;
      if (h && h.node != null) SH.tip(g, P[h.node].x, P[h.node].y, NAMES[h.node], [`연결된 링크 **${S.deg[h.node]}개**`, '끌어서 옮길 수 있어요']);
    },
    panel: {
      html: `<p><b>노드를 끌어서</b> 옮겨 보세요. 링크는 끊어지지 않고 따라옵니다. 그림의 모양이 바뀌어도 <b>연결 관계</b>는 그대로라는 점이 핵심이에요.</p>
             <div class="row"><button type="button" data-act="reset">배치 되돌리기</button></div>`,
      bind(el, S) {
        el.querySelector('[data-act="reset"]').onclick = () => { S.off = {}; };
      },
    },
  });

  /* =====================================================================
   * 3. 관계의 종류 — 무방향 / 방향 / 가중
   * ===================================================================== */
  scene({
    id: 'types',
    chapter: '방향과 가중치',
    kicker: '02 · 네트워크의 종류',
    title: '관계에도 종류가 있다',
    dur: 26,
    captions: [
      [0.4, '관계에도 종류가 있습니다.'],
      [2.6, '친구처럼 서로 주고받는 관계는 방향이 없는 **무방향 네트워크**예요.'],
      [7.6, 'SNS 팔로우처럼 한쪽으로만 향할 수 있으면 화살표가 있는 **방향 네트워크**입니다.'],
      [14.6, '관계의 세기(연락 횟수, 거래액)를 선의 굵기로 나타내면 **가중 네트워크**가 되지요.'],
      [20.8, '방향과 가중치를 함께 가진 네트워크도 있어요. 나라 사이의 무역처럼요.'],
    ],
    init() {
      const P = G.circle(6, 520, 385, 185, -Math.PI / 2);
      // [a, b, 방향('ab' | 'ba' | 'both'), 가중치]
      const E = [[0, 1, 'both', 6], [1, 2, 'ab', 2], [2, 3, 'both', 9], [3, 4, 'ab', 1], [4, 5, 'ba', 3], [5, 0, 'ab', 2], [0, 2, 'ab', 4], [3, 5, 'both', 5]];
      return { P, E, off: {} };
    },
    draw(g, t, S, env) {
      const ov = S.ov;
      const dirT = U.easeOut(U.seg(t, 8, 9.2)) - U.easeOut(U.seg(t, 14.6, 15.3)) + U.easeOut(U.seg(t, 21, 22));
      const wT = U.easeInOut(U.seg(t, 15.2, 16.8));
      const dir = SH.tw(S, 'dir', ov ? (ov.dir ? 1 : 0) : dirT, env);
      const wt = SH.tw(S, 'wt', ov ? (ov.w ? 1 : 0) : wT, env);
      const P = S.P.map((p, i) => SH.pos(S, i, p));
      const app = (i) => U.backOut(U.seg(t, 0.3 + i * 0.12, 0.85 + i * 0.12));
      S.E.forEach(([a, b, d, w], k) => {
        const width = U.lerp(3, 1.2 + w * 1.25, wt);
        const col = U.mix(C.edge, C.sky, wt * (w / 9));
        D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, {
          p: U.inn(t, 0.8 + k * 0.1, 0.5), w: width, color: col, r1: 24, r2: 24,
          arrow: d === 'ab' || d === 'both' ? dir : 0, arrowBack: d === 'ba' || d === 'both' ? dir : 0,
        });
        if (wt > 0.02) {
          const mx = (P[a].x + P[b].x) / 2, my = (P[a].y + P[b].y) / 2;
          D.node(g, mx, my, 14 * wt, { fill: C.bg, stroke: col, lw: 2 });
          D.text(g, w, mx, my + 1, { size: 15, kind: 'mono', weight: 600, color: C.ink, align: 'center', base: 'middle', a: wt });
        }
      });
      for (let i = 0; i < 6; i++) {
        const hov = SH.isHover(env, 'n' + i);
        D.node(g, P[i].x, P[i].y, 22 * app(i), { fill: C.node, label: NAMES[i], ring: hov ? 1 : 0 });
        SH.hitNode(env, 'n' + i, P[i].x, P[i].y, 22, { drag: i });
      }
      // 오른쪽 설명 카드 세 장
      const cards = [
        { t: '무방향 네트워크', s: '예: 친구, 공동 연구, 동창', at: 2.6, on: ov ? !ov.dir && !ov.w : t < 7.6, color: C.mint, ic: 'undirected' },
        { t: '방향 네트워크', s: '예: SNS 팔로우, 이메일, 인용', at: 7.6, on: ov ? ov.dir : (t >= 7.6 && t < 14.6) || t >= 20.8, color: C.coral, ic: 'directed' },
        { t: '가중 네트워크', s: '예: 연락 횟수, 거래액, 통행량', at: 14.6, on: ov ? ov.w : t >= 14.6, color: C.sky, ic: 'weighted' },
      ];
      cards.forEach((c, i) => {
        const a = U.inn(t, c.at, 0.6);
        if (a <= 0) return;
        const x = 850, y = 165 + i * 128;
        const lit = SH.tw(S, 'card' + i, c.on ? 1 : 0.32, Object.assign({}, env, { dt: env.dt }), 6);
        const la = ov ? lit : c.on ? 1 : 0.32;
        D.panel(g, x, y, 370, 108, { r: 16, fill: U.rgba('#08161c', 0.8), stroke: U.rgba(c.color, 0.25 + 0.5 * la), a: a * (0.55 + 0.45 * la) });
        // 작은 그림
        const ix = x + 52, iy = y + 54;
        const pa = { x: ix - 26, y: iy }, pb = { x: ix + 26, y: iy };
        D.edge(g, pa.x, pa.y, pb.x, pb.y, { w: c.ic === 'weighted' ? 7 : 2.5, color: c.color, r1: 9, r2: 9, arrow: c.ic === 'directed' ? 1 : 0, a: a * la });
        D.node(g, pa.x, pa.y, 9, { fill: C.node, a: a * la });
        D.node(g, pb.x, pb.y, 9, { fill: C.node, a: a * la });
        D.text(g, c.t, x + 110, y + 48, { size: 27, kind: 'display', color: c.color, a: a * la });
        D.text(g, c.s, x + 110, y + 78, { size: 16, color: C.ink, a: a * (0.4 + 0.6 * la) });
      });
    },
    panel: {
      html: `<p>스위치를 켜고 끄며 같은 관계를 세 가지 방식으로 보세요. <b>화살표</b>는 관계의 방향, <b>선의 굵기와 숫자</b>는 관계의 세기입니다.</p>
             <div class="row">
               <label class="switch"><input type="checkbox" id="ty-dir"> 방향(화살표)</label>
               <label class="switch"><input type="checkbox" id="ty-w"> 가중치(굵기)</label>
             </div>`,
      bind(el, S, player) {
        const d = el.querySelector('#ty-dir'), w = el.querySelector('#ty-w');
        const sync = () => { S.ov = { dir: d.checked, w: w.checked }; player.pause(); };
        d.onchange = sync; w.onchange = sync;
        S.syncPanel = () => { if (!S.ov) { d.checked = false; w.checked = false; } };
      },
    },
  });

  /* =====================================================================
   * 4. 데이터로 표현하기 — 엣지 리스트와 인접 행렬
   * ===================================================================== */
  scene({
    id: 'data',
    chapter: '엣지 리스트와 인접 행렬',
    kicker: '03 · 네트워크 데이터',
    title: '표로 바꿔 보기',
    dur: 30,
    captions: [
      [0.4, '컴퓨터는 그림이 아니라 **표**로 네트워크를 이해합니다.'],
      [3.2, '첫 번째 방법은 **엣지 리스트**. 연결된 두 노드를 한 줄에 하나씩 적어요.'],
      [9.6, '가장 흔히 쓰는 형식이라 엑셀이나 CSV 파일로 쉽게 만들 수 있습니다.'],
      [14.6, '두 번째 방법은 **인접 행렬**. 연결되어 있으면 1, 아니면 0을 적습니다.'],
      [21.6, '무방향 네트워크라면 행렬이 대각선을 기준으로 **대칭**이 돼요.'],
      [26, '엣지 리스트와 인접 행렬, 담긴 정보는 똑같습니다.'],
    ],
    init() {
      return {
        L: ['A', 'B', 'C', 'D', 'E'],
        P: [{ x: 170, y: 255 }, { x: 375, y: 245 }, { x: 280, y: 385 }, { x: 180, y: 520 }, { x: 385, y: 505 }],
        E: [[0, 1], [0, 2], [1, 2], [2, 3], [3, 4]],
        off: {},
      };
    },
    draw(g, t, S, env) {
      const ov = S.ov;
      const edges = ov ? ov.edges : S.E;
      const has = (a, b) => edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
      const P = S.P.map((p, i) => SH.pos(S, i, p));
      const h = env.hover;
      // 지금 강조할 링크
      let focus = null;
      if (!ov) {
        if (t >= 4 && t < 9.5) focus = Math.floor((t - 4) / 1.1);
        else if (t >= 15.5 && t < 20.5) focus = Math.floor((t - 15.5) / 1.0);
        else if (t >= 26) focus = Math.floor((t - 26) / 0.9) % 5;
        if (focus != null && focus > 4) focus = null;
      }
      let fe = focus != null ? edges[focus] : null;
      if (h && h.cell) fe = has(h.cell[0], h.cell[1]) ? h.cell : null;
      if (h && h.row != null) fe = edges[h.row];
      const isF = (a, b) => fe && ((fe[0] === a && fe[1] === b) || (fe[0] === b && fe[1] === a));
      // 그래프
      edges.forEach(([a, b], k) => {
        const f = isF(a, b);
        D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, { p: ov ? 1 : U.inn(t, 0.9 + k * 0.18, 0.5), w: f ? 5 : 3, color: f ? C.amber : C.edge, glow: f ? 12 : 0, r1: 22, r2: 22 });
      });
      const hn = h && h.node != null ? h.node : null;
      for (let i = 0; i < 5; i++) {
        const f = fe && (fe[0] === i || fe[1] === i);
        D.node(g, P[i].x, P[i].y, 24 * U.backOut(U.seg(t, 0.3 + i * 0.1, 0.8 + i * 0.1)), {
          fill: f ? C.amber : C.node, text: S.L[i], textKind: 'display', textSize: 24, ring: hn === i ? 1 : 0,
        });
        SH.hitNode(env, 'n' + i, P[i].x, P[i].y, 24, { drag: i, node: i });
      }
      // 엣지 리스트
      const la = ov ? 1 : U.inn(t, 3.2, 0.5);
      const lx = 495, ly = 170, rowH = 34;
      if (la > 0) {
        D.text(g, '엣지 리스트', lx, ly - 14, { size: 22, kind: 'display', color: C.mint, a: la });
        const n = edges.length;
        D.panel(g, lx, ly, 210, 44 + Math.max(5, n) * rowH + 6, { r: 12, a: la });
        D.text(g, 'source', lx + 52, ly + 28, { size: 15, kind: 'mono', color: C.dim, align: 'center', a: la });
        D.text(g, 'target', lx + 156, ly + 28, { size: 15, kind: 'mono', color: C.dim, align: 'center', a: la });
        edges.forEach(([a, b], k) => {
          const ra = ov ? 1 : U.inn(t, 4.5 + k * 1.1, 0.4);
          if (ra <= 0) return;
          const y = ly + 44 + k * rowH;
          const f = isF(a, b);
          if (f) D.panel(g, lx + 6, y, 198, rowH - 4, { r: 8, fill: U.rgba(C.amber, 0.18), stroke: false, a: ra });
          const sx = (1 - ra) * -20;
          D.text(g, S.L[Math.min(a, b)], lx + 52 + sx, y + 23, { size: 20, kind: 'mono', weight: 600, color: f ? C.amber : C.ink, align: 'center', a: ra });
          D.text(g, '—', lx + 104 + sx, y + 22, { size: 16, color: C.faint, align: 'center', a: ra });
          D.text(g, S.L[Math.max(a, b)], lx + 156 + sx, y + 23, { size: 20, kind: 'mono', weight: 600, color: f ? C.amber : C.ink, align: 'center', a: ra });
          env.hit({ id: 'row' + k, x: lx, y, w: 210, h: rowH, row: k });
        });
        // 링크가 표로 날아가는 모습
        if (!ov && t >= 4 && t < 9.6) {
          const k = Math.floor((t - 4) / 1.1), lt = (t - 4) % 1.1;
          if (k < 5 && lt < 0.55) {
            const [a, b] = S.E[k];
            const p = U.easeInOut(lt / 0.55);
            const sx = (P[a].x + P[b].x) / 2, sy = (P[a].y + P[b].y) / 2;
            const tx = lx + 104, ty = ly + 44 + k * rowH + 16;
            D.badge(g, `${S.L[a]} — ${S.L[b]}`, U.lerp(sx, tx, p), U.lerp(sy, ty, p), { size: 16, a: 1 - p * 0.6, kind: 'mono' });
          }
        }
        D.badge(g, 'CSV · 엑셀 표 그대로', lx + 105, ly + 44 + 5 * rowH + 36, { size: 15, fill: C.mint, a: ov ? 0 : U.vis(t, 9.8, 14.6) });
      }
      // 인접 행렬
      const ma = ov ? 1 : U.inn(t, 14.6, 0.5);
      const mx = 812, my = 196, cs = 62;
      if (ma > 0) {
        D.text(g, '인접 행렬', mx - 36, ly - 14, { size: 22, kind: 'display', color: C.sky, a: ma });
        D.panel(g, mx - 44, ly, cs * 5 + 58, cs * 5 + 40, { r: 12, a: ma });
        for (let i = 0; i < 5; i++) {
          const hl = hn === i || (h && h.cell && (h.cell[0] === i || h.cell[1] === i));
          D.text(g, S.L[i], mx + i * cs + cs / 2, my - 2, { size: 18, kind: 'mono', weight: 600, color: hl ? C.amber : C.dim, align: 'center', a: ma });
          D.text(g, S.L[i], mx - 20, my + i * cs + cs / 2 + 14, { size: 18, kind: 'mono', weight: 600, color: hl ? C.amber : C.dim, align: 'center', a: ma });
        }
        for (let r = 0; r < 5; r++)
          for (let c = 0; c < 5; c++) {
            const x = mx + c * cs, y = my + 10 + r * cs;
            const on = has(r, c);
            const ei = S.E.findIndex(([a, b]) => (a === r && b === c) || (a === c && b === r));
            let ca = ov ? 1 : on && ei >= 0 ? U.inn(t, 15.5 + ei * 1.0, 0.35, U.backOut) : U.inn(t, 20.6 + (r + c) * 0.05, 0.4);
            if (!ov && on && ei < 0) ca = 1;
            const f = isF(r, c) || (h && h.cell && h.cell[0] === r && h.cell[1] === c);
            D.panel(g, x + 3, y + 3, cs - 6, cs - 6, {
              r: 9, fill: on ? U.rgba(f ? C.amber : C.sky, f ? 0.9 : 0.75) : U.rgba(C.ink, r === c ? 0.03 : 0.05),
              stroke: f ? C.amber : false, a: ma * Math.max(on ? 0 : 0.6, U.clamp(ca)),
            });
            D.text(g, on ? '1' : '0', x + cs / 2, y + cs / 2 + 9, { size: 24, kind: 'mono', weight: 600, color: on ? C.bg : C.faint, align: 'center', a: ma * U.clamp(ca) });
            if (r !== c) env.hit({ id: `c${r}-${c}`, x, y, w: cs, h: cs, cell: [r, c] });
          }
        // 대각선과 대칭
        const da = ov ? 0 : U.vis(t, 21.8, 26.2);
        if (da > 0) {
          const p = U.easeInOut(U.seg(t, 21.8, 23));
          g.save();
          g.globalAlpha *= da;
          g.strokeStyle = C.amber;
          g.lineWidth = 3;
          g.setLineDash([8, 8]);
          g.beginPath();
          g.moveTo(mx, my + 10);
          g.lineTo(mx + cs * 5 * p, my + 10 + cs * 5 * p);
          g.stroke();
          g.restore();
          const k = Math.floor((t - 23) / 0.6);
          if (t > 23 && k >= 0) {
            const [a, b] = S.E[k % 5];
            [[a, b], [b, a]].forEach(([r, c]) => {
              D.panel(g, mx + c * cs + 1, my + 10 + r * cs + 1, cs - 2, cs - 2, { r: 10, fill: 'transparent', stroke: C.amber, lw: 3, a: da });
            });
          }
          D.badge(g, '대각선 기준 대칭', mx + cs * 2.5, my + cs * 5 + 58, { size: 16, a: da });
        }
      }
      if (h && h.cell) {
        const [r, c] = h.cell;
        SH.tip(g, env.ptr.x, env.ptr.y, `${S.L[r]} 행 · ${S.L[c]} 열`, [has(r, c) ? `**1** — ${S.L[r]}와 ${S.L[c]}는 연결됨` : `**0** — 연결되지 않음`, '클릭하면 링크를 켜고 끕니다']);
      }
    },
    click(S, hit) {
      if (!hit.cell) return false;
      const [r, c] = hit.cell;
      const edges = (S.ov ? S.ov.edges : S.E).slice();
      const i = edges.findIndex(([a, b]) => (a === r && b === c) || (a === c && b === r));
      if (i >= 0) edges.splice(i, 1);
      else edges.push([Math.min(r, c), Math.max(r, c)]);
      edges.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      S.ov = { edges };
      return true;
    },
    panel: {
      html: `<p><b>행렬의 칸을 클릭</b>해 링크를 켜고 꺼 보세요. 왼쪽 그림과 가운데 엣지 리스트가 함께 바뀝니다. 칸 하나를 바꾸면 대칭 위치의 칸도 같이 바뀌는 이유는 이 네트워크가 무방향이기 때문이에요.</p>
             <div class="row"><button type="button" data-act="reset">처음 데이터로</button></div>`,
      bind(el, S, player) {
        el.querySelector('[data-act="reset"]').onclick = () => { S.ov = { edges: S.E.slice() }; player.pause(); };
      },
    },
  });

  /* =====================================================================
   * 5. 연결정도 (Degree)
   * ===================================================================== */
  scene({
    id: 'degree',
    chapter: '연결정도와 허브',
    kicker: '04 · 얼마나 많이 연결되었나',
    title: '연결정도 (Degree)',
    dur: 35,
    captions: [
      [0.4, '가장 기본적인 지표는 **연결정도**(degree)입니다.'],
      [3.4, '한 노드에 붙은 링크의 수예요. 이 노드는 링크가 3개니까 연결정도가 **3**.'],
      [10, '친구 네트워크라면 그냥 **친구 수**라고 생각하면 됩니다.'],
      [15, '유난히 링크가 많은 노드를 **허브**(hub)라고 불러요.'],
      [20, '노드를 연결정도별로 쌓아 보면 **연결정도 분포**가 나옵니다.'],
      [24.6, '대부분은 연결이 적고, 소수만 아주 많지요.'],
      [28.4, '방향 네트워크에서는 들어오는 링크(**in-degree**)와 나가는 링크(**out-degree**)를 따로 셉니다.'],
    ],
    init() {
      const E = [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 8], [1, 9], [1, 2], [2, 10], [3, 4], [3, 11], [5, 12]];
      const gr = G.make(13, E);
      // 여러 시드 중 가로로 넓게 퍼지는 배치를 고름 (화면을 고르게 쓰도록)
      let P = null, best = -1;
      for (let seed = 1; seed <= 24; seed++) {
        const Q = G.layout(13, E, { x: 0, y: 0, w: 100, h: 100 }, { seed, iters: 500, fit: false });
        const xs = Q.map((p) => p.x), ys = Q.map((p) => p.y);
        const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
        const score = -Math.abs(w / h - 1.55);
        if (score > best || !P) { best = score; P = Q; }
      }
      G.fit(P, { x: 110, y: 165, w: 640, h: 410 });
      const deg = G.degree(gr);
      // 연결정도별 쌓기 순서
      const stackIdx = [];
      const cnt = {};
      deg.forEach((d, i) => { cnt[d] = (cnt[d] || 0) + 1; stackIdx[i] = cnt[d] - 1; });
      return { E, gr, P, deg, stackIdx, off: {}, focus: 2 };
    },
    draw(g, t, S, env) {
      const P = S.P.map((p, i) => SH.pos(S, i, p));
      const inset = U.easeInOut(U.seg(t, 28, 29));
      const mainA = 1 - inset;
      const sizeT = U.easeInOut(U.seg(t, 10, 11.5));
      const h = env.hover;
      const sel = S.sel != null ? S.sel : h && h.node != null ? h.node : null;
      // 3을 세는 장면
      const f = S.focus;
      const nb = S.gr.adj[f];
      const countStep = (k) => U.seg(t, 4.4 + k * 1.3, 4.8 + k * 1.3);
      const counting = t >= 3.4 && t < 10;
      S.E.forEach(([a, b]) => {
        let col = C.edge, w = 2.5, glow = 0;
        if (counting && (a === f || b === f)) {
          const o = a === f ? b : a;
          const k = nb.indexOf(o);
          const c = countStep(k);
          if (c > 0) { col = U.mix(C.edge, C.amber, c); w = 2.5 + 2.5 * c; glow = 10 * c; }
        }
        if (sel != null && (a === sel || b === sel)) { col = C.amber; w = 5; }
        D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, { w, color: col, glow, a: mainA * U.inn(t, 0.6, 0.8) });
      });
      for (let i = 0; i < 13; i++) {
        const d = S.deg[i];
        const r = U.lerp(14, 11 + 3.6 * d, sizeT) * U.backOut(U.seg(t, 0.2 + i * 0.05, 0.7 + i * 0.05));
        const isHub = d === 7;
        const hubA = U.vis(t, 15, 28.2) * (isHub ? 1 : 0);
        let fill = U.mix(C.node, C.amber, sizeT * Math.pow(d / 7, 1.2));
        if (counting && i === f) fill = C.coral;
        D.node(g, P[i].x, P[i].y, r, {
          fill, a: mainA, text: sizeT > 0.3 ? d : null, textSize: Math.max(12, r * 0.85),
          halo: isHub ? 26 * hubA : 0, ring: sel === i ? 1 : hubA, ringColor: sel === i ? C.amber : C.coral,
        });
        SH.hitNode(env, 'n' + i, P[i].x, P[i].y, r, { drag: i, node: i });
      }
      // 숫자 세기
      if (counting) {
        const p = P[f];
        nb.forEach((o, k) => {
          const c = countStep(k);
          if (c <= 0) return;
          const q = P[o];
          const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          D.node(g, mx, my, 13 * U.backOut(c), { fill: C.amber, text: k + 1, textSize: 14 });
        });
        const ba = U.vis(t, 8.4, 10.2);
        D.badge(g, '연결정도 = **3**', p.x, p.y - 46, { size: 18, a: ba, fill: C.coral });
      }
      const hp = P[S.deg.indexOf(7)];
      D.callout(g, hp.x + 34, hp.y, 800, hp.y - 20, '허브 (Hub)', '링크가 **7개**', { a: U.vis(t, 15.3, 20) * mainA, color: C.coral, size: 30, above: false });
      // 분포 (점 쌓기)
      const ha = U.inn(t, 19.6, 0.6) * mainA;
      const bx = 870, by = 545, bw = 46;
      if (ha > 0) {
        D.text(g, '연결정도 분포', bx, 182, { size: 24, kind: 'display', color: C.amber, a: ha });
        g.save();
        g.globalAlpha *= ha;
        g.strokeStyle = U.rgba(C.ink, 0.35);
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(bx - 8, by + 2); g.lineTo(bx + bw * 7 + 8, by + 2); g.stroke();
        g.restore();
        for (let k = 1; k <= 7; k++) D.text(g, k, bx + (k - 0.5) * bw, by + 26, { size: 16, kind: 'mono', color: C.dim, align: 'center', a: ha });
        D.text(g, '연결정도 k →', bx + bw * 7, by + 52, { size: 15, color: C.dim, align: 'right', a: ha });
        D.text(g, '↑ 노드 수', bx - 6, 212, { size: 15, color: C.dim, a: ha });
      }
      for (let i = 0; i < 13; i++) {
        const fly = U.easeInOut(U.seg(t, 20.2 + i * 0.22, 21.4 + i * 0.22));
        if (fly <= 0) continue;
        const d = S.deg[i];
        const tx = bx + (d - 0.5) * bw, ty = by - 18 - S.stackIdx[i] * 38;
        const x = U.lerp(P[i].x, tx, fly), y = U.lerp(P[i].y, ty, fly) - Math.sin(fly * Math.PI) * 60;
        D.node(g, x, y, U.lerp(11 + 3.6 * d, 16, fly), { fill: U.mix(C.node, C.amber, Math.pow(d / 7, 1.2)), a: mainA * Math.min(1, fly * 3) });
      }
      D.badge(g, '적은 연결이 대부분, 많은 연결은 드묾', bx + 160, 236, { size: 15, a: U.vis(t, 24.8, 28.2), fill: C.mint });
      // in / out-degree 설명
      if (inset > 0) {
        const cx = 640, cy = 395;
        const fol = [[-300, -130], [-330, -10], [-300, 110], [-180, 170]];
        const fng = [[260, -110], [290, 90]];
        fol.forEach(([dx, dy], k) => {
          const p = U.inn(t, 29 + k * 0.3, 0.5);
          D.edge(g, cx + dx, cy + dy, cx, cy, { w: 3.5, color: C.sky, arrow: 1, r1: 18, r2: 40, p, a: inset });
          D.node(g, cx + dx, cy + dy, 18, { fill: C.sky, a: inset });
          D.icon(g, 'person', cx + dx, cy + dy, 22, C.bg, inset);
        });
        fng.forEach(([dx, dy], k) => {
          const p = U.inn(t, 30.6 + k * 0.3, 0.5);
          D.edge(g, cx, cy, cx + dx, cy + dy, { w: 3.5, color: C.coral, arrow: 1, r1: 40, r2: 18, p, a: inset });
          D.node(g, cx + dx, cy + dy, 18, { fill: C.coral, a: inset });
          D.icon(g, 'person', cx + dx, cy + dy, 22, C.bg, inset);
        });
        D.node(g, cx, cy, 36, { fill: C.amber, a: inset, text: '나', textKind: 'display', textSize: 30 });
        D.panel(g, 130, 140, 320, 72, { r: 14, a: inset * U.inn(t, 30, 0.5), stroke: U.rgba(C.sky, 0.6) });
        D.rich(g, '팔로워 4명 → **in-degree 4**', 290, 184, { size: 21, align: 'center', hl: C.sky, a: inset * U.inn(t, 30, 0.5) });
        D.panel(g, 830, 140, 320, 72, { r: 14, a: inset * U.inn(t, 31.4, 0.5), stroke: U.rgba(C.coral, 0.6) });
        D.rich(g, '팔로잉 2명 → **out-degree 2**', 990, 184, { size: 21, align: 'center', hl: C.coral, a: inset * U.inn(t, 31.4, 0.5) });
      }
      if (h && h.node != null && inset < 0.5) SH.tip(g, P[h.node].x, P[h.node].y, `노드 ${h.node + 1}`, [`연결정도 **${S.deg[h.node]}**`, '클릭하면 이웃을 표시합니다']);
    },
    click(S, hit) {
      if (hit.node == null) return false;
      S.sel = S.sel === hit.node ? null : hit.node;
      return false;
    },
    // 선택이 있으면 해제만 하고(true), 없으면 영상 재생/정지로 넘김(false)
    clickEmpty(S) {
      if (S.sel == null) return false;
      S.sel = null;
      return true;
    },
    panel: {
      html: `<p>노드에 <b>마우스를 올리거나 클릭</b>하면 연결정도(붙어 있는 링크 수)와 이웃이 표시됩니다. 노드 크기와 숫자가 곧 연결정도예요.</p>`,
    },
  });

  /* =====================================================================
   * 6. 경로와 거리
   * ===================================================================== */
  scene({
    id: 'path',
    chapter: '경로와 거리',
    kicker: '05 · 얼마나 멀리 떨어져 있나',
    title: '경로와 거리',
    dur: 34,
    captions: [
      [0.4, '링크를 따라 노드에서 노드로 가는 길을 **경로**(path)라고 합니다.'],
      [5.2, '여러 경로 중 가장 짧은 것이 **최단 경로**, 그 길이가 두 노드 사이의 **거리**예요.'],
      [11, '한 노드에서 출발하면 1단계, 2단계… 파도처럼 퍼져 나갑니다.'],
      [16, '이렇게 하면 모든 노드까지의 거리를 한 번에 잴 수 있어요.'],
      [19.8, '가장 먼 두 노드의 거리는 **지름**(diameter), 모든 거리의 평균은 **평균 경로 길이**입니다.'],
      [26.4, '놀랍게도 세상 사람들은 평균 6단계 정도면 서로 닿는다고 해요. **작은 세상** 현상입니다.'],
    ],
    init() {
      const P = [
        { x: 150, y: 380 }, { x: 280, y: 255 }, { x: 285, y: 495 }, { x: 420, y: 190 }, { x: 435, y: 370 }, { x: 420, y: 560 },
        { x: 575, y: 255 }, { x: 585, y: 455 }, { x: 725, y: 175 }, { x: 735, y: 350 }, { x: 715, y: 560 },
        { x: 870, y: 250 }, { x: 880, y: 465 }, { x: 1010, y: 345 }, { x: 1130, y: 215 }, { x: 1140, y: 485 },
      ];
      const E = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [3, 6], [4, 6], [4, 7], [5, 7], [5, 10], [6, 8], [6, 9], [7, 9], [7, 10], [8, 11], [9, 11], [9, 12], [10, 12], [11, 13], [12, 13], [13, 14], [13, 15], [14, 15]];
      P.forEach((p) => (p.y += 22));
      const gr = G.make(16, E);
      const S0 = 0, T0 = 13;
      const longPath = [0, 2, 5, 10, 7, 9, 11, 13];
      const short = G.shortestPath(gr, S0, T0);
      const dist = G.bfs(gr, S0);
      const stats = G.pathStats(gr);
      const diaPath = G.shortestPath(gr, stats.pair[0], stats.pair[1]);
      return { P, E, gr, S0, T0, longPath, short, dist, stats, diaPath, off: {} };
    },
    draw(g, t, S, env) {
      const P = S.P.map((p, i) => SH.pos(S, i, p));
      const sw = U.easeInOut(U.seg(t, 26, 27));
      const mainA = 1 - 0.94 * sw;
      const ov = S.ov;
      const onPath = (path, a, b) => {
        if (!path) return -1;
        for (let k = 0; k < path.length - 1; k++) if ((path[k] === a && path[k + 1] === b) || (path[k] === b && path[k + 1] === a)) return k;
        return -1;
      };
      // 지금 보여줄 경로
      let path = null, pathCol = C.amber, prog = 1, label = null;
      if (ov && ov.sel && ov.sel.length === 2) {
        path = G.shortestPath(S.gr, ov.sel[0], ov.sel[1]);
        label = path ? `거리 = **${path.length - 1}**` : '연결 없음';
      } else if (!ov) {
        if (t >= 1.2 && t < 5.2) { path = S.longPath; pathCol = C.lilac; prog = U.seg(t, 1.4, 4.6); label = `경로 길이 **${S.longPath.length - 1}**`; }
        else if (t >= 5.2 && t < 10.8) { path = S.short; prog = U.seg(t, 5.6, 8.4); label = `최단 경로 · 거리 = **${S.short.length - 1}**`; }
        else if (t >= 19.8 && t < 26.2) { path = S.diaPath; pathCol = C.coral; prog = U.seg(t, 20.2, 22.4); }
      }
      const segs = path ? path.length - 1 : 0;
      S.E.forEach(([a, b]) => {
        const k = onPath(path, a, b);
        const lit = k >= 0 ? U.clamp(prog * segs - k) : 0;
        D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, { w: 2.5, color: C.edge, a: mainA * U.inn(t, 0.4, 0.8) });
        if (lit > 0) {
          const [x1, y1, x2, y2] = path[k] === a ? [P[a].x, P[a].y, P[b].x, P[b].y] : [P[b].x, P[b].y, P[a].x, P[a].y];
          D.edge(g, x1, y1, x2, y2, { w: 6, color: pathCol, p: lit, glow: 12, a: mainA });
        }
      });
      // BFS 물결
      const wave = !ov && t >= 11 && t < 19.8;
      const lvl = (d) => 11.4 + d * 1.15;
      if (wave) {
        const rr = (t - 11.4) * 150;
        const p0 = P[S.S0];
        for (let k = 0; k < 3; k++) {
          const r = rr - k * 60;
          if (r <= 0) continue;
          g.save();
          g.globalAlpha *= Math.max(0, 0.35 - r / 3000) * U.vis(t, 11, 19.8);
          g.strokeStyle = C.sky;
          g.lineWidth = 3;
          g.beginPath(); g.arc(p0.x, p0.y, r, 0, Math.PI * 2); g.stroke();
          g.restore();
        }
      }
      const sel = ov && ov.sel ? ov.sel : [];
      for (let i = 0; i < 16; i++) {
        let fill = C.node, text = null, ring = SH.isHover(env, 'n' + i) ? 1 : 0;
        if (!ov && t < 19.8 && t >= 1.2 && (i === S.S0 || i === S.T0) && t < 11) fill = i === S.S0 ? C.mint : C.coral;
        if (wave) {
          const d = S.dist[i];
          const on = U.seg(t, lvl(d), lvl(d) + 0.4);
          if (on > 0) { fill = U.mix(C.node, U.mix(C.sky, C.lilac, d / 6), on); text = d; }
        }
        if (!ov && t >= 19.8 && path && (i === path[0] || i === path[path.length - 1])) fill = C.coral;
        if (sel.includes(i)) { fill = sel[0] === i ? C.mint : C.coral; ring = 1; }
        const pop = wave ? 1 + 0.25 * Math.sin(U.seg(t, lvl(S.dist[i]), lvl(S.dist[i]) + 0.4) * Math.PI) : 1;
        D.node(g, P[i].x, P[i].y, 18 * pop * U.backOut(U.seg(t, 0.1 + i * 0.03, 0.6 + i * 0.03)), { fill, text, textSize: 17, a: mainA, ring });
        SH.hitNode(env, 'n' + i, P[i].x, P[i].y, 18, { drag: i, node: i });
      }
      if (!ov && t >= 1.2 && t < 11) {
        D.text(g, '출발', P[S.S0].x, P[S.S0].y + 44, { size: 17, weight: 700, color: C.mint, align: 'center', a: U.vis(t, 1.2, 11) });
        D.text(g, '도착', P[S.T0].x, P[S.T0].y + 44, { size: 17, weight: 700, color: C.coral, align: 'center', a: U.vis(t, 1.2, 11) });
      }
      // 경로 위 여행자
      if (path && path.length > 1 && !ov && t < 19.8) {
        const pts = path.map((i) => P[i]);
        const q = D.pathPoint(pts, prog);
        D.node(g, q.x, q.y, 8, { fill: '#ffffff', stroke: pathCol, lw: 3, halo: 14, haloColor: pathCol, a: prog < 1 ? 1 : 0.0 });
      }
      if (label) D.badge(g, label, 640, 132, { size: 19, fill: pathCol === C.lilac ? C.lilac : C.amber, a: ov ? 1 : U.vis(t, 1.6, t < 5.2 ? 5.2 : 10.8) });
      if (wave) D.badge(g, '숫자 = 출발점에서의 거리', 640, 132, { size: 18, fill: C.sky, a: U.vis(t, 12.2, 19.8) });
      if (!ov && t >= 19.8 && t < 26.4) {
        const a = U.vis(t, 20.4, 26.2);
        D.badge(g, `지름 = **${S.stats.diameter}**`, 520, 132, { size: 19, fill: C.coral, a });
        D.badge(g, `평균 경로 길이 = **${U.fmt(S.stats.avg, 2)}**`, 790, 132, { size: 19, fill: C.amber, a: U.vis(t, 22, 26.2) });
      }
      // 작은 세상: 여섯 단계
      if (sw > 0) {
        const xs = Array.from({ length: 7 }, (_, k) => 170 + k * 157);
        const y = 372;
        D.text(g, '여섯 단계 분리', 640, 222, { size: 50, kind: 'display', color: C.amber, align: 'center', a: sw, shadow: 14 });
        D.text(g, 'Six Degrees of Separation', 640, 258, { size: 17, kind: 'mono', color: C.dim, align: 'center', a: sw, spacing: 2 });
        for (let k = 0; k < 6; k++) {
          const p = U.inn(t, 27.6 + k * 0.5, 0.45);
          D.edge(g, xs[k], y, xs[k + 1], y, { w: 4, color: C.amber, p, r1: 30, r2: 30, a: sw });
          D.node(g, (xs[k] + xs[k + 1]) / 2, y - 34, 15 * U.backOut(p), { fill: C.amber, text: k + 1, textSize: 15, a: sw });
        }
        for (let k = 0; k < 7; k++) {
          const p = k === 0 ? 1 : U.backOut(U.seg(t, 27.4 + k * 0.5, 27.9 + k * 0.5));
          const col = k === 0 ? C.mint : k === 6 ? C.coral : C.node;
          D.node(g, xs[k], y, 28 * p, { fill: col, a: sw });
          D.icon(g, 'person', xs[k], y, 30 * p, C.bg, sw);
        }
        D.text(g, '나', xs[0], y + 58, { size: 20, weight: 700, color: C.mint, align: 'center', a: sw });
        D.text(g, '지구 반대편의 누군가', xs[6], y + 58, { size: 18, weight: 700, color: C.coral, align: 'center', a: sw * U.inn(t, 30.4, 0.5) });
        D.text(g, '1967년 밀그램의 편지 전달 실험 — 편지는 평균 약 6단계 만에 목적지에 닿았다', 640, 498, { size: 18, color: C.dim, align: 'center', a: sw * U.inn(t, 30, 0.6) });
      }
      const h = env.hover;
      if (h && h.node != null && sw < 0.5) {
        const sel0 = ov && ov.sel && ov.sel.length === 1 ? ov.sel[0] : null;
        if (sel0 != null && sel0 !== h.node) {
          const d = G.bfs(S.gr, sel0)[h.node];
          SH.tip(g, P[h.node].x, P[h.node].y, `거리 ${d}`, ['클릭하면 최단 경로를 표시']);
        } else SH.tip(g, P[h.node].x, P[h.node].y, `노드 ${h.node + 1}`, ['클릭해서 출발점·도착점을 고르세요']);
      }
    },
    click(S, hit) {
      if (hit.node == null) return false;
      const cur = S.ov && S.ov.sel ? S.ov.sel : [];
      let sel;
      if (cur.length === 1 && cur[0] !== hit.node) sel = [cur[0], hit.node];
      else sel = [hit.node];
      S.ov = { sel };
      return true;
    },
    panel: {
      html: `<p>노드 <b>두 개를 차례로 클릭</b>하면 그 사이의 최단 경로와 거리가 표시됩니다. 다른 길로 돌아가도 되지만, 거리는 언제나 <b>가장 짧은 길</b>의 링크 수예요.</p>`,
    },
  });

  /* =====================================================================
   * 7. 밀도
   * ===================================================================== */
  scene({
    id: 'density',
    chapter: '밀도',
    kicker: '06 · 얼마나 촘촘한가',
    title: '밀도 (Density)',
    dur: 27,
    captions: [
      [0.4, '이 네트워크는 얼마나 촘촘할까요? 그것을 재는 지표가 **밀도**(density)입니다.'],
      [5, '노드가 5개라면 만들 수 있는 링크는 최대 5×4÷2 = **10개**.'],
      [9, '그중 실제로 있는 링크가 4개라면, 밀도는 4 ÷ 10 = **0.4**입니다.'],
      [14.6, '모두가 모두와 연결되면 밀도는 **1**, 아무 연결도 없으면 **0**이에요.'],
      [20.2, '1,000명이 친구를 10명씩 사귀어도 밀도는 약 0.01. 현실의 큰 네트워크는 대부분 **듬성듬성**합니다.'],
    ],
    init() {
      return { real: ['0-1', '1-2', '0-3', '3-4'], off: {} };
    },
    geo(n) {
      const P = G.circle(n, 380, 395, n <= 5 ? 165 : 180);
      const pairs = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
      return { P, pairs };
    },
    draw(g, t, S, env) {
      const ov = S.ov;
      const n = ov ? ov.n : 5;
      const { P: P0, pairs } = this.geo(n);
      const P = P0.map((p, i) => SH.pos(S, 'd' + n + '-' + i, p));
      const sparse = ov ? 0 : U.easeInOut(U.seg(t, 20, 21));
      // 각 링크의 '존재' 정도 (0~1)
      const pres = pairs.map(([a, b], k) => {
        const key = a + '-' + b;
        if (ov) return ov.on.has(key) ? 1 : 0;
        const isReal = S.real.includes(key);
        let v = isReal ? U.easeOut(U.seg(t, 9.2 + S.real.indexOf(key) * 0.35, 9.6 + S.real.indexOf(key) * 0.35)) : 0;
        const fill = U.easeOut(U.seg(t, 15 + k * 0.12, 15.4 + k * 0.12));
        const empty = U.easeOut(U.seg(t, 17 + k * 0.08, 17.4 + k * 0.08));
        const back = isReal ? U.easeOut(U.seg(t, 19 + S.real.indexOf(key) * 0.15, 19.4 + S.real.indexOf(key) * 0.15)) : 0;
        if (t >= 15) v = isReal ? 1 : fill;
        if (t >= 17) v = (isReal ? 1 : fill) * (1 - empty);
        if (t >= 19) v = Math.max(v, back);
        return v;
      });
      const possA = (k) => (ov ? 1 : U.inn(t, 5.2 + k * 0.3, 0.3));
      pairs.forEach(([a, b], k) => {
        const hov = SH.isHover(env, 'p' + a + '-' + b);
        D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, { w: 2, color: hov ? C.amber : C.faint, dash: [6, 7], a: possA(k) * (1 - pres[k]) * (1 - sparse), r1: 22, r2: 22 });
        if (pres[k] > 0) D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, { w: 4, color: hov ? C.amber : C.sky, p: pres[k], a: 1 - sparse });
        // 클릭 영역: 링크 중간점
        env.hit({ id: 'p' + a + '-' + b, x: (P[a].x + P[b].x) / 2, y: (P[a].y + P[b].y) / 2, r: 16, pair: [a, b] });
      });
      for (let i = 0; i < n; i++) {
        D.node(g, P[i].x, P[i].y, 22 * (ov ? 1 : U.backOut(U.seg(t, 0.4 + i * 0.15, 0.9 + i * 0.15))), { fill: C.node, a: 1 - sparse, ring: SH.isHover(env, 'n' + i) ? 1 : 0 });
        SH.hitNode(env, 'n' + i, P[i].x, P[i].y, 22, { drag: 'd' + n + '-' + i });
      }
      // 수 세기
      const realN = pres.filter((v) => v > 0.5).length;
      const total = pairs.length;
      const dens = total ? realN / total : 0;
      const fa = (ov ? 1 : U.inn(t, 5, 0.5)) * (1 - sparse);
      const x0 = 700;
      if (fa > 0) {
        D.panel(g, x0, 160, 500, 400, { r: 18, a: fa });
        D.text(g, '가능한 링크 수', x0 + 32, 214, { size: 19, color: C.dim, a: fa });
        D.rich(g, `${n}×${n - 1}÷2 = **${total}**`, x0 + 468, 214, { size: 26, kind: 'mono', align: 'right', a: fa, hl: C.ink });
        const ra = (ov ? 1 : U.inn(t, 9, 0.5)) * (1 - sparse);
        D.text(g, '실제 링크 수', x0 + 32, 284, { size: 19, color: C.dim, a: ra });
        D.rich(g, `**${realN}**`, x0 + 468, 284, { size: 26, kind: 'mono', align: 'right', a: ra, hl: C.sky });
        const da = (ov ? 1 : U.inn(t, 10.4, 0.5)) * (1 - sparse);
        g.save(); g.globalAlpha *= da; g.strokeStyle = U.rgba(C.ink, 0.15); g.beginPath(); g.moveTo(x0 + 30, 320); g.lineTo(x0 + 470, 320); g.stroke(); g.restore();
        D.text(g, '밀도', x0 + 32, 378, { size: 30, kind: 'display', color: C.amber, a: da });
        D.rich(g, `${realN} ÷ ${total} = **${U.fmt(dens, 2)}**`, x0 + 468, 378, { size: 30, kind: 'mono', align: 'right', a: da, hl: C.amber });
        // 게이지
        const gw = 436, gx = x0 + 32, gy = 420;
        D.panel(g, gx, gy, gw, 22, { r: 11, fill: U.rgba(C.ink, 0.08), stroke: false, a: da });
        const shown = SH.tw(S, 'dens', dens, env, 9);
        if (shown > 0.005) D.panel(g, gx, gy, gw * shown, 22, { r: 11, fill: C.amber, stroke: false, a: da });
        ['0', '0.5', '1'].forEach((s, i) => D.text(g, s, gx + (gw * i) / 2, gy + 50, { size: 15, kind: 'mono', color: C.dim, align: 'center', a: da }));
        let note = '';
        if (realN === total && total) note = '완전 연결 — 모두가 모두와 연결';
        else if (realN === 0) note = '연결 없음';
        if (note) D.badge(g, note, x0 + 250, 520, { size: 16, a: da, fill: realN ? C.amber : C.faint, color: realN ? C.bg : C.ink });
      }
      // 큰 네트워크는 듬성듬성
      if (sparse > 0) {
        const cx = 640;
        D.text(g, '사람 1,000명 · 각자 친구 10명', 395, 190, { size: 32, kind: 'display', color: C.ink, align: 'center', a: sparse });
        const rows = [
          ['실제 링크', '1,000 × 10 ÷ 2', '5,000'],
          ['가능한 링크', '1,000 × 999 ÷ 2', '499,500'],
          ['밀도', '5,000 ÷ 499,500', '≈ 0.01'],
        ];
        rows.forEach(([a, b, c], i) => {
          const y = 270 + i * 64;
          const ra = sparse * U.inn(t, 21 + i * 0.6, 0.5);
          D.text(g, a, 120, y, { size: 21, color: i === 2 ? C.amber : C.dim, a: ra, weight: i === 2 ? 700 : 400 });
          D.text(g, b, 268, y, { size: 20, kind: 'mono', color: C.ink, a: ra });
          D.text(g, c, 680, y, { size: 24, kind: 'mono', weight: 600, color: i === 2 ? C.amber : C.ink, align: 'right', a: ra });
        });
        // 인접 행렬 미리보기: 40×40 칸 중 1%만 켜짐
        const gx = 790, gy = 160, cs = 9;
        const rnd = U.rng(5);
        const lit = new Set();
        while (lit.size < 16) { const r = Math.floor(rnd() * 40), c = Math.floor(rnd() * 40); if (r !== c) { lit.add(r * 40 + c); lit.add(c * 40 + r); } }
        const ga = sparse * U.inn(t, 22.4, 0.8);
        D.panel(g, gx - 10, gy - 10, 40 * cs + 20, 40 * cs + 20, { r: 10, a: ga });
        for (let r = 0; r < 40; r++)
          for (let c = 0; c < 40; c++) {
            const on = lit.has(r * 40 + c);
            g.save();
            g.globalAlpha *= ga;
            g.fillStyle = on ? C.amber : U.rgba(C.ink, 0.06);
            g.fillRect(gx + c * cs, gy + r * cs, cs - 1.5, cs - 1.5);
            g.restore();
          }
        D.text(g, '인접 행렬로 보면 거의 모든 칸이 0', gx + 180, gy + 40 * cs + 42, { size: 17, color: C.dim, align: 'center', a: ga });
      }
      const h = env.hover;
      if (h && h.pair) {
        const k = pairs.findIndex(([a, b]) => a === h.pair[0] && b === h.pair[1]);
        SH.tip(g, env.ptr.x, env.ptr.y, pres[k] > 0.5 ? '있는 링크' : '가능한 링크', ['클릭하면 켜고 끕니다']);
      }
    },
    click(S, hit) {
      if (!hit.pair) return false;
      if (!S.ov) S.ov = { n: 5, on: new Set(S.real) };
      const key = hit.pair[0] + '-' + hit.pair[1];
      if (S.ov.on.has(key)) S.ov.on.delete(key);
      else S.ov.on.add(key);
      return true;
    },
    panel: {
      html: `<p><b>점선(가능한 링크)을 클릭</b>하면 실제 링크로 바뀌고, 다시 누르면 사라져요. 노드 수를 바꿔 보면 가능한 링크 수가 n×(n−1)÷2로 빠르게 늘어나는 것을 볼 수 있습니다.</p>
             <div class="row">
               <button type="button" data-act="minus" aria-label="노드 하나 빼기">노드 −</button>
               <button type="button" data-act="plus" aria-label="노드 하나 더하기">노드 +</button>
               <button type="button" data-act="all">모두 연결</button>
               <button type="button" data-act="none">모두 끊기</button>
             </div>`,
      bind(el, S, player) {
        const ensure = () => { if (!S.ov) S.ov = { n: 5, on: new Set(S.real) }; player.pause(); };
        const setN = (n) => {
          ensure();
          n = Math.max(3, Math.min(9, n));
          const on = new Set([...S.ov.on].filter((k) => k.split('-').every((v) => +v < n)));
          S.ov = { n, on };
        };
        el.querySelector('[data-act="minus"]').onclick = () => { ensure(); setN(S.ov.n - 1); };
        el.querySelector('[data-act="plus"]').onclick = () => { ensure(); setN(S.ov.n + 1); };
        el.querySelector('[data-act="all"]').onclick = () => {
          ensure();
          const on = new Set();
          for (let i = 0; i < S.ov.n; i++) for (let j = i + 1; j < S.ov.n; j++) on.add(i + '-' + j);
          S.ov = { n: S.ov.n, on };
        };
        el.querySelector('[data-act="none"]').onclick = () => { ensure(); S.ov = { n: S.ov.n, on: new Set() }; };
      },
    },
  });
})();
