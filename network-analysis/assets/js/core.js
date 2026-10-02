/* 네트워크 분석 튜토리얼 — 공용 유틸리티와 그래프 알고리즘
 * 모든 스크립트는 전역 네임스페이스 NA 아래에 붙습니다.
 * (type="module"을 쓰지 않아 index.html을 더블클릭해도 동작합니다.)
 */
(function () {
  'use strict';
  const NA = (window.NA = window.NA || {});

  /* ---------- 수학 / 애니메이션 유틸 ---------- */
  const U = {};
  U.clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  // t가 [a, b] 구간에서 0→1로 진행하는 비율
  U.seg = (t, a, b) => U.clamp((t - a) / (b - a));
  U.easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  U.easeOut = (x) => 1 - Math.pow(1 - x, 3);
  U.easeIn = (x) => x * x * x;
  U.backOut = (x) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };
  U.elastic = (x) => {
    if (x === 0 || x === 1) return x;
    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  };
  // 구간 [a,b]에서 등장(easeOut) 비율
  U.inn = (t, a, d = 0.6, ease = U.easeOut) => ease(U.seg(t, a, a + d));
  // 등장 후 퇴장까지 고려한 가시성 (0~1)
  U.vis = (t, a, b, d = 0.5) => Math.min(U.easeOut(U.seg(t, a, a + d)), 1 - U.easeIn(U.seg(t, b - d, b)));
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.fmt = (v, d = 2) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);

  // 시드 고정 난수 (mulberry32) — 영상 렌더링 결과가 매번 같도록
  U.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.shuffle = function (arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // 색 보간 (#rrggbb)
  U.hex = function (h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.mix = function (c1, c2, t) {
    const a = U.hex(c1), b = U.hex(c2);
    const r = a.map((v, i) => Math.round(U.lerp(v, b[i], U.clamp(t))));
    return '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  U.rgba = function (h, a) {
    const [r, g, b] = U.hex(h);
    return `rgba(${r},${g},${b},${a})`;
  };
  U.hsl2hex = function (h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  };

  NA.U = U;

  /* ---------- 팔레트 (무대는 항상 어두운 '영상 화면') ---------- */
  NA.C = {
    bg: '#0d1b24',
    bg2: '#12303a',
    grid: '#1d3a45',
    ink: '#eaf3f4',
    dim: '#8fb0b8',
    faint: '#3d5d68',
    edge: '#6f949e',
    coral: '#ff7a59',
    amber: '#ffc145',
    mint: '#3ddc97',
    sky: '#5ab8ff',
    lilac: '#b694ff',
    rose: '#ff6fa8',
    node: '#cfe3e6',
  };
  NA.PALETTE = [NA.C.coral, NA.C.sky, NA.C.mint, NA.C.amber, NA.C.lilac, NA.C.rose];

  /* ---------- 그래프 자료구조 ---------- */
  const G = {};
  // edges: [[a, b, w?], ...]
  G.make = function (n, edges, directed = false) {
    const adj = Array.from({ length: n }, () => []);
    const out = Array.from({ length: n }, () => []);
    const inn = Array.from({ length: n }, () => []);
    const E = [];
    const seen = new Set();
    for (const e of edges) {
      const [a, b] = e;
      const w = e[2] == null ? 1 : e[2];
      if (a === b) continue;
      const key = directed ? a + '>' + b : Math.min(a, b) + '-' + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      E.push([a, b, w]);
      out[a].push(b);
      inn[b].push(a);
      if (!adj[a].includes(b)) adj[a].push(b);
      if (!adj[b].includes(a)) adj[b].push(a);
    }
    return { n, edges: E, adj, out, inn, directed };
  };
  G.has = (g, a, b) => g.adj[a].includes(b);
  G.degree = (g) => g.adj.map((l) => l.length);

  // 너비 우선 탐색: 거리 배열 (도달 불가 = Infinity)
  G.bfs = function (g, s, skip) {
    const d = new Array(g.n).fill(Infinity);
    if (skip && skip.has(s)) return d;
    d[s] = 0;
    const q = [s];
    for (let i = 0; i < q.length; i++) {
      const v = q[i];
      for (const w of g.adj[v]) {
        if (skip && skip.has(w)) continue;
        if (d[w] === Infinity) { d[w] = d[v] + 1; q.push(w); }
      }
    }
    return d;
  };
  G.shortestPath = function (g, s, t, skip) {
    const prev = new Array(g.n).fill(-1);
    const seen = new Array(g.n).fill(false);
    seen[s] = true;
    const q = [s];
    for (let i = 0; i < q.length; i++) {
      const v = q[i];
      if (v === t) break;
      // 이웃을 번호 순으로 방문해 결과가 항상 같게
      const nb = g.adj[v].slice().sort((a, b) => a - b);
      for (const w of nb) {
        if (skip && skip.has(w)) continue;
        if (!seen[w]) { seen[w] = true; prev[w] = v; q.push(w); }
      }
    }
    if (!seen[t]) return null;
    const path = [t];
    while (path[0] !== s) path.unshift(prev[path[0]]);
    return path;
  };
  G.allDist = function (g, skip) {
    return Array.from({ length: g.n }, (_, i) => G.bfs(g, i, skip));
  };
  G.components = function (g, skip) {
    const comp = new Array(g.n).fill(-1);
    let c = 0;
    for (let i = 0; i < g.n; i++) {
      if (comp[i] !== -1 || (skip && skip.has(i))) continue;
      const d = G.bfs(g, i, skip);
      d.forEach((v, j) => { if (v < Infinity) comp[j] = c; });
      c++;
    }
    return { comp, count: c };
  };
  // 지름과 평균 경로 길이 (연결된 쌍만)
  G.pathStats = function (g, skip) {
    const D = G.allDist(g, skip);
    let max = 0, sum = 0, cnt = 0, pair = [0, 0];
    for (let i = 0; i < g.n; i++) {
      if (skip && skip.has(i)) continue;
      for (let j = i + 1; j < g.n; j++) {
        if (skip && skip.has(j)) continue;
        const v = D[i][j];
        if (v < Infinity) {
          sum += v; cnt++;
          if (v > max) { max = v; pair = [i, j]; }
        }
      }
    }
    return { diameter: max, avg: cnt ? sum / cnt : 0, pair };
  };
  G.density = function (g, skip) {
    const n = g.n - (skip ? skip.size : 0);
    if (n < 2) return 0;
    const m = g.edges.filter(([a, b]) => !(skip && (skip.has(a) || skip.has(b)))).length;
    return g.directed ? m / (n * (n - 1)) : (2 * m) / (n * (n - 1));
  };

  /* ---------- 중심성 ---------- */
  G.degreeCentrality = function (g, skip) {
    const n = g.n - (skip ? skip.size : 0);
    return g.adj.map((l, i) =>
      skip && skip.has(i) ? 0 : l.filter((w) => !(skip && skip.has(w))).length / Math.max(1, n - 1)
    );
  };
  // 근접 중심성 (Wasserman–Faust 보정: 연결되지 않은 그래프에서도 사용 가능, NetworkX 기본값과 동일)
  G.closeness = function (g, skip) {
    const N = g.n - (skip ? skip.size : 0);
    return Array.from({ length: g.n }, (_, i) => {
      if (skip && skip.has(i)) return 0;
      const d = G.bfs(g, i, skip);
      let sum = 0, r = 0;
      d.forEach((v, j) => { if (j !== i && v < Infinity) { sum += v; r++; } });
      if (!sum) return 0;
      return (r / sum) * (r / Math.max(1, N - 1));
    });
  };
  // 매개 중심성 — Brandes 알고리즘, 무방향 정규화
  G.betweenness = function (g, skip) {
    const n = g.n;
    const CB = new Array(n).fill(0);
    for (let s = 0; s < n; s++) {
      if (skip && skip.has(s)) continue;
      const S = [], P = Array.from({ length: n }, () => []);
      const sigma = new Array(n).fill(0); sigma[s] = 1;
      const d = new Array(n).fill(-1); d[s] = 0;
      const Q = [s];
      for (let qi = 0; qi < Q.length; qi++) {
        const v = Q[qi];
        S.push(v);
        for (const w of g.adj[v]) {
          if (skip && skip.has(w)) continue;
          if (d[w] < 0) { Q.push(w); d[w] = d[v] + 1; }
          if (d[w] === d[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); }
        }
      }
      const delta = new Array(n).fill(0);
      while (S.length) {
        const w = S.pop();
        for (const v of P[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        if (w !== s) CB[w] += delta[w];
      }
    }
    const N = n - (skip ? skip.size : 0);
    const scale = N > 2 ? 1 / ((N - 1) * (N - 2)) : 1; // 무방향: /2 와 정규화 2/((n-1)(n-2)) 결합
    return CB.map((v) => v * scale);
  };
  // 아이겐벡터 중심성 — 거듭제곱법. steps를 주면 그 단계까지의 중간값을 반환
  G.eigenvector = function (g, skip, steps) {
    const n = g.n;
    let x = new Array(n).fill(1).map((v, i) => (skip && skip.has(i) ? 0 : 1));
    const iters = steps == null ? 200 : steps;
    for (let k = 0; k < iters; k++) {
      const y = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        if (skip && skip.has(i)) continue;
        y[i] = x[i]; // (A + I) — 진동 없이 수렴하도록 자기 자신을 더함
        for (const j of g.adj[i]) if (!(skip && skip.has(j))) y[i] += x[j];
      }
      const norm = Math.hypot(...y) || 1;
      const next = y.map((v) => v / norm);
      const diff = next.reduce((s, v, i) => s + Math.abs(v - x[i]), 0);
      x = next;
      if (steps == null && diff < 1e-10) break;
    }
    return x;
  };
  // 지역 군집 계수
  G.clustering = function (g, skip) {
    return g.adj.map((nb0, i) => {
      if (skip && skip.has(i)) return 0;
      const nb = nb0.filter((w) => !(skip && skip.has(w)));
      const k = nb.length;
      if (k < 2) return 0;
      let links = 0;
      for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) if (G.has(g, nb[a], nb[b])) links++;
      return (2 * links) / (k * (k - 1));
    });
  };
  // 최댓값이 1이 되도록 정규화
  G.norm = function (arr) {
    const m = Math.max(...arr);
    return m > 0 ? arr.map((v) => v / m) : arr.map(() => 0);
  };

  /* ---------- 커뮤니티 ---------- */
  // 라벨 전파 — 매 노드 갱신 후의 라벨 스냅샷을 기록해 애니메이션에 사용
  G.labelPropagation = function (g, seed, maxSweeps = 10) {
    const rnd = U.rng(seed);
    const labels = Array.from({ length: g.n }, (_, i) => i);
    const history = [labels.slice()];
    for (let sweep = 0; sweep < maxSweeps; sweep++) {
      let changed = false;
      const order = U.shuffle([...Array(g.n).keys()], rnd);
      for (const v of order) {
        if (!g.adj[v].length) continue;
        const cnt = new Map();
        for (const w of g.adj[v]) cnt.set(labels[w], (cnt.get(labels[w]) || 0) + 1);
        let best = -1;
        cnt.forEach((c) => { if (c > best) best = c; });
        const cands = [...cnt.keys()].filter((l) => cnt.get(l) === best).sort((a, b) => a - b);
        let pick = cands.includes(labels[v]) ? labels[v] : cands[Math.floor(rnd() * cands.length)];
        if (pick !== labels[v]) { labels[v] = pick; changed = true; history.push(labels.slice()); }
      }
      if (!changed) break;
    }
    return { labels, history };
  };
  // 모듈성 Q
  G.modularity = function (g, labels) {
    const m = g.edges.length;
    if (!m) return 0;
    const deg = G.degree(g);
    let q = 0;
    for (const [a, b] of g.edges) if (labels[a] === labels[b]) q += 1;
    q /= m;
    const tot = new Map();
    deg.forEach((d, i) => tot.set(labels[i], (tot.get(labels[i]) || 0) + d));
    tot.forEach((d) => { q -= Math.pow(d / (2 * m), 2); });
    return q;
  };
  // 탐욕적 모듈성 최적화 (Louvain 1단계를 단순화) — 놀이터용
  G.greedyCommunities = function (g, skip) {
    const n = g.n;
    let labels = Array.from({ length: n }, (_, i) => i);
    const active = [...Array(n).keys()].filter((i) => !(skip && skip.has(i)));
    let improved = true, guard = 0;
    while (improved && guard++ < 30) {
      improved = false;
      for (const v of active) {
        const base = labels[v];
        let bestL = base, bestQ = G.modularity(g, labels);
        const cands = new Set(g.adj[v].filter((w) => !(skip && skip.has(w))).map((w) => labels[w]));
        for (const L of cands) {
          if (L === base) continue;
          labels[v] = L;
          const q = G.modularity(g, labels);
          if (q > bestQ + 1e-9) { bestQ = q; bestL = L; }
        }
        labels[v] = bestL;
        if (bestL !== base) improved = true;
      }
    }
    // 라벨 번호를 0,1,2… 로 정리 (큰 무리부터)
    const size = new Map();
    active.forEach((i) => size.set(labels[i], (size.get(labels[i]) || 0) + 1));
    const order = [...size.keys()].sort((a, b) => size.get(b) - size.get(a) || a - b);
    const remap = new Map(order.map((l, i) => [l, i]));
    labels = labels.map((l, i) => (skip && skip.has(i) ? -1 : remap.get(l)));
    return labels;
  };

  /* ---------- 네트워크 생성 모델 ---------- */
  G.erdosRenyi = function (n, p, seed) {
    const rnd = U.rng(seed), E = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() < p) E.push([i, j]);
    return U.shuffle(E, rnd); // 등장 순서를 섞어 '무작위로 생기는' 느낌
  };
  // 와츠-스트로가츠: lattice(고리) 링크와 재연결 결과를 함께 반환
  G.wattsStrogatz = function (n, k, beta, seed) {
    const rnd = U.rng(seed);
    const lattice = [];
    for (let i = 0; i < n; i++) for (let j = 1; j <= k / 2; j++) lattice.push([i, (i + j) % n]);
    const key = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
    const set = new Set(lattice.map(([a, b]) => key(a, b)));
    const final = [], rewired = [];
    for (const [a, b] of lattice) {
      if (rnd() < beta) {
        let c, tries = 0;
        do { c = Math.floor(rnd() * n); tries++; } while ((c === a || set.has(key(a, c))) && tries < 50);
        if (tries < 50) {
          set.delete(key(a, b)); set.add(key(a, c));
          final.push([a, c]); rewired.push({ from: [a, b], to: [a, c] });
          continue;
        }
      }
      final.push([a, b]);
    }
    return { lattice, final, rewired };
  };
  // 바라바시-알버트 선호적 연결: 추가 순서대로 링크 기록
  G.barabasiAlbert = function (n, m, seed) {
    const rnd = U.rng(seed);
    const E = [];
    const targets = [];
    const m0 = m + 1;
    for (let i = 0; i < m0; i++) for (let j = i + 1; j < m0; j++) { E.push([i, j, i]); targets.push(i, j); }
    for (let v = m0; v < n; v++) {
      const chosen = new Set();
      while (chosen.size < m) chosen.add(targets[Math.floor(rnd() * targets.length)]);
      for (const u of chosen) { E.push([u, v, v]); targets.push(u, v); }
    }
    return E; // [a, b, 등장한 노드 번호]
  };
  // 무리가 심어진 네트워크 (커뮤니티 장면용)
  G.planted = function (sizes, pIn, pOut, seed) {
    const rnd = U.rng(seed);
    const group = [];
    sizes.forEach((s, gi) => { for (let i = 0; i < s; i++) group.push(gi); });
    const n = group.length, E = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (rnd() < (group[i] === group[j] ? pIn : pOut)) E.push([i, j]);
    return { n, edges: E, group };
  };

  /* ---------- 힘-기반 배치 (Fruchterman–Reingold) ---------- */
  // box: {x, y, w, h}; init: 시작 좌표(선택). 결과는 box 안에 맞춰 늘림.
  G.layout = function (n, edges, box, opt = {}) {
    const rnd = U.rng(opt.seed || 1);
    const iters = opt.iters || 400;
    const pos = opt.init
      ? opt.init.map((p) => ({ x: p.x, y: p.y }))
      : Array.from({ length: n }, () => ({ x: box.x + rnd() * box.w, y: box.y + rnd() * box.h }));
    const area = box.w * box.h;
    const k = (opt.k || 1) * Math.sqrt(area / Math.max(1, n));
    let temp = box.w / 8;
    const fixed = opt.fixed || new Set();
    for (let it = 0; it < iters; it++) {
      const disp = pos.map(() => ({ x: 0, y: 0 }));
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          let dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
          let d = Math.hypot(dx, dy);
          if (d < 0.01) { dx = rnd() - 0.5; dy = rnd() - 0.5; d = 0.5; }
          const f = (k * k) / d;
          disp[i].x += (dx / d) * f; disp[i].y += (dy / d) * f;
          disp[j].x -= (dx / d) * f; disp[j].y -= (dy / d) * f;
        }
      for (const [a, b] of edges) {
        const dx = pos[a].x - pos[b].x, dy = pos[a].y - pos[b].y;
        const d = Math.max(0.01, Math.hypot(dx, dy));
        const f = (d * d) / k;
        disp[a].x -= (dx / d) * f; disp[a].y -= (dy / d) * f;
        disp[b].x += (dx / d) * f; disp[b].y += (dy / d) * f;
      }
      // 중심으로 약하게 끌어당겨 흩어진 조각이 멀리 가지 않게
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      for (let i = 0; i < n; i++) {
        if (fixed.has(i)) continue;
        disp[i].x += (cx - pos[i].x) * 0.02 * k / 10;
        disp[i].y += (cy - pos[i].y) * 0.02 * k / 10;
        const d = Math.max(0.01, Math.hypot(disp[i].x, disp[i].y));
        pos[i].x += (disp[i].x / d) * Math.min(d, temp);
        pos[i].y += (disp[i].y / d) * Math.min(d, temp);
      }
      temp = Math.max(0.5, temp * 0.985);
    }
    if (opt.fit !== false) G.fit(pos, box, opt.stretch);
    return pos;
  };
  // 좌표들을 box 안에 비율 유지하며 맞춤
  // stretch=true면 가로·세로를 따로 늘려 상자를 꽉 채움
  G.fit = function (pos, box, stretch) {
    if (!pos.length) return pos;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pos) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const s = Math.min(box.w / w, box.h / h);
    const sx = stretch ? box.w / w : s, sy = stretch ? box.h / h : s;
    const ox = box.x + (box.w - w * sx) / 2, oy = box.y + (box.h - h * sy) / 2;
    for (const p of pos) { p.x = ox + (p.x - x0) * sx; p.y = oy + (p.y - y0) * sy; }
    return pos;
  };
  G.circle = function (n, cx, cy, r, start = -Math.PI / 2) {
    return Array.from({ length: n }, (_, i) => ({
      x: cx + r * Math.cos(start + (i / n) * Math.PI * 2),
      y: cy + r * Math.sin(start + (i / n) * Math.PI * 2),
    }));
  };

  NA.G = G;
})();
