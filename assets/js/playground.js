/* 놀이터 — 직접 네트워크를 만들고 지표를 바로 확인 */
(function () {
  'use strict';
  const NA = window.NA;
  if (!NA || new URLSearchParams(location.search).has('render')) return;
  const { U, C, D, G } = NA;
  const cv = document.getElementById('pg-canvas');
  if (!cv) return;
  const g = cv.getContext('2d');
  const $ = (s) => document.querySelector(s);

  let nodes = []; // {id, label, x, y, vx, vy}
  let edges = []; // [idA, idB]
  let nextId = 0;
  let sel = null, hover = null, drag = null;
  let physics = true;
  let sizeBy = 'degree';
  let colorBy = true;
  let M = null; // 계산된 지표

  const COMM = [C.coral, C.sky, C.mint, C.amber, C.lilac, C.rose, '#7fd1c7', '#f4a261', '#a3b18a', '#e9c46a'];
  const label = (i) => NA.NAMES[i % NA.NAMES.length] + (i >= NA.NAMES.length ? Math.floor(i / NA.NAMES.length) + 1 : '');

  /* ---------- 예제 ---------- */
  const PRESETS = {
    kite: () => {
      const E = [[0, 1], [0, 2], [0, 3], [0, 5], [1, 3], [1, 4], [1, 6], [2, 3], [2, 5], [3, 4], [3, 5], [3, 6], [4, 6], [5, 6], [5, 7], [6, 7], [7, 8], [8, 9]];
      const grid = [[-1, -1], [-1, 1], [0, -2], [0, 0], [0, 2], [1, -1], [1, 1], [2, 0], [3, 0], [4, 0]];
      return { n: 10, E, P: grid.map(([x, y]) => ({ x: 470 + x * 100, y: 360 + y * 100 })), names: ['지민', '서준', '하윤', '도윤', '수아', '예준', '서연', '민준', '지우', '하준'], still: true };
    },
    two: () => {
      const E = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [4, 5], [4, 6], [5, 6], [5, 7], [6, 7], [5, 8], [7, 8], [6, 8]];
      return { n: 9, E };
    },
    star: () => ({ n: 9, E: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => [0, i]) }),
    ring: () => ({ n: 10, E: Array.from({ length: 10 }, (_, i) => [i, (i + 1) % 10]) }),
    complete: () => {
      const E = [];
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) E.push([i, j]);
      return { n: 6, E };
    },
    random: () => ({ n: 18, E: G.erdosRenyi(18, 0.16, Math.floor(Math.random() * 1e6)) }),
    smallworld: () => ({ n: 18, E: G.wattsStrogatz(18, 4, 0.2, Math.floor(Math.random() * 1e6)).final, circle: true }),
    scalefree: () => ({ n: 26, E: G.barabasiAlbert(26, 1, Math.floor(Math.random() * 1e6)).map(([a, b]) => [a, b]) }),
    empty: () => ({ n: 0, E: [] }),
  };
  function load(key) {
    const p = PRESETS[key]();
    let P = p.P;
    if (!P) P = p.circle ? G.circle(p.n, 640, 360, 250) : G.layout(p.n, p.E, { x: 200, y: 110, w: 880, h: 500 }, { seed: 7, iters: 300 });
    nodes = Array.from({ length: p.n }, (_, i) => ({ id: i, label: p.names ? p.names[i] : label(i), x: P[i].x, y: P[i].y, vx: 0, vy: 0 }));
    edges = p.E.map(([a, b]) => [a, b]);
    nextId = p.n;
    sel = null;
    if (p.still) setPhysics(false);
    else if (key !== 'empty') setPhysics(true);
    recompute();
  }

  /* ---------- 지표 계산 ---------- */
  function recompute() {
    const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
    const n = nodes.length;
    const gr = G.make(n, edges.map(([a, b]) => [idx.get(a), idx.get(b)]));
    const deg = G.degree(gr);
    const comps = G.components(gr);
    const ps = G.pathStats(gr);
    const cent = n ? NA.centralities(gr) : { degree: [], close: [], betw: [], eig: [] };
    const clust = G.clustering(gr);
    const comm = gr.edges.length ? G.greedyCommunities(gr) : new Array(n).fill(0);
    const Q = gr.edges.length ? G.modularity(gr, comm) : 0;
    M = {
      gr, idx, n, m: gr.edges.length, deg, comps, ps, cent, clust, comm, Q,
      density: G.density(gr),
      avgDeg: n ? deg.reduce((s, d) => s + d, 0) / n : 0,
      avgClust: n ? clust.reduce((s, c) => s + c, 0) / n : 0,
      nComm: gr.edges.length ? new Set(comm).size : n,
    };
    renderStats();
  }
  const metricVals = () => {
    if (!M || !M.n) return [];
    if (sizeBy === 'none') return new Array(M.n).fill(0.35);
    if (sizeBy === 'clust') return M.clust;
    return G.norm(M.cent[sizeBy]);
  };

  /* ---------- 지표 표시 ---------- */
  const NAMES = { degree: '연결정도', close: '근접', betw: '매개', eig: '아이겐벡터', clust: '군집 계수' };
  function renderStats() {
    const f = (v, d = 2) => (isFinite(v) ? U.fmt(v, d) : '–');
    const connected = M.comps.count <= 1;
    const items = [
      ['노드', M.n, '점의 개수'],
      ['링크', M.m, '선의 개수'],
      ['밀도', f(M.density), '실제 ÷ 가능한 링크'],
      ['평균 연결정도', f(M.avgDeg, 1), '노드 하나당 링크'],
      ['평균 군집 계수', f(M.avgClust), '친구끼리 친구인 정도'],
      ['연결 덩어리', M.comps.count, connected ? '모두 이어져 있음' : '서로 끊긴 조각 수'],
      ['지름', M.m ? M.ps.diameter : '–', '가장 먼 두 노드의 거리'],
      ['평균 경로 길이', M.m ? f(M.ps.avg) : '–', '이어진 쌍의 평균 거리'],
      ['커뮤니티', M.m ? M.nComm : '–', '모듈성 최대화로 찾음'],
      ['모듈성 Q', M.m ? f(M.Q) : '–', '0.3 이상이면 뚜렷한 편'],
    ];
    $('#pg-stats').innerHTML = items.map(([k, v, d]) => `<div><dt>${k}</dt><dd>${v}</dd><small>${d}</small></div>`).join('');
    // 순위
    const key = sizeBy === 'none' ? 'degree' : sizeBy;
    const vals = key === 'clust' ? M.clust : M.cent[key] || [];
    const order = [...Array(M.n).keys()].sort((a, b) => vals[b] - vals[a] || a - b).slice(0, 5);
    $('#pg-rank-title').textContent = `${NAMES[key]} 상위 5`;
    $('#pg-rank').innerHTML = order.length
      ? order.map((i) => `<li><span>${escapeHtml(nodes[i].label)}</span><b>${U.fmt(vals[i], 2)}</b></li>`).join('')
      : '<li class="empty">노드를 추가해 보세요</li>';
    renderDetail();
  }
  function renderDetail() {
    const el = $('#pg-detail');
    const id = sel != null ? sel : hover;
    if (id == null || !M || !M.idx.has(id)) { el.innerHTML = '<p class="muted">노드를 클릭하거나 마우스를 올리면 자세한 값이 여기에 나와요.</p>'; return; }
    const i = M.idx.get(id);
    const nb = M.gr.adj[i].map((j) => escapeHtml(nodes[j].label)).join(', ') || '없음';
    el.innerHTML = `<h4>${escapeHtml(nodes[i].label)}</h4>
      <dl class="mini">
        <div><dt>연결정도</dt><dd>${M.deg[i]}</dd></div>
        <div><dt>근접 중심성</dt><dd>${U.fmt(M.cent.close[i], 2)}</dd></div>
        <div><dt>매개 중심성</dt><dd>${U.fmt(M.cent.betw[i], 2)}</dd></div>
        <div><dt>아이겐벡터</dt><dd>${U.fmt(M.cent.eig[i], 2)}</dd></div>
        <div><dt>군집 계수</dt><dd>${U.fmt(M.clust[i], 2)}</dd></div>
        <div><dt>커뮤니티</dt><dd>${M.m ? M.comm[i] + 1 + '번' : '–'}</dd></div>
      </dl>
      <p class="muted">이웃: ${nb}</p>`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- 편집 ---------- */
  const hasEdge = (a, b) => edges.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
  function toggleEdge(a, b) {
    const k = hasEdge(a, b);
    if (k >= 0) edges.splice(k, 1);
    else edges.push([a, b]);
    recompute();
  }
  function addNode(x, y) {
    const id = nextId++;
    nodes.push({ id, label: label(id), x, y, vx: 0, vy: 0 });
    recompute();
    return id;
  }
  function removeNode(id) {
    nodes = nodes.filter((nd) => nd.id !== id);
    edges = edges.filter(([a, b]) => a !== id && b !== id);
    if (sel === id) sel = null;
    recompute();
  }

  /* ---------- 물리 배치 ---------- */
  function step() {
    const n = nodes.length;
    if (!n) return;
    const k = 95;
    const byId = new Map(nodes.map((nd) => [nd.id, nd]));
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const d = Math.sqrt(d2);
        const f = Math.min(8, (k * k) / d2) * 0.9;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    for (const [ia, ib] of edges) {
      const a = byId.get(ia), b = byId.get(ib);
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - 110) * 0.03;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const nd of nodes) {
      if (drag && drag.id === nd.id) { nd.vx = nd.vy = 0; continue; }
      nd.vx += (640 - nd.x) * 0.004;
      nd.vy += (360 - nd.y) * 0.004;
      nd.vx *= 0.82; nd.vy *= 0.82;
      nd.x = U.clamp(nd.x + nd.vx, 40, D.W - 40);
      nd.y = U.clamp(nd.y + nd.vy, 40, D.H - 40);
    }
  }

  /* ---------- 그리기 ---------- */
  function draw() {
    const scale = cv.width / D.W;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    D.bg(g);
    if (!nodes.length) {
      D.text(g, '빈 곳을 클릭해 첫 노드를 만들어 보세요', 640, 350, { size: 30, kind: 'display', color: C.dim, align: 'center' });
      D.text(g, '또는 위에서 예제를 불러오세요', 640, 392, { size: 18, color: C.faint, align: 'center' });
      return;
    }
    const vals = metricVals();
    const color = sizeBy === 'none' ? C.amber : { degree: C.amber, close: C.sky, betw: C.coral, eig: C.lilac, clust: C.mint }[sizeBy];
    const byId = new Map(nodes.map((nd) => [nd.id, nd]));
    const hiId = sel != null ? sel : hover;
    for (const [a, b] of edges) {
      const A = byId.get(a), B = byId.get(b);
      const on = hiId != null && (a === hiId || b === hiId);
      const cross = colorBy && M.m && M.comm[M.idx.get(a)] !== M.comm[M.idx.get(b)];
      D.edge(g, A.x, A.y, B.x, B.y, { w: on ? 4 : 2.5, color: on ? C.amber : cross ? U.rgba(C.ink, 0.35) : C.edge });
    }
    // 선택 노드에서 마우스까지 연결 미리보기
    if (sel != null && byId.get(sel) && pointer.x > 0 && !drag) {
      const A = byId.get(sel);
      D.edge(g, A.x, A.y, pointer.x, pointer.y, { w: 2, color: C.amber, dash: [5, 6], a: 0.7 });
    }
    nodes.forEach((nd, i) => {
      const v = vals[i] || 0;
      const r = 12 + 20 * v;
      let fill = colorBy && M.m ? COMM[M.comm[i] % COMM.length] : U.mix(C.node, color, v);
      D.node(g, nd.x, nd.y, r, {
        fill, label: nd.label, labelSize: 15,
        ring: nd.id === sel ? 1 : nd.id === hover ? 0.7 : 0, ringColor: nd.id === sel ? C.amber : C.ink,
      });
      nd.r = r;
    });
  }

  /* ---------- 마우스·터치 ---------- */
  const pointer = { x: -1, y: -1 };
  const toStage = (e) => {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * D.W, y: ((e.clientY - r.top) / r.height) * D.H };
  };
  const nodeAt = (p) => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const nd = nodes[i];
      if (U.dist(p.x, p.y, nd.x, nd.y) <= (nd.r || 14) + 6) return nd;
    }
    return null;
  };
  cv.addEventListener('pointerdown', (e) => {
    const p = toStage(e);
    const nd = nodeAt(p);
    drag = { id: nd ? nd.id : null, sx: p.x, sy: p.y, moved: false };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', (e) => {
    const p = toStage(e);
    pointer.x = p.x; pointer.y = p.y;
    if (drag && drag.id != null) {
      if (Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 5) drag.moved = true;
      if (drag.moved) {
        const nd = nodes.find((x) => x.id === drag.id);
        nd.x = U.clamp(p.x, 20, D.W - 20); nd.y = U.clamp(p.y, 20, D.H - 20);
      }
    }
    const h = nodeAt(p);
    const nh = h ? h.id : null;
    if (nh !== hover) { hover = nh; renderDetail(); }
    cv.style.cursor = drag && drag.moved ? 'grabbing' : h ? 'pointer' : 'crosshair';
  });
  cv.addEventListener('pointerup', (e) => {
    const p = toStage(e);
    const d = drag;
    drag = null;
    if (!d || d.moved) return;
    if (d.id == null) {
      if (sel != null) sel = null;
      else addNode(p.x, p.y);
    } else if (sel == null) sel = d.id;
    else if (sel === d.id) sel = null;
    else toggleEdge(sel, d.id);
    renderDetail();
  });
  cv.addEventListener('pointerleave', () => { pointer.x = -1; if (!drag) { hover = null; renderDetail(); } });
  cv.addEventListener('dblclick', (e) => {
    const nd = nodeAt(toStage(e));
    if (nd) removeNode(nd.id);
  });
  cv.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel != null) { removeNode(sel); e.preventDefault(); }
    if (e.key === 'Escape') sel = null;
  });

  /* ---------- 도구 막대 ---------- */
  function setPhysics(on) {
    physics = on;
    const b = $('#pg-physics');
    b.setAttribute('aria-pressed', on);
    b.textContent = on ? '자동 정리 켜짐' : '자동 정리 꺼짐';
  }
  $('#pg-preset').onchange = (e) => { if (e.target.value) load(e.target.value); };
  $('#pg-physics').onclick = () => setPhysics(!physics);
  $('#pg-size').onchange = (e) => { sizeBy = e.target.value; renderStats(); };
  $('#pg-color').onchange = (e) => { colorBy = e.target.checked; };
  $('#pg-delete').onclick = () => { if (sel != null) removeNode(sel); };
  $('#pg-clear').onclick = () => { $('#pg-preset').value = 'empty'; load('empty'); };
  $('#pg-copy').onclick = async () => {
    const csv = 'source,target\n' + edges.map(([a, b]) => {
      const A = nodes.find((x) => x.id === a).label, B = nodes.find((x) => x.id === b).label;
      return `${A},${B}`;
    }).join('\n');
    const out = $('#pg-csv');
    out.value = csv;
    const msg = $('#pg-copy-msg');
    try { await navigator.clipboard.writeText(csv); msg.textContent = '복사했어요. 엑셀이나 Gephi에 붙여 넣을 수 있어요.'; }
    catch (err) { out.select(); msg.textContent = '아래 칸의 내용을 직접 복사하세요 (Ctrl+C).'; }
    $('#pg-io').open = true;
  };
  $('#pg-import').onclick = () => {
    const txt = $('#pg-csv').value.trim();
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const names = new Map();
    const E = [];
    lines.forEach((line, li) => {
      const parts = line.split(/[,\t;]|\s{2,}|\s+-+\s+|\s+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2) return;
      if (li === 0 && /^(source|from|node1|출발|노드1)$/i.test(parts[0])) return;
      const [a, b] = parts;
      [a, b].forEach((nm) => { if (!names.has(nm)) names.set(nm, names.size); });
      if (a !== b) E.push([names.get(a), names.get(b)]);
    });
    const msg = $('#pg-copy-msg');
    if (!names.size) { msg.textContent = '읽을 수 있는 줄이 없어요. 한 줄에 "노드1,노드2" 형식으로 적어 주세요.'; return; }
    const n = names.size;
    const P = G.layout(n, E, { x: 160, y: 90, w: 960, h: 540 }, { seed: 3, iters: 300 });
    const lab = [...names.keys()];
    nodes = lab.map((nm, i) => ({ id: i, label: nm, x: P[i].x, y: P[i].y, vx: 0, vy: 0 }));
    const seen = new Set();
    edges = E.filter(([a, b]) => { const k = Math.min(a, b) + '-' + Math.max(a, b); if (seen.has(k)) return false; seen.add(k); return true; });
    nextId = n;
    sel = null;
    setPhysics(true);
    recompute();
    msg.textContent = `노드 ${n}개, 링크 ${edges.length}개를 불러왔어요.`;
  };

  function resize() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.round(r.width * dpr));
    if (cv.width !== w) { cv.width = w; cv.height = Math.round((w * D.H) / D.W); }
  }
  new ResizeObserver(resize).observe(cv);
  resize();

  load('kite');
  $('#pg-preset').value = 'kite';
  function loop() {
    if (physics) step();
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
