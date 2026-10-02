/* 장면 8~13: 중심성, 군집 계수, 커뮤니티, 네트워크 모델, 분석 흐름, 정리 */
(function () {
  'use strict';
  const NA = window.NA;
  const { U, C, D, G, SH } = NA;
  const scene = (def) => NA.scenes.push(def);
  const NAMES = NA.NAMES;

  /* =====================================================================
   * 8. 중심성 — 크랙하트의 연(kite) 네트워크
   * ===================================================================== */
  const MEASURES = {
    degree: { name: '연결정도 중심성', short: '연결정도', q: '친구가 가장 많은 사람은?', nick: '마당발', color: C.amber, n: '①' },
    close: { name: '근접 중심성', short: '근접', q: '모두에게 가장 빨리 닿는 사람은?', nick: '소식통', color: C.sky, n: '②' },
    betw: { name: '매개 중심성', short: '매개', q: '사람들 사이 길목에 선 사람은?', nick: '다리 · 문지기', color: C.coral, n: '③' },
    eig: { name: '아이겐벡터 중심성', short: '아이겐벡터', q: '중요한 사람과 연결된 사람은?', nick: '인맥왕', color: C.lilac, n: '④' },
  };
  NA.MEASURES = MEASURES;
  function centralities(gr, skip) {
    return {
      degree: G.degreeCentrality(gr, skip),
      close: G.closeness(gr, skip),
      betw: G.betweenness(gr, skip),
      eig: G.eigenvector(gr, skip),
    };
  }
  NA.centralities = centralities;

  scene({
    id: 'centrality',
    chapter: '중심성',
    kicker: '07 · 누가 중요한가',
    title: '중심성 (Centrality)',
    dur: 66,
    captions: [
      [0.4, '이 10명 중에서 누가 가장 **중요한** 사람일까요?'],
      [4.6, '답은 무엇을 중요하다고 보느냐에 따라 달라집니다. 이걸 재는 지표가 **중심성**이에요.'],
      [9.3, '① **연결정도 중심성**: 링크가 가장 많은 사람. 도윤이 6개로 1등, 마당발이죠.'],
      [15.2, '인기나 활동량을 볼 때 가장 먼저 쓰는 지표입니다.'],
      [21.3, '② **근접 중심성**: 다른 모든 사람까지의 거리가 가장 짧은 사람.'],
      [26.6, '예준과 서연은 누구에게든 3단계 안에 닿아요. 소식을 가장 빨리 퍼뜨릴 수 있지요.'],
      [34.3, '③ **매개 중심성**: 다른 사람들을 잇는 최단 경로 위에 얼마나 자주 서 있는가.'],
      [40.6, '민준은 친구가 3명뿐이지만, 민준이 빠지면 네트워크가 둘로 끊어집니다. 정보의 **다리**이자 **문지기**예요.'],
      [48.3, '④ **아이겐벡터 중심성**: 중요한 사람과 연결될수록 나도 중요해집니다.'],
      [53.6, '이웃에게서 점수를 받아 오기를 반복해 계산해요. 구글의 **페이지랭크**도 같은 아이디어지요.'],
      [58.4, '같은 네트워크라도 질문에 따라 1등이 바뀝니다. 연구 질문에 맞는 중심성을 고르세요!'],
    ],
    init() {
      // 크랙하트의 연: 0 Andre, 1 Beverly, 2 Carol, 3 Diane, 4 Ed, 5 Fernando, 6 Garth, 7 Heather, 8 Ike, 9 Jane
      const E = [[0, 1], [0, 2], [0, 3], [0, 5], [1, 3], [1, 4], [1, 6], [2, 3], [2, 5], [3, 4], [3, 5], [3, 6], [4, 6], [5, 6], [5, 7], [6, 7], [7, 8], [8, 9]];
      const grid = [[-1, -1], [-1, 1], [0, -2], [0, 0], [0, 2], [1, -1], [1, 1], [2, 0], [3, 0], [4, 0]];
      const u = 92;
      const P = grid.map(([x, y]) => ({ x: 300 + x * u, y: 372 + y * u }));
      const names = ['지민', '서준', '하윤', '도윤', '수아', '예준', '서연', '민준', '지우', '하준'];
      const gr = G.make(10, E);
      const cent = centralities(gr);
      const norm = {};
      Object.keys(cent).forEach((k) => (norm[k] = G.norm(cent[k])));
      const eigSteps = Array.from({ length: 9 }, (_, k) => G.norm(G.eigenvector(gr, null, k)));
      const distF = G.bfs(gr, 5);
      // 매개 중심성 장면: 꼬리(지우, 하준)에서 연 몸통으로 가는 최단 경로들
      const flows = [];
      [9, 8].forEach((s) => [0, 1, 2, 3, 4].forEach((t) => flows.push(G.shortestPath(gr, s, t))));
      return { E, P, names, gr, cent, norm, eigSteps, distF, flows, off: {} };
    },
    measureAt(t) {
      if (t < 9) return null;
      if (t < 21) return 'degree';
      if (t < 34) return 'close';
      if (t < 48) return 'betw';
      if (t < 58) return 'eig';
      return 'summary';
    },
    draw(g, t, S, env) {
      const ov = S.ov;
      const skip = ov && ov.removed && ov.removed.size ? ov.removed : null;
      let m = ov ? ov.measure : this.measureAt(t);
      // 사용자가 노드를 뺐다면 다시 계산
      let norm = S.norm, cent = S.cent;
      if (skip) {
        const key = [...skip].sort().join(',');
        if (S._skipKey !== key) {
          S._skipKey = key;
          S._cent = centralities(S.gr, skip);
          S._norm = {};
          Object.keys(S._cent).forEach((k) => (S._norm[k] = G.norm(S._cent[k])));
        }
        cent = S._cent; norm = S._norm;
      }
      // 목표 크기/색
      let vals = new Array(10).fill(0);
      if (m && m !== 'summary') vals = norm[m];
      if (!ov && m === 'eig') {
        const k = Math.min(8, Math.max(0, Math.floor((t - 49.4) / 0.6)));
        vals = t < 49.4 ? S.eigSteps[0] : S.eigSteps[k];
      }
      // 장면 전환 시 부드럽게: 영상 흐름에서는 직전 지표 값에서 보간
      let disp = vals;
      if (!ov) {
        const bounds = [[9, null], [21, 'degree'], [34, 'close'], [48, 'betw']];
        for (const [b, prev] of bounds) {
          if (t >= b && t < b + 1.4) {
            const from = prev ? S.norm[prev] : new Array(10).fill(0);
            const e = U.easeInOut(U.seg(t, b, b + 1.4));
            disp = vals.map((v, i) => U.lerp(from[i], v, e));
          }
        }
        if (m === 'summary') {
          const e = U.easeInOut(U.seg(t, 58, 59.4));
          disp = S.norm.eig.map((v) => U.lerp(v, 0, e));
        }
      }
      disp = SH.tw(S, 'size', disp, env, 6);
      const mc = m && MEASURES[m] ? MEASURES[m].color : C.amber;
      // 매개 중심성: 민준이 빠지는 장면
      const cut = !ov ? U.easeInOut(U.seg(t, 42.2, 43)) - U.easeInOut(U.seg(t, 46.6, 47.4)) : 0;
      const P = S.P.map((p, i) => {
        let q = SH.pos(S, i, p);
        if (cut > 0 && (i === 8 || i === 9)) q = { x: q.x + 60 * cut, y: q.y + 30 * cut };
        return q;
      });
      const removed = (i) => (skip && skip.has(i)) || (cut > 0 && i === 7);
      const h = env.hover;
      // 링크
      S.E.forEach(([a, b], k) => {
        const gone = removed(a) || removed(b);
        let ea = U.inn(t, 0.6 + k * 0.05, 0.5);
        if (skip && gone) ea *= 0.12;
        if (cut > 0 && gone) ea *= 1 - 0.85 * cut;
        const hl = h && h.node != null && (a === h.node || b === h.node);
        D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, { w: hl ? 4 : 2.6, color: hl ? C.amber : C.edge, a: ea, dash: skip && gone ? [5, 6] : null });
      });
      // 근접 중심성: 예준에게서 퍼지는 물결
      if (!ov && t >= 25.6 && t < 33.6) {
        const lv = (d) => 26.6 + d * 1.2;
        S.E.forEach(([a, b]) => {
          const da = S.distF[a], db = S.distF[b];
          if (Math.abs(da - db) !== 1) return;
          const [s, e] = da < db ? [a, b] : [b, a];
          const p = U.seg(t, lv(Math.min(da, db)), lv(Math.min(da, db)) + 1.0);
          if (p > 0) D.edge(g, P[s].x, P[s].y, P[e].x, P[e].y, { w: 4.5, color: C.sky, p: U.easeOut(p), glow: 10, r1: 16, r2: 16, a: U.vis(t, 25.6, 33.6) });
        });
      }
      // 매개 중심성: 최단 경로를 따라 흐르는 빛
      if (!ov && t >= 35.4 && t < 42) {
        S.flows.forEach((path, k) => {
          const st = 35.6 + (k % 5) * 0.55 + Math.floor(k / 5) * 0.3;
          const p = U.seg(t, st, st + 2.6);
          if (p <= 0 || p >= 1) return;
          const q = D.pathPoint(path.map((i) => P[i]), U.easeInOut(p));
          D.node(g, q.x, q.y, 5.5, { fill: C.coral, stroke: 'transparent', halo: 10, haloColor: C.coral });
        });
      }
      // 노드
      for (let i = 0; i < 10; i++) {
        const v = disp[i] || 0;
        const r = (16 + 22 * v) * U.backOut(U.seg(t, 0.2 + i * 0.07, 0.7 + i * 0.07));
        let fill = U.mix(C.node, mc, Math.pow(v, 1.4));
        if (m === 'summary' && !ov) {
          const sa = U.inn(t, 59, 0.8);
          const sc = i === 3 ? C.amber : i === 5 || i === 6 ? C.sky : i === 7 ? C.coral : C.node;
          fill = U.mix(C.node, sc, sa);
        }
        let a = 1;
        if (removed(i)) a = skip ? 0.25 : 1 - 0.75 * cut;
        const top = m && m !== 'summary' && v > 0.999;
        D.node(g, P[i].x, P[i].y, r, {
          fill, a, label: S.names[i], labelSize: 17, ring: (h && h.node === i) || top ? 1 : 0,
          ringColor: top ? mc : C.amber, halo: top ? 18 : 0, haloColor: mc,
        });
        if (!ov && t >= 26.6 && t < 33.6 && i !== 5) {
          const d = S.distF[i];
          D.node(g, P[i].x + r * 0.8, P[i].y - r * 0.8, 11 * U.backOut(U.seg(t, 26.6 + d * 1.2 + 0.6, 27.1 + d * 1.2 + 0.6)), { fill: C.sky, text: d, textSize: 13, a: U.vis(t, 26, 33.6) });
        }
        SH.hitNode(env, 'n' + i, P[i].x, P[i].y, r, { drag: i, node: i });
      }
      if (cut > 0) D.badge(g, '끊어짐!', (P[7].x + P[8].x) / 2 + 10, P[7].y - 56, { size: 20, fill: C.coral, a: cut });
      if (!ov && m === 'eig' && t >= 49.4) {
        const k = Math.min(8, Math.floor((t - 49.4) / 0.6));
        D.badge(g, `점수 주고받기 ${k}회`, 560, 136, { size: 17, fill: C.lilac, a: U.vis(t, 49.4, 58) });
      }
      // 오른쪽 패널
      const px = 790, pw = 430;
      if (!ov && t < 9) {
        const a = U.vis(t, 1.4, 9.2);
        D.text(g, '누가 가장', px + pw / 2, 300, { size: 52, kind: 'display', color: C.ink, align: 'center', a });
        D.text(g, '중요할까?', px + pw / 2, 362, { size: 52, kind: 'display', color: C.amber, align: 'center', a });
        D.text(g, '중요함의 기준은 하나가 아니에요', px + pw / 2, 420, { size: 19, color: C.dim, align: 'center', a: a * U.inn(t, 4.6, 0.6) });
      }
      if (m && m !== 'summary') {
        const M = MEASURES[m];
        const segStart = ov ? -10 : { degree: 9, close: 21, betw: 34, eig: 48 }[m];
        const a = ov ? 1 : U.inn(t, segStart, 0.6);
        const sx = (1 - a) * 30;
        D.panel(g, px + sx, 150, pw, 118, { r: 16, stroke: U.rgba(M.color, 0.6), a });
        D.text(g, `${M.n} ${M.name}`, px + 24 + sx, 194, { size: 30, kind: 'display', color: M.color, a });
        D.text(g, M.q, px + 24 + sx, 230, { size: 18, color: C.ink, a });
        D.badge(g, M.nick, px + pw - 22 + sx, 194 - 9, { size: 15, fill: M.color, align: 'right', a });
        // 순위 막대
        const order = [...Array(10).keys()].filter((i) => !(skip && skip.has(i))).sort((x, y) => cent[m][y] - cent[m][x] || x - y);
        const raw = cent[m];
        const mx = Math.max(...raw) || 1;
        order.forEach((i, k) => {
          const y = 298 + k * 30;
          const ba = a * U.inn(t, segStart + 0.6 + k * 0.06, 0.4);
          const w = (raw[i] / mx) * 250;
          D.text(g, S.names[i], px + 60, y + 15, { size: 16, weight: 600, color: k === 0 ? M.color : C.ink, align: 'right', a: ba });
          D.panel(g, px + 72, y + 2, Math.max(3, w * U.easeOut(ba)), 18, { r: 5, fill: U.rgba(M.color, k === 0 ? 1 : 0.55), stroke: false, a: ba });
          D.text(g, U.fmt(raw[i], 2), px + 82 + w, y + 16, { size: 14, kind: 'mono', color: C.dim, a: ba });
        });
      }
      if (!ov && m === 'summary') {
        const a = U.inn(t, 58.4, 0.6);
        const rows = [['degree', '도윤'], ['close', '예준 · 서연'], ['betw', '민준'], ['eig', '도윤']];
        D.panel(g, px - 20, 150, pw + 40, 380, { r: 18, a });
        D.text(g, '같은 네트워크, 다른 1등', px + pw / 2, 196, { size: 28, kind: 'display', color: C.ink, align: 'center', a });
        rows.forEach(([k, who], i) => {
          const M = MEASURES[k];
          const ra = a * U.inn(t, 59 + i * 0.5, 0.5);
          const y = 252 + i * 70;
          D.text(g, M.name, px + 4, y, { size: 21, kind: 'display', color: M.color, a: ra });
          D.text(g, M.q, px + 4, y + 26, { size: 15, color: C.dim, a: ra });
          D.badge(g, who, px + pw - 4, y - 6, { size: 18, fill: M.color, align: 'right', a: ra });
        });
      }
      if (h && h.node != null) {
        const i = h.node;
        SH.tip(g, P[i].x, P[i].y, S.names[i], Object.keys(MEASURES).map((k) => `${MEASURES[k].short} **${U.fmt(cent[k][i], 2)}**`));
      }
      if (skip) {
        const comps = G.components(S.gr, skip).count;
        D.badge(g, `${skip.size}명 빠짐 · 연결 덩어리 ${comps}개`, 560, 136, { size: 17, fill: comps > 1 ? C.coral : C.mint });
      }
    },
    click(S, hit) {
      if (hit.node == null) return false;
      const ov = S.ov || { measure: this.measureAt(S._lastT || 0) || 'degree', removed: new Set() };
      if (ov.measure === 'summary' || !ov.measure) ov.measure = 'betw';
      const removed = new Set(ov.removed);
      if (removed.has(hit.node)) removed.delete(hit.node);
      else removed.add(hit.node);
      S.ov = { measure: ov.measure, removed };
      if (S.syncPanel) S.syncPanel();
      return true;
    },
    panel: {
      html: `<p>지표를 바꾸면 노드 크기와 순위가 바뀝니다. 노드를 <b>클릭하면 그 사람을 네트워크에서 빼 볼 수</b> 있어요(다시 누르면 복귀). 민준을 빼면 어떻게 될까요?</p>
             <div class="row seg" role="radiogroup" aria-label="중심성 지표">
               <label><input type="radio" name="ce-m" value="degree"> 연결정도</label>
               <label><input type="radio" name="ce-m" value="close"> 근접</label>
               <label><input type="radio" name="ce-m" value="betw"> 매개</label>
               <label><input type="radio" name="ce-m" value="eig"> 아이겐벡터</label>
             </div>
             <div class="row"><button type="button" data-act="restore">빠진 사람 모두 되돌리기</button></div>`,
      bind(el, S, player) {
        const radios = [...el.querySelectorAll('input[name="ce-m"]')];
        radios.forEach((r) => (r.onchange = () => {
          S.ov = { measure: r.value, removed: S.ov && S.ov.removed ? S.ov.removed : new Set() };
          player.pause();
        }));
        el.querySelector('[data-act="restore"]').onclick = () => {
          S.ov = { measure: S.ov ? S.ov.measure : 'betw', removed: new Set() };
          S.syncPanel();
          player.pause();
        };
        S.syncPanel = () => {
          const cur = S.ov ? S.ov.measure : null;
          radios.forEach((r) => (r.checked = r.value === cur));
        };
      },
    },
  });

  /* =====================================================================
   * 9. 군집 계수
   * ===================================================================== */
  scene({
    id: 'clustering',
    chapter: '군집 계수',
    kicker: '08 · 끼리끼리 뭉치는 정도',
    title: '군집 계수 (Clustering)',
    dur: 28,
    captions: [
      [0.4, '내 친구들끼리도 서로 친구일까요?'],
      [3.4, '이것을 재는 지표가 **군집 계수**(clustering coefficient)입니다.'],
      [6.6, '친구가 4명이면, 그들끼리 맺을 수 있는 관계는 4×3÷2 = **6쌍**.'],
      [10, '실제로 3쌍이 친구라면 군집 계수는 3 ÷ 6 = **0.5**예요.'],
      [15, '나와 친구 둘이 이루는 **삼각형**이 많을수록 끈끈한 무리입니다.'],
      [21, '친구들이 서로 전혀 모르면 **0**, 모두 아는 사이면 **1**이에요.'],
    ],
    init() {
      const ego = { x: 330, y: 390 };
      const ang = [-63, -21, 21, 63].map((d) => (d * Math.PI) / 180);
      const F = ang.map((a) => ({ x: ego.x + 215 * Math.cos(a), y: ego.y + 215 * Math.sin(a) }));
      const pairs = [[0, 1], [1, 2], [2, 3], [0, 2], [1, 3], [0, 3]];
      return { ego, F, pairs, real: ['0-1', '1-2', '0-2'], names: ['서준', '하윤', '도윤', '수아'], off: {} };
    },
    draw(g, t, S, env) {
      const ov = S.ov;
      const cmp = ov ? 0 : U.easeInOut(U.seg(t, 20.6, 21.6));
      const ego = SH.pos(S, 'e', S.ego);
      const F = S.F.map((p, i) => SH.pos(S, i, p));
      const realOn = (key) => (ov ? ov.on.has(key) : S.real.includes(key));
      // 친구 쌍의 존재 정도
      const pres = S.pairs.map(([a, b]) => {
        const key = a + '-' + b;
        if (ov) return realOn(key) ? 1 : 0;
        const ri = S.real.indexOf(key);
        return ri >= 0 ? U.easeOut(U.seg(t, 10.2 + ri * 0.4, 10.6 + ri * 0.4)) : 0;
      });
      const possA = (k) => (ov ? 1 : U.inn(t, 6.8 + k * 0.4, 0.35));
      // 삼각형 채우기
      S.pairs.forEach(([a, b], k) => {
        if (pres[k] < 0.99) return;
        const ri = S.real.indexOf(a + '-' + b);
        const ta = ov ? 1 : U.vis(t, 15.2 + ri * 0.7, 30, 0.6);
        if (ta <= 0) return;
        g.save();
        g.globalAlpha *= ta * 0.16;
        g.fillStyle = C.amber;
        g.beginPath(); g.moveTo(ego.x, ego.y); g.lineTo(F[a].x, F[a].y); g.lineTo(F[b].x, F[b].y); g.closePath(); g.fill();
        g.restore();
      });
      // 나 — 친구 링크
      F.forEach((p, i) => D.edge(g, ego.x, ego.y, p.x, p.y, { w: 3, color: C.edge, p: U.inn(t, 0.8 + i * 0.2, 0.5) }));
      // 친구끼리
      S.pairs.forEach(([a, b], k) => {
        const hov = SH.isHover(env, 'p' + k);
        D.edge(g, F[a].x, F[a].y, F[b].x, F[b].y, { w: 2, color: hov ? C.amber : C.faint, dash: [6, 7], a: possA(k) * (1 - pres[k]), r1: 20, r2: 20 });
        if (pres[k] > 0) D.edge(g, F[a].x, F[a].y, F[b].x, F[b].y, { w: 4, color: hov ? C.amber : C.mint, p: pres[k], r1: 20, r2: 20 });
        const mx = (F[a].x + F[b].x) / 2, my = (F[a].y + F[b].y) / 2;
        env.hit({ id: 'p' + k, x: mx, y: my, r: 15, pair: k });
      });
      D.node(g, ego.x, ego.y, 30 * U.backOut(U.seg(t, 0.3, 0.8)), { fill: C.amber, text: '나', textKind: 'display', textSize: 26 });
      SH.hitNode(env, 'ego', ego.x, ego.y, 30, { drag: 'e' });
      F.forEach((p, i) => {
        D.node(g, p.x, p.y, 20 * U.backOut(U.seg(t, 0.9 + i * 0.2, 1.4 + i * 0.2)), { fill: C.node, label: S.names[i], labelPos: 'right', ring: SH.isHover(env, 'f' + i) ? 1 : 0 });
        SH.hitNode(env, 'f' + i, p.x, p.y, 20, { drag: i });
      });
      // 계산 패널
      const realN = pres.filter((v) => v > 0.5).length;
      const cc = realN / 6;
      const fa = (ov ? 1 : U.inn(t, 6.6, 0.5)) * (1 - cmp);
      const x0 = 720;
      if (fa > 0) {
        D.panel(g, x0, 160, 480, 330, { r: 18, a: fa });
        D.text(g, '친구끼리 가능한 쌍', x0 + 30, 212, { size: 19, color: C.dim, a: fa });
        D.rich(g, '4×3÷2 = **6**', x0 + 450, 212, { size: 25, kind: 'mono', align: 'right', a: fa, hl: C.ink });
        const ra = (ov ? 1 : U.inn(t, 10, 0.5)) * (1 - cmp);
        D.text(g, '실제로 친구인 쌍', x0 + 30, 276, { size: 19, color: C.dim, a: ra });
        D.rich(g, `**${realN}**`, x0 + 450, 276, { size: 25, kind: 'mono', align: 'right', a: ra, hl: C.mint });
        const ca = (ov ? 1 : U.inn(t, 11.6, 0.5)) * (1 - cmp);
        D.text(g, '군집 계수', x0 + 30, 350, { size: 30, kind: 'display', color: C.amber, a: ca });
        D.rich(g, `${realN} ÷ 6 = **${U.fmt(cc, 2)}**`, x0 + 450, 350, { size: 29, kind: 'mono', align: 'right', a: ca, hl: C.amber });
        const gw = 420, gx = x0 + 30, gy = 384;
        D.panel(g, gx, gy, gw, 20, { r: 10, fill: U.rgba(C.ink, 0.08), stroke: false, a: ca });
        const shown = SH.tw(S, 'cc', cc, env, 9);
        if (shown > 0.005) D.panel(g, gx, gy, gw * shown, 20, { r: 10, fill: C.amber, stroke: false, a: ca });
        const tri = realN;
        D.rich(g, `삼각형 **${tri}개**`, x0 + 30, 456, { size: 20, a: (ov ? 1 : U.inn(t, 15.2, 0.5)) * (1 - cmp), hl: C.amber });
      }
      // 0과 1 비교
      if (cmp > 0) {
        const mini = (cy, full, val, col, title) => {
          const ex = 790;
          const fr = [-60, -20, 20, 60].map((d) => (d * Math.PI) / 180).map((ang) => ({ x: ex + 92 * Math.cos(ang), y: cy + 92 * Math.sin(ang) }));
          if (full) for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) D.edge(g, fr[a].x, fr[a].y, fr[b].x, fr[b].y, { w: 3, color: C.mint, a: cmp, r1: 11, r2: 11 });
          fr.forEach((p) => D.edge(g, ex, cy, p.x, p.y, { w: 3, color: C.edge, a: cmp }));
          fr.forEach((p) => D.node(g, p.x, p.y, 11, { fill: C.node, a: cmp }));
          D.node(g, ex, cy, 16, { fill: col, a: cmp });
          D.text(g, val, 960, cy + 20, { size: 64, kind: 'display', color: col, align: 'center', a: cmp });
          D.text(g, title, 1095, cy + 7, { size: 18, color: C.ink, align: 'center', a: cmp });
        };
        D.panel(g, 700, 150, 520, 420, { r: 18, a: cmp });
        mini(258, false, '0', C.coral, '친구들이 서로 모르는 사이');
        g.save(); g.globalAlpha *= cmp * 0.5; g.strokeStyle = C.faint; g.beginPath(); g.moveTo(730, 360); g.lineTo(1190, 360); g.stroke(); g.restore();
        mini(462, true, '1', C.mint, '친구들이 모두 아는 사이');
      }
      const h = env.hover;
      if (h && h.pair != null) {
        const [a, b] = S.pairs[h.pair];
        SH.tip(g, env.ptr.x, env.ptr.y, `${S.names[a]} · ${S.names[b]}`, [pres[h.pair] > 0.5 ? '서로 친구' : '아직 모르는 사이', '클릭하면 바뀝니다']);
      }
    },
    click(S, hit) {
      if (hit.pair == null) return false;
      if (!S.ov) S.ov = { on: new Set(S.real) };
      const [a, b] = S.pairs[hit.pair];
      const key = a + '-' + b;
      if (S.ov.on.has(key)) S.ov.on.delete(key);
      else S.ov.on.add(key);
      return true;
    },
    panel: {
      html: `<p>친구들 사이의 <b>점선을 클릭</b>해 서로 친구로 만들거나 끊어 보세요. 친구 쌍 하나가 생길 때마다 '나'를 포함한 <b>삼각형</b>이 하나 생기고 군집 계수가 1/6씩 오릅니다.</p>
             <div class="row"><button type="button" data-act="none">모두 모르는 사이(0)</button><button type="button" data-act="all">모두 아는 사이(1)</button></div>`,
      bind(el, S, player) {
        el.querySelector('[data-act="none"]').onclick = () => { S.ov = { on: new Set() }; player.pause(); };
        el.querySelector('[data-act="all"]').onclick = () => { S.ov = { on: new Set(S.pairs.map(([a, b]) => a + '-' + b)) }; player.pause(); };
      },
    },
  });

  /* =====================================================================
   * 10. 커뮤니티
   * ===================================================================== */
  scene({
    id: 'community',
    chapter: '커뮤니티',
    kicker: '09 · 끼리끼리 모인 무리',
    title: '커뮤니티 (Community)',
    dur: 33,
    captions: [
      [0.4, '복잡하게 얽힌 네트워크도 잘 펼쳐 보면…'],
      [4.4, '안쪽은 촘촘하고 바깥과는 듬성듬성한 무리가 보입니다. 이것이 **커뮤니티**예요.'],
      [9, '알고리즘은 각 노드가 이웃들이 가장 많이 가진 색을 따라 칠하는 식으로 무리를 찾습니다.'],
      [14.6, '이 과정을 반복하면 색이 정리되며 커뮤니티가 드러나지요.'],
      [17.6, '얼마나 잘 나뉘었는지는 **모듈성**(modularity) 점수로 평가합니다. 보통 0.3을 넘으면 뚜렷한 편이에요.'],
      [23.6, '무리와 무리를 잇는 몇 안 되는 링크, 이 **약한 연결**이 새로운 정보를 전해 준다고 해요.'],
      [28.6, '사회학자 그라노베터가 말한 **약한 연결의 힘**입니다.'],
    ],
    init() {
      // 무리 3개가 심어진 네트워크를 만들되, 라벨 전파가 정확히 3개 무리를 찾는 시드를 고름
      let pick = null;
      for (let seed = 1; seed < 400 && !pick; seed++) {
        const pl = G.planted([9, 9, 9], 0.48, 0.022, seed);
        const gr = G.make(pl.n, pl.edges);
        const cc = G.components(gr);
        const bridges = pl.edges.filter(([a, b]) => pl.group[a] !== pl.group[b]).length;
        if (cc.count !== 1 || bridges < 3 || bridges > 5) continue;
        if (G.degree(gr).some((d) => d < 2)) continue;
        for (let s2 = 1; s2 < 60; s2++) {
          const lp = G.labelPropagation(gr, s2);
          const L = [...new Set(lp.labels)];
          if (L.length !== 3) continue;
          const ok = pl.group.every((gi, i) => pl.group.every((gj, j) => (gi === gj) === (lp.labels[i] === lp.labels[j])));
          if (ok && lp.history.length > 30) { pick = { pl, gr, lp }; break; }
        }
      }
      const { pl, gr, lp } = pick;
      const P = G.layout(pl.n, pl.edges, { x: 150, y: 150, w: 980, h: 420 }, { seed: 3, iters: 600 });
      const rnd = U.rng(21);
      const scramble = P.map(() => ({ x: 400 + rnd() * 480, y: 220 + rnd() * 300 }));
      // 최종 라벨 → 팔레트 색, 나머지 라벨 → 흐린 무지개
      const finals = [...new Set(lp.labels)].sort((a, b) => a - b);
      const color = {};
      finals.forEach((l, i) => (color[l] = [C.coral, C.sky, C.mint][i]));
      for (let l = 0; l < pl.n; l++) if (!color[l]) color[l] = U.hsl2hex((l * 137.5) % 360, 45, 62);
      // 각 갱신이 일어나는 시각
      const H = lp.history;
      const changes = [];
      for (let s = 1; s < H.length; s++) {
        const i = H[s].findIndex((v, k) => v !== H[s - 1][k]);
        changes.push({ s, i, from: H[s - 1][i], to: H[s][i], t: 8.8 + ((s - 1) / (H.length - 1)) * 7.2 });
      }
      const Q = G.modularity(gr, lp.labels);
      const bridges = pl.edges.filter(([a, b]) => lp.labels[a] !== lp.labels[b]);
      return { pl, gr, lp, P, scramble, color, changes, Q, bridges, off: {} };
    },
    draw(g, t, S, env) {
      const n = S.pl.n;
      const un = (i) => U.easeInOut(U.seg(t, 1.2 + (i % 9) * 0.06, 5.6 + (i % 9) * 0.06));
      const P = S.P.map((p, i) => SH.pos(S, i, { x: U.lerp(S.scramble[i].x, p.x, un(i)), y: U.lerp(S.scramble[i].y, p.y, un(i)) }));
      // 현재 라벨 상태
      const lab = Array.from({ length: n }, (_, i) => i);
      const lastChange = new Array(n).fill(null);
      for (const c of S.changes) {
        if (c.t > t) break;
        lab[c.i] = c.to;
        lastChange[c.i] = c;
      }
      const colorA = U.inn(t, 6.4, 1.2);
      const hullA = U.vis(t, 16.6, 34, 0.8);
      // 무리 영역
      if (hullA > 0) {
        const groups = {};
        for (let i = 0; i < n; i++) (groups[lab[i]] = groups[lab[i]] || []).push(P[i]);
        Object.keys(groups).forEach((l) => {
          const pts = groups[l];
          if (pts.length < 3) return;
          const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
          const r = Math.max(...pts.map((p) => U.dist(p.x, p.y, cx, cy))) + 34;
          g.save();
          g.globalAlpha *= hullA;
          g.fillStyle = U.rgba(S.color[l], 0.09);
          g.strokeStyle = U.rgba(S.color[l], 0.5);
          g.setLineDash([6, 8]);
          g.lineWidth = 2;
          g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
          g.restore();
        });
      }
      const bridgeA = U.inn(t, 23.6, 0.8);
      const isBridge = (a, b) => lab[a] !== lab[b] && t > 16;
      S.pl.edges.forEach(([a, b]) => {
        const br = isBridge(a, b) && S.lp.labels[a] !== S.lp.labels[b];
        const inside = lab[a] === lab[b] && colorA > 0;
        let col = C.edge;
        if (inside && t > 8.8) col = U.mix(C.edge, S.color[lab[a]], 0.45 * colorA);
        if (br) col = U.mix(C.edge, C.amber, bridgeA);
        D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, { w: br ? 2 + 3 * bridgeA : 2, color: col, a: 0.85, glow: br ? 12 * bridgeA : 0 });
      });
      // 약한 연결 위를 오가는 빛
      if (t > 24.4) {
        S.bridges.forEach(([a, b], k) => {
          const p = ((t - 24.4) / 1.6 + k * 0.37) % 1;
          D.pulse(g, P[a].x, P[a].y, P[b].x, P[b].y, k % 2 ? 1 - p : p, { r: 5, a: U.inn(t, 24.4, 0.5) });
        });
      }
      for (let i = 0; i < n; i++) {
        let fill = C.node;
        if (colorA > 0) {
          const c = lastChange[i];
          let col = S.color[lab[i]];
          if (c && t - c.t < 0.3) col = U.mix(S.color[c.from], S.color[c.to], (t - c.t) / 0.3);
          fill = U.mix(C.node, col, colorA);
        }
        const c = lastChange[i];
        const bump = c ? 1 + 0.45 * Math.sin(U.seg(t, c.t, c.t + 0.35) * Math.PI) : 1;
        D.node(g, P[i].x, P[i].y, 13 * bump * U.backOut(U.seg(t, 0.1 + i * 0.02, 0.5 + i * 0.02)), { fill, ring: SH.isHover(env, 'n' + i) ? 1 : 0 });
        SH.hitNode(env, 'n' + i, P[i].x, P[i].y, 13, { drag: i, node: i });
      }
      // 진행 표시
      if (t > 8.8 && t < 17.4) {
        const done = S.changes.filter((c) => c.t <= t).length;
        const groups = new Set(lab).size;
        D.badge(g, `색 바꾸기 ${done}회 · 남은 색 ${groups}가지`, 640, 150, { size: 17, fill: C.sky, a: U.vis(t, 8.8, 17.4) });
      }
      if (t >= 17.4) {
        const a = U.vis(t, 17.6, 23.4) ;
        const x = 64, y = 128, w = 340;
        D.panel(g, x, y, w, 64, { r: 14, a });
        D.text(g, '모듈성 Q', x + 20, y + 40, { size: 22, kind: 'display', color: C.amber, a });
        const gx = x + 128, gw = 130;
        D.panel(g, gx, y + 24, gw, 14, { r: 7, fill: U.rgba(C.ink, 0.1), stroke: false, a });
        D.panel(g, gx, y + 24, gw * S.Q * U.easeOut(U.seg(t, 18, 19.4)), 14, { r: 7, fill: C.amber, stroke: false, a });
        g.save(); g.globalAlpha *= a; g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(gx + gw * 0.3, y + 18); g.lineTo(gx + gw * 0.3, y + 44); g.stroke(); g.restore();
        D.text(g, U.fmt(S.Q * U.easeOut(U.seg(t, 18, 19.4)), 2), x + w - 20, y + 40, { size: 22, kind: 'mono', weight: 600, color: C.ink, align: 'right', a });
      }
      if (t >= 23.6) {
        // 노드에서 가장 먼 빈 자리에 설명을 두고, 가장 가까운 다리에서 지시선을 그림
        const cands = [{ x: 1060, y: 470 }, { x: 1060, y: 230 }, { x: 200, y: 470 }, { x: 200, y: 250 }, { x: 640, y: 520 }, { x: 640, y: 170 }];
        let spot = cands[0], far = -1;
        for (const c of cands) {
          const dmin = Math.min(...P.map((p) => U.dist(p.x, p.y, c.x, c.y + 20)));
          if (dmin > far) { far = dmin; spot = c; }
        }
        let br = S.bridges[0], bd = Infinity;
        for (const e of S.bridges) {
          const d = U.dist((P[e[0]].x + P[e[1]].x) / 2, (P[e[0]].y + P[e[1]].y) / 2, spot.x, spot.y);
          if (d < bd) { bd = d; br = e; }
        }
        const mx = (P[br[0]].x + P[br[1]].x) / 2, my = (P[br[0]].y + P[br[1]].y) / 2;
        D.callout(g, mx, my, spot.x, spot.y, '약한 연결', '무리와 무리를 잇는 **다리**', { a: U.inn(t, 24, 0.6), color: C.amber, size: 30, align: 'center', above: false });
      }
      if (env.hover && env.hover.node != null) {
        const i = env.hover.node;
        const k = S.gr.adj[i].length;
        const inside = S.gr.adj[i].filter((j) => S.lp.labels[j] === S.lp.labels[i]).length;
        SH.tip(g, P[i].x, P[i].y, `노드 ${i + 1}`, [`이웃 ${k}명 중 같은 무리 **${inside}명**`]);
      }
    },
    panel: {
      html: `<p>노드를 끌어서 무리를 떼어 놓거나 섞어 보세요. 색칠 과정을 다시 보려면 아래 버튼을 누르세요.</p>
             <div class="row"><button type="button" data-act="replay">색칠 과정 다시 보기</button></div>`,
      bind(el, S, player) {
        el.querySelector('[data-act="replay"]').onclick = () => player.seekScene('community', 8.4, true);
      },
    },
  });

  /* =====================================================================
   * 11. 네트워크 모델 세 가지
   * ===================================================================== */
  function buildModels(seed) {
    const box = (cx) => ({ x: cx - 160, y: 204, w: 320, h: 222 });
    // 무작위 (조각나지 않은 것을 고름)
    const erN = 26;
    let erE, k = 0;
    do { erE = G.erdosRenyi(erN, 0.12, 100 + seed * 50 + k++); } while (G.components(G.make(erN, erE)).count > 1 && k < 200);
    const erP = G.layout(erN, erE, box(225), { seed: 2 + seed, iters: 400 });
    // 작은 세상
    const wsN = 24, ws = G.wattsStrogatz(wsN, 4, 0.16, 200 + seed);
    const wsP = G.circle(wsN, 640, 318, 108);
    const wsBefore = G.pathStats(G.make(wsN, ws.lattice)).avg;
    const wsAfter = G.pathStats(G.make(wsN, ws.final)).avg;
    // 척도 없는
    const baN = 34, baE = G.barabasiAlbert(baN, 1, 300 + seed);
    const baP = G.layout(baN, baE, box(1055), { seed: 5 + seed, iters: 500 });
    return { erN, erE, erP, wsN, ws, wsP, wsBefore, wsAfter, baN, baE, baP };
  }
  function hist(n, edges, maxK) {
    const deg = new Array(n).fill(0);
    edges.forEach(([a, b]) => { deg[a]++; deg[b]++; });
    const h = new Array(maxK + 1).fill(0);
    deg.forEach((d) => { h[Math.min(maxK, d)]++; });
    return h;
  }
  function drawHist(g, cx, h, a, color, label) {
    const x0 = cx - 160, y0 = 528, w = 320, hh = 76;
    const mx = Math.max(4, ...h);
    const bw = w / h.length;
    h.forEach((v, k) => {
      if (k === 0) return;
      const bh = (v / mx) * hh;
      D.panel(g, x0 + k * bw - bw + 2, y0 - bh, bw - 3, Math.max(0, bh), { r: 3, fill: color, stroke: false, a: a * 0.9 });
    });
    g.save(); g.globalAlpha *= a; g.strokeStyle = U.rgba(C.ink, 0.3); g.beginPath(); g.moveTo(x0, y0 + 1); g.lineTo(x0 + w, y0 + 1); g.stroke(); g.restore();
    D.text(g, label, cx, y0 + 21, { size: 14, color: C.dim, align: 'center', a });
  }
  scene({
    id: 'models',
    chapter: '세 가지 네트워크 모델',
    kicker: '10 · 네트워크의 생김새',
    title: '네트워크 모델 세 가지',
    dur: 36,
    captions: [
      [0.4, '네트워크는 만들어지는 방식에 따라 모양이 달라집니다. 대표적인 세 가지를 볼까요?'],
      [3.6, '**무작위 네트워크**: 아무 쌍이나 확률적으로 연결하면 모두의 연결정도가 엇비슷해져요.'],
      [10.4, '**작은 세상 네트워크**: 이웃끼리 촘촘한데, 몇 개의 지름길 덕분에 어디든 금방 닿습니다.'],
      [18.4, '**척도 없는 네트워크**: 새 노드가 인기 많은 노드에 붙기를 좋아하면, 부익부 빈익빈으로 **허브**가 생겨요.'],
      [28.4, '인터넷, 항공 노선, 논문 인용망은 허브가 있는 척도 없는 네트워크에 가깝습니다.'],
    ],
    init() {
      return { seed: 0, M: buildModels(0), off: {} };
    },
    draw(g, t, S) {
      const M = S.M;
      const cols = [
        { cx: 225, t: '무작위', en: 'Erdős–Rényi', color: C.sky, ex: '비교의 기준선' },
        { cx: 640, t: '작은 세상', en: 'Watts–Strogatz', color: C.mint, ex: '뇌 신경망 · 전력망 · 친구 관계' },
        { cx: 1055, t: '척도 없는', en: 'Barabási–Albert', color: C.coral, ex: '인터넷 · 항공 노선 · 논문 인용' },
      ];
      cols.forEach((c, i) => {
        const a = U.inn(t, 0.5 + i * 0.3, 0.6);
        const active = (i === 0 && t >= 3.6 && t < 10.4) || (i === 1 && t >= 10.4 && t < 18.4) || (i === 2 && t >= 18.4 && t < 28.4) || t >= 28.4;
        D.panel(g, c.cx - 195, 118, 390, 480, { r: 18, a: a * 0.9, stroke: U.rgba(c.color, active ? 0.55 : 0.15) });
        D.text(g, c.t, c.cx, 156, { size: 30, kind: 'display', color: c.color, align: 'center', a });
        D.text(g, c.en, c.cx, 180, { size: 13, kind: 'mono', color: C.dim, align: 'center', a, spacing: 1 });
        D.badge(g, c.ex, c.cx, 575, { size: 15, fill: c.color, a: U.inn(t, 28.6 + i * 0.4, 0.5) });
      });
      // 무작위
      const erShown = M.erE.filter((e, k) => t >= 3.8 + (k / M.erE.length) * 5.4);
      M.erE.forEach(([a, b], k) => {
        const st = 3.8 + (k / M.erE.length) * 5.4;
        D.edge(g, M.erP[a].x, M.erP[a].y, M.erP[b].x, M.erP[b].y, { w: 1.8, color: U.mix(C.edge, C.sky, 0.3), p: U.inn(t, st, 0.4) });
      });
      const erDeg = new Array(M.erN).fill(0);
      erShown.forEach(([a, b]) => { erDeg[a]++; erDeg[b]++; });
      M.erP.forEach((p, i) => D.node(g, p.x, p.y, (6 + erDeg[i] * 1.3) * U.backOut(U.seg(t, 1 + i * 0.03, 1.5 + i * 0.03)), { fill: C.sky, lw: 1.5 }));
      drawHist(g, 225, hist(M.erN, erShown, 10), U.inn(t, 3.8, 0.6), C.sky, '연결정도 분포 — 가운데 몰림');
      // 작은 세상
      const wsA = U.inn(t, 10.6, 0.6);
      const rewP = U.easeInOut(U.seg(t, 13.4, 16.4));
      const rewSet = new Set(M.ws.rewired.map((r) => r.from.join('-')));
      M.ws.lattice.forEach(([a, b], k) => {
        if (rewSet.has(a + '-' + b)) return;
        D.edge(g, M.wsP[a].x, M.wsP[a].y, M.wsP[b].x, M.wsP[b].y, { w: 1.8, color: U.mix(C.edge, C.mint, 0.3), p: U.inn(t, 10.8 + k * 0.03, 0.4) });
      });
      M.ws.rewired.forEach((r, k) => {
        const [a, b] = r.from, c = r.to[1];
        const p = U.easeInOut(U.seg(t, 13.4 + k * 0.35, 14.6 + k * 0.35));
        const ex = U.lerp(M.wsP[b].x, M.wsP[c].x, p), ey = U.lerp(M.wsP[b].y, M.wsP[c].y, p);
        D.edge(g, M.wsP[a].x, M.wsP[a].y, ex, ey, { w: p > 0 ? 2.6 : 1.8, color: p > 0 ? C.amber : U.mix(C.edge, C.mint, 0.3), p: U.inn(t, 10.8 + k * 0.05, 0.4), glow: p > 0 && p < 1 ? 10 : 0 });
      });
      M.wsP.forEach((p, i) => D.node(g, p.x, p.y, 7 * U.backOut(U.seg(t, 10.4 + i * 0.03, 10.9 + i * 0.03)), { fill: C.mint, lw: 1.5 }));
      const wsEdges = rewP > 0.5 ? M.ws.final : M.ws.lattice;
      drawHist(g, 640, hist(M.wsN, t >= 10.8 ? wsEdges : [], 10), wsA, C.mint, '연결정도 분포 — 거의 모두 같음');
      if (t >= 16.4) {
        const a = U.vis(t, 16.4, 28.2);
        D.badge(g, `평균 거리 ${U.fmt(M.wsBefore, 1)} → **${U.fmt(M.wsAfter, 1)}**`, 640, 318, { size: 16, fill: C.amber, a });
      }
      // 척도 없는: 하나씩 자라는 네트워크
      const grow = (v) => 18.6 + (Math.max(0, v - 2) / (M.baN - 2)) * 8.6;
      const baShown = M.baE.filter(([, , v]) => t >= grow(v));
      const baDeg = new Array(M.baN).fill(0);
      baShown.forEach(([a, b]) => { baDeg[a]++; baDeg[b]++; });
      M.baE.forEach(([a, b, v]) => D.edge(g, M.baP[a].x, M.baP[a].y, M.baP[b].x, M.baP[b].y, { w: 1.8, color: U.mix(C.edge, C.coral, 0.3), p: U.inn(t, grow(v), 0.4) }));
      M.baP.forEach((p, i) => {
        const s = U.backOut(U.seg(t, grow(i), grow(i) + 0.4));
        D.node(g, p.x, p.y, (5 + Math.sqrt(baDeg[i]) * 3.4) * s, { fill: baDeg[i] >= 6 ? C.amber : C.coral, lw: 1.5, halo: baDeg[i] >= 6 ? 12 : 0 });
      });
      drawHist(g, 1055, hist(M.baN, baShown, 10), U.inn(t, 18.6, 0.6), C.coral, '연결정도 분포 — 긴 꼬리 (허브)');
    },
    panel: {
      html: `<p>세 모델은 모두 같은 규칙을 무작위로 적용해 만들어집니다. <b>다시 만들기</b>를 누르면 새 난수로 다시 생성되는 모습을 볼 수 있어요. 오른쪽(척도 없는)은 매번 소수의 허브가 생기는지 확인해 보세요.</p>
             <div class="row"><button type="button" data-act="regen">새 난수로 다시 만들기</button></div>`,
      bind(el, S, player) {
        el.querySelector('[data-act="regen"]').onclick = () => {
          S.seed += 1;
          S.M = buildModels(S.seed);
          player.seekScene('models', 3.4, true);
        };
      },
    },
  });

  /* =====================================================================
   * 12. 분석 흐름
   * ===================================================================== */
  const CODE = [
    [['kw', 'import'], ['', ' networkx '], ['kw', 'as'], ['', ' nx']],
    [],
    [['', 'G = nx.Graph()']],
    [['', 'G.add_edges_from(['], ['str', '("지민", "서준")'], ['', ', '], ['str', '("서준", "하윤")'], ['', ',']],
    [['', '                  '], ['str', '("하윤", "지민")'], ['', ', '], ['str', '("하윤", "도윤")'], ['', '])']],
    [],
    [['fn', 'print'], ['', '(nx.density(G))                 '], ['cm', '# 밀도']],
    [['fn', 'print'], ['', '(nx.degree_centrality(G))       '], ['cm', '# 연결정도 중심성']],
    [['fn', 'print'], ['', '(nx.betweenness_centrality(G))  '], ['cm', '# 매개 중심성']],
  ];
  scene({
    id: 'workflow',
    chapter: '분석은 이렇게',
    kicker: '11 · 분석의 흐름',
    title: '네트워크 분석 5단계',
    dur: 30,
    captions: [
      [0.4, '실제 분석은 보통 다섯 단계로 진행됩니다.'],
      [3, '먼저 **질문**을 정하고, 무엇을 노드로 무엇을 링크로 볼지 **정의**해요.'],
      [9, '데이터를 엣지 리스트로 정리한 뒤, Gephi나 파이썬 NetworkX 같은 도구로 **시각화**하고 **지표**를 계산합니다.'],
      [16, '파이썬이라면 몇 줄이면 충분해요. 앞에서 배운 밀도와 중심성이 그대로 나옵니다.'],
      [23, '마지막이 가장 중요합니다. 숫자가 현실에서 무엇을 뜻하는지 **해석**하는 것!'],
    ],
    init() { return { off: {} }; },
    draw(g, t) {
      const steps = [
        { t: '질문 정하기', d: '무엇이 궁금한가?', at: 3 },
        { t: '노드·링크 정의', d: '무엇을 점, 무엇을 선으로?', at: 5.4 },
        { t: '데이터 정리', d: '엣지 리스트(CSV) 만들기', at: 9 },
        { t: '시각화 · 지표', d: 'Gephi · NetworkX · igraph', at: 11.6 },
        { t: '해석하기', d: '숫자의 의미를 맥락에서', at: 23 },
      ];
      const xs = steps.map((_, i) => 190 + i * 225);
      const y = 186;
      for (let i = 0; i < 4; i++) {
        D.edge(g, xs[i], y, xs[i + 1], y, { w: 3, color: C.faint, r1: 34, r2: 34, dash: [6, 7] });
        D.edge(g, xs[i], y, xs[i + 1], y, { w: 4, color: C.amber, r1: 34, r2: 34, arrow: 1, p: U.inn(t, steps[i + 1].at - 0.6, 0.6) });
      }
      steps.forEach((s, i) => {
        const a = U.inn(t, s.at, 0.5, U.backOut);
        const last = i === 4;
        const glow = last ? U.inn(t, 23.4, 0.8) : 0;
        D.node(g, xs[i], y, 32 * Math.max(0.6, a), { fill: last ? U.mix(C.node, C.amber, glow) : a > 0.05 ? C.sky : C.faint, text: i + 1, textKind: 'display', textSize: 28, halo: 26 * glow, a: Math.max(0.35, a) });
        D.text(g, s.t, xs[i], y + 62, { size: 24, kind: 'display', color: last ? C.amber : C.ink, align: 'center', a: U.clamp(a) });
        D.text(g, s.d, xs[i], y + 88, { size: 15, color: C.dim, align: 'center', a: U.clamp(a) });
      });
      // 예시 질문
      const exA = U.vis(t, 3.6, 15.6);
      D.panel(g, 250, 330, 780, 120, { r: 16, a: exA });
      D.text(g, '예시', 280, 370, { size: 15, kind: 'mono', color: C.amber, a: exA, spacing: 2 });
      D.rich(g, '질문: 우리 반에서 **소외된 학생**은 누구일까?', 280, 404, { size: 21, a: exA * U.inn(t, 3.4, 0.5) });
      D.rich(g, '정의: 학생 = **노드**, 함께 점심을 먹음 = **링크**', 280, 436, { size: 21, a: exA * U.inn(t, 5.8, 0.5) });
      // 코드
      const ca = U.inn(t, 15.6, 0.6) * (1 - 0.82 * U.easeInOut(U.seg(t, 23.2, 24)));
      if (ca > 0) {
        const x0 = 150, y0 = 300, w = 620, hgt = 270;
        D.panel(g, x0, y0, w, hgt, { r: 14, fill: '#071016', a: ca, stroke: U.rgba(C.mint, 0.3) });
        ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => D.node(g, x0 + 22 + i * 18, y0 + 20, 5, { fill: c, stroke: 'transparent', lw: 0, a: ca }));
        D.text(g, 'analysis.py', x0 + w / 2, y0 + 25, { size: 13, kind: 'mono', color: C.dim, align: 'center', a: ca });
        const total = CODE.reduce((s, l) => s + l.reduce((q, [, txt]) => q + txt.length, 0), 0);
        let budget = Math.floor(U.seg(t, 16.2, 21.4) * total);
        const colr = { kw: C.coral, str: C.mint, fn: C.sky, cm: '#7d97a0', '': C.ink };
        g.save();
        g.font = D.font(16, 'mono', 500);
        CODE.forEach((line, li) => {
          let x = x0 + 22;
          const yy = y0 + 66 + li * 23;
          for (const [k, txt] of line) {
            if (budget <= 0) break;
            const s = txt.slice(0, budget);
            budget -= s.length;
            g.globalAlpha = ca;
            g.fillStyle = colr[k];
            g.fillText(s, x, yy);
            x += g.measureText(s).width;
          }
        });
        g.restore();
        if (t > 16.2 && t < 21.6 && Math.floor(t * 3) % 2 === 0) D.text(g, '▍', x0 + 22, y0 + 66 + 8 * 23 + 23, { size: 16, color: C.amber, a: ca });
        // 결과 표
        const ra = U.inn(t, 21.2, 0.6) * (1 - 0.82 * U.easeInOut(U.seg(t, 23.2, 24)));
        const rx = 800, ry = 300;
        D.panel(g, rx, ry, 330, 270, { r: 14, a: ra, stroke: U.rgba(C.sky, 0.35) });
        D.text(g, '실행 결과', rx + 22, ry + 32, { size: 15, kind: 'mono', color: C.sky, a: ra, spacing: 2 });
        D.rich(g, '밀도 **0.67**', rx + 22, ry + 66, { size: 19, a: ra });
        const rows = [['하윤', '1.00', '0.67'], ['지민', '0.67', '0.00'], ['서준', '0.67', '0.00'], ['도윤', '0.33', '0.00']];
        D.text(g, '연결정도', rx + 200, ry + 104, { size: 14, color: C.dim, align: 'right', a: ra });
        D.text(g, '매개', rx + 300, ry + 104, { size: 14, color: C.dim, align: 'right', a: ra });
        rows.forEach(([nm, d, b], i) => {
          const yy = ry + 138 + i * 30;
          D.text(g, nm, rx + 22, yy, { size: 17, weight: 600, color: i === 0 ? C.amber : C.ink, a: ra });
          D.text(g, d, rx + 200, yy, { size: 17, kind: 'mono', color: C.ink, align: 'right', a: ra });
          D.text(g, b, rx + 300, yy, { size: 17, kind: 'mono', color: i === 0 ? C.amber : C.ink, align: 'right', a: ra });
        });
        // 해석
        const ia = U.inn(t, 23.6, 0.7);
        if (ia > 0) {
          D.panel(g, 230, 330, 820, 170, { r: 18, fill: U.rgba('#0b1a20', 0.97), stroke: U.rgba(C.amber, 0.7), a: ia });
          D.text(g, '해석의 예', 266, 374, { size: 15, kind: 'mono', color: C.amber, a: ia, spacing: 2 });
          D.rich(g, '하윤은 연결정도와 매개 중심성이 모두 가장 높다 →', 266, 418, { size: 24, a: ia });
          D.rich(g, '**도윤이 다른 친구들과 이어지는 통로**가 하윤뿐이라는 뜻!', 266, 460, { size: 24, a: ia * U.inn(t, 24.6, 0.6) });
        }
      }
    },
    panel: {
      html: `<p>화면의 코드는 실제로 실행되는 파이썬 코드예요. <code>pip install networkx</code> 후 그대로 붙여 넣으면 같은 결과가 나옵니다. 저장소의 <code>examples/</code> 폴더에 더 많은 예제가 있어요.</p>`,
    },
  });

  /* =====================================================================
   * 13. 정리 — 개념 지도
   * ===================================================================== */
  scene({
    id: 'outro',
    chapter: '정리',
    kicker: '12 · 한눈에 정리',
    title: '개념 지도',
    dur: 26,
    captions: [
      [0.4, '오늘 배운 개념을 정리해 볼까요?'],
      [3, '노드와 링크, 방향과 가중치, 엣지 리스트와 인접 행렬.'],
      [7.4, '연결정도와 허브, 경로와 거리, 지름, 밀도.'],
      [11.4, '네 가지 중심성, 군집 계수, 커뮤니티, 그리고 세 가지 네트워크 모델.'],
      [16, '가만 보니 이 개념들도 서로 연결된 하나의 **네트워크**네요.'],
      [20.6, '이제 **놀이터**에서 직접 네트워크를 만들어 보고, **퀴즈**로 확인해 보세요!'],
    ],
    init() {
      const N = [
        ['네트워크', C.sky, 3], ['노드', C.sky, 3.4], ['링크', C.sky, 3.8], ['방향', C.sky, 4.6], ['가중치', C.sky, 5.0],
        ['엣지 리스트', C.mint, 5.8], ['인접 행렬', C.mint, 6.4],
        ['연결정도', C.amber, 7.6], ['허브', C.amber, 8.2], ['경로·거리', C.amber, 8.8], ['지름', C.amber, 9.4], ['밀도', C.amber, 10.2],
        ['중심성', C.coral, 11.6], ['근접', C.coral, 12.0], ['매개', C.coral, 12.4], ['아이겐벡터', C.coral, 12.8],
        ['군집 계수', C.lilac, 13.3], ['커뮤니티', C.lilac, 13.7], ['모듈성', C.lilac, 14.1], ['약한 연결', C.lilac, 14.5],
        ['무작위', C.rose, 14.8], ['작은 세상', C.rose, 15.1], ['척도 없는', C.rose, 15.4],
      ];
      const id = (s) => N.findIndex((x) => x[0] === s);
      const pairs = [
        ['네트워크', '노드'], ['네트워크', '링크'], ['링크', '방향'], ['링크', '가중치'], ['네트워크', '엣지 리스트'], ['엣지 리스트', '인접 행렬'],
        ['노드', '연결정도'], ['연결정도', '허브'], ['연결정도', '중심성'], ['링크', '경로·거리'], ['경로·거리', '지름'], ['네트워크', '밀도'], ['밀도', '인접 행렬'],
        ['중심성', '근접'], ['중심성', '매개'], ['중심성', '아이겐벡터'], ['경로·거리', '근접'], ['경로·거리', '매개'],
        ['노드', '군집 계수'], ['군집 계수', '커뮤니티'], ['커뮤니티', '모듈성'], ['커뮤니티', '약한 연결'], ['매개', '약한 연결'],
        ['경로·거리', '작은 세상'], ['군집 계수', '작은 세상'], ['허브', '척도 없는'], ['작은 세상', '무작위'], ['무작위', '척도 없는'],
      ];
      const E = pairs.map(([a, b]) => [id(a), id(b)]);
      const P = G.layout(N.length, E, { x: 150, y: 170, w: 980, h: 390 }, { seed: 9, iters: 700, k: 1.25, stretch: true });
      // 이름표가 겹치지 않도록 살짝 밀어내기
      const W = N.map(([s]) => s.length * 18 + 34);
      for (let it = 0; it < 220; it++) {
        for (let i = 0; i < N.length; i++)
          for (let j = i + 1; j < N.length; j++) {
            const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y;
            const ox = (W[i] + W[j]) / 2 + 12 - Math.abs(dx), oy = 46 - Math.abs(dy);
            if (ox > 0 && oy > 0) {
              if (ox < oy * 1.6) { const s = (dx >= 0 ? 1 : -1) * ox / 2; P[i].x -= s; P[j].x += s; }
              else { const s = (dy >= 0 ? 1 : -1) * oy / 2; P[i].y -= s; P[j].y += s; }
            }
          }
        P.forEach((p, i) => { p.x = U.clamp(p.x, 70 + W[i] / 2, 1210 - W[i] / 2); p.y = U.clamp(p.y, 160, 560); });
      }
      return { N, E, P, W, off: {} };
    },
    draw(g, t, S, env) {
      const end = U.easeInOut(U.seg(t, 20.4, 21.4));
      const mapA = 1 - 0.88 * end;
      const P = S.P.map((p, i) => SH.pos(S, i, { x: p.x + Math.sin(t * 0.7 + i) * 3, y: p.y + Math.cos(t * 0.6 + i * 1.3) * 3 }));
      const glow = U.vis(t, 16, 21);
      S.E.forEach(([a, b], k) => {
        const st = Math.max(S.N[a][2], S.N[b][2]) + 0.3;
        D.edge(g, P[a].x, P[a].y, P[b].x, P[b].y, { w: 2.2, color: U.mix(C.edge, C.amber, glow * 0.6), p: U.inn(t, st, 0.6), a: mapA, glow: glow * 6 });
      });
      if (t > 16.2) {
        S.E.forEach(([a, b], k) => {
          const p = ((t - 16.2) / 1.4 + k * 0.29) % 1;
          D.pulse(g, P[a].x, P[a].y, P[b].x, P[b].y, p, { r: 3.5, a: Math.sin(p * Math.PI) * mapA * U.inn(t, 16.2, 0.6) });
        });
      }
      S.N.forEach(([s, col, at], i) => {
        const a = U.inn(t, at, 0.5, U.backOut);
        if (a <= 0) return;
        const w = S.W[i] * U.clamp(a, 0, 1.2), h = 38 * U.clamp(a, 0, 1.2);
        const hub = i === 0;
        D.panel(g, P[i].x - w / 2, P[i].y - h / 2, w, h, { r: h / 2, fill: hub ? col : U.rgba('#0a171d', 0.95), stroke: col, lw: 2, a: mapA * U.clamp(a) });
        D.text(g, s, P[i].x, P[i].y + 7, { size: 19, weight: 700, color: hub ? C.bg : C.ink, align: 'center', a: mapA * U.clamp(a) });
        env.hit({ id: 'c' + i, x: P[i].x - w / 2, y: P[i].y - h / 2, w, h, drag: i });
      });
      if (end > 0) {
        const glowG = g.createRadialGradient(640, 380, 20, 640, 380, 460);
        glowG.addColorStop(0, U.rgba('#061218', 0.9 * end));
        glowG.addColorStop(1, U.rgba('#061218', 0));
        g.fillStyle = glowG;
        g.fillRect(0, 0, D.W, D.H);
        D.text(g, '이제 직접 만져 볼 차례!', 640, 330, { size: 70, kind: 'display', color: C.ink, align: 'center', a: end, shadow: 20 });
        const b1 = D.measure(g, '놀이터에서 네트워크 만들기', 22, 'body', 700);
        D.badge(g, '놀이터에서 네트워크 만들기', 640 - b1 / 2 - 30, 410, { size: 22, fill: C.mint, a: end * U.inn(t, 21.4, 0.5) });
        D.badge(g, '퀴즈로 확인하기', 640 + 150, 410, { size: 22, fill: C.amber, a: end * U.inn(t, 21.8, 0.5) });
        const hint = env.render ? '인터랙티브 버전(index.html)에서 직접 해 볼 수 있어요' : '↓ 영상 아래로 내려가 보세요';
        D.text(g, hint, 640, 480, { size: 19, color: C.dim, align: 'center', a: end * U.inn(t, 22.4, 0.6) });
      }
    },
    panel: {
      html: `<p>개념 이름표도 끌어서 옮길 수 있어요. 이 영상 아래의 <a href="#playground">놀이터</a>에서 직접 네트워크를 만들고, <a href="#quiz">퀴즈</a>로 배운 내용을 확인해 보세요.</p>`,
    },
  });
})();
