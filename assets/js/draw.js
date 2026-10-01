/* 캔버스 그리기 도우미 — 노드, 링크, 글자, 패널, 아이콘 */
(function () {
  'use strict';
  const NA = window.NA;
  const { U, C } = NA;
  const D = {};

  D.FONT = {
    display: '"Do Hyeon", "Black Han Sans", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "WenQuanYi Zen Hei", sans-serif',
    body: '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "WenQuanYi Zen Hei", sans-serif',
    mono: '"IBM Plex Mono", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", ui-monospace, Menlo, Consolas, monospace',
  };
  D.font = (size, kind = 'body', weight = 400) => `${weight} ${size}px ${D.FONT[kind]}`;

  D.W = 1280;
  D.H = 720;

  /* ---------- 배경 ---------- */
  let bgCache = null;
  D.bg = function (g) {
    if (!bgCache) {
      bgCache = document.createElement('canvas');
      bgCache.width = D.W * 2;
      bgCache.height = D.H * 2;
      const b = bgCache.getContext('2d');
      b.scale(2, 2);
      const grad = b.createRadialGradient(D.W * 0.5, D.H * 0.42, 80, D.W * 0.5, D.H * 0.5, D.W * 0.75);
      grad.addColorStop(0, C.bg2);
      grad.addColorStop(1, C.bg);
      b.fillStyle = grad;
      b.fillRect(0, 0, D.W, D.H);
      // 모눈 점 — 네트워크의 '격자'를 은은하게 암시
      b.fillStyle = U.rgba(C.ink, 0.07);
      for (let x = 20; x < D.W; x += 40)
        for (let y = 20; y < D.H; y += 40) {
          b.beginPath();
          b.arc(x, y, 1.1, 0, Math.PI * 2);
          b.fill();
        }
    }
    g.drawImage(bgCache, 0, 0, D.W, D.H);
  };

  /* ---------- 기본 도형 ---------- */
  D.rr = function (g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  D.panel = function (g, x, y, w, h, o = {}) {
    const a = o.a == null ? 1 : o.a;
    if (a <= 0) return;
    g.save();
    g.globalAlpha *= a;
    D.rr(g, x, y, w, h, o.r == null ? 14 : o.r);
    g.fillStyle = o.fill || U.rgba('#08141a', 0.72);
    g.fill();
    if (o.stroke !== false) {
      g.strokeStyle = o.stroke || U.rgba(C.ink, 0.12);
      g.lineWidth = o.lw || 1.5;
      if (o.dash) g.setLineDash(o.dash);
      g.stroke();
    }
    g.restore();
  };

  D.text = function (g, str, x, y, o = {}) {
    const a = o.a == null ? 1 : o.a;
    if (a <= 0 || str == null) return 0;
    g.save();
    g.globalAlpha *= a;
    g.font = D.font(o.size || 20, o.kind || 'body', o.weight || 400);
    g.fillStyle = o.color || C.ink;
    g.textAlign = o.align || 'left';
    g.textBaseline = o.base || 'alphabetic';
    if (o.shadow) {
      g.shadowColor = 'rgba(0,0,0,0.55)';
      g.shadowBlur = o.shadow;
    }
    if (o.spacing) g.letterSpacing = o.spacing + 'px';
    g.fillText(String(str), x, y);
    const w = g.measureText(String(str)).width;
    g.restore();
    return w;
  };
  D.measure = function (g, str, size, kind = 'body', weight = 400) {
    g.save();
    g.font = D.font(size, kind, weight);
    const w = g.measureText(str).width;
    g.restore();
    return w;
  };

  /* ---------- 강조 표시가 들어간 문장 ----------
   * "**노드**는 점" → '노드'만 강조색/굵게. maxW를 주면 띄어쓰기 단위로 줄바꿈. */
  function parseRich(str) {
    const out = [];
    const parts = String(str).split('**');
    parts.forEach((p, i) => { if (p) out.push({ s: p, hl: i % 2 === 1 }); });
    return out;
  }
  // 단어(띄어쓰기 단위) 토큰으로 분해: [{s, hl, space}]
  function tokens(str) {
    const toks = [];
    for (const seg of parseRich(str)) {
      const pieces = seg.s.split(/( )/);
      for (const p of pieces) {
        if (p === '') continue;
        if (p === ' ') toks.push({ s: ' ', hl: seg.hl, space: true });
        else toks.push({ s: p, hl: seg.hl });
      }
    }
    return toks;
  }
  D.rich = function (g, str, x, y, o = {}) {
    const size = o.size || 24, kind = o.kind || 'body';
    const wN = o.weight || 400, wH = o.hlWeight || 700;
    const a = o.a == null ? 1 : o.a;
    const lh = o.lh || size * 1.45;
    const fontN = D.font(size, kind, wN), fontH = D.font(size, kind, wH);
    g.save();
    const toks = tokens(str).map((t) => {
      g.font = t.hl ? fontH : fontN;
      return Object.assign(t, { w: g.measureText(t.s).width });
    });
    // 줄 나누기
    const lines = [[]];
    let cur = 0;
    for (const t of toks) {
      const line = lines[lines.length - 1];
      if (o.maxW && !t.space && cur + t.w > o.maxW && line.length) {
        while (line.length && line[line.length - 1].space) line.pop();
        lines.push([]);
        cur = 0;
      }
      if (t.space && !lines[lines.length - 1].length) continue;
      lines[lines.length - 1].push(t);
      cur += t.w;
    }
    const widths = lines.map((l) => l.reduce((s, t) => s + t.w, 0));
    const maxLine = Math.max(...widths, 0);
    if (a > 0 && !o.measureOnly) {
      g.globalAlpha *= a;
      g.textBaseline = o.base || 'alphabetic';
      g.textAlign = 'left';
      if (o.shadow) { g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = o.shadow; }
      lines.forEach((l, li) => {
        let lx = x;
        if (o.align === 'center') lx = x - widths[li] / 2;
        else if (o.align === 'right') lx = x - widths[li];
        const ly = y + li * lh;
        for (const t of l) {
          g.font = t.hl ? fontH : fontN;
          g.fillStyle = t.hl ? o.hl || C.amber : o.color || C.ink;
          g.fillText(t.s, lx, ly);
          lx += t.w;
        }
      });
    }
    g.restore();
    return { w: maxLine, h: lines.length * lh, lines: lines.length, lh };
  };

  /* ---------- 노드와 링크 ---------- */
  D.node = function (g, x, y, r, o = {}) {
    const a = o.a == null ? 1 : o.a;
    if (a <= 0 || r < 0.5) return;
    g.save();
    g.globalAlpha *= a;
    if (o.halo) {
      // 은은한 빛 번짐
      const grad = g.createRadialGradient(x, y, r * 0.6, x, y, r + o.halo);
      grad.addColorStop(0, U.rgba(o.haloColor || o.fill || C.amber, 0.45));
      grad.addColorStop(1, U.rgba(o.haloColor || o.fill || C.amber, 0));
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r + o.halo, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = o.fill || C.node;
    g.fill();
    g.lineWidth = o.lw || 2.5;
    g.strokeStyle = o.stroke || C.bg;
    g.stroke();
    if (o.ring) {
      g.beginPath();
      g.arc(x, y, r + 5 + (o.ringGap || 0), 0, Math.PI * 2);
      g.lineWidth = o.ringW || 3;
      g.strokeStyle = o.ringColor || C.amber;
      g.globalAlpha *= o.ring;
      g.stroke();
    }
    g.restore();
    if (o.text != null)
      D.text(g, o.text, x, y + 1, {
        size: o.textSize || Math.max(11, r * 0.95), kind: o.textKind || 'mono', weight: 600,
        color: o.textColor || C.bg, align: 'center', base: 'middle', a,
      });
    if (o.label != null) {
      const ls = o.labelSize || 17;
      const pos = o.labelPos || 'below';
      let lx = x, ly = y + r + ls + 2, al = 'center';
      if (pos === 'above') ly = y - r - 9;
      if (pos === 'right') { lx = x + r + 8; ly = y + ls * 0.35; al = 'left'; }
      if (pos === 'left') { lx = x - r - 8; ly = y + ls * 0.35; al = 'right'; }
      D.text(g, o.label, lx, ly, {
        size: ls, color: o.labelColor || C.ink, align: al, a: a * (o.labelA == null ? 1 : o.labelA),
        weight: o.labelWeight || 500, shadow: 6,
      });
    }
  };

  D.arrowHead = function (g, x, y, ang, size, color) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-size, size * 0.55);
    g.lineTo(-size * 0.78, 0);
    g.lineTo(-size, -size * 0.55);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.restore();
  };

  // 두 점 사이 링크. p: 그려지는 정도(0~1), arrow: 화살촉 크기 비율(0~1)
  D.edge = function (g, x1, y1, x2, y2, o = {}) {
    const a = o.a == null ? 1 : o.a;
    const p = o.p == null ? 1 : o.p;
    if (a <= 0 || p <= 0) return;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const r1 = o.r1 || 0, r2 = o.r2 || 0;
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < r1 + r2 + 1) return;
    const w = o.w || 2.5;
    const color = o.color || C.edge;
    const hs = Math.min(24, Math.max(13, w * 2.4));
    const ah = (o.arrow || 0) * hs;
    const ah1 = (o.arrowBack || 0) * hs;
    const sx = x1 + Math.cos(ang) * (r1 + ah1 * 0.8), sy = y1 + Math.sin(ang) * (r1 + ah1 * 0.8);
    const ex = x2 - Math.cos(ang) * (r2 + ah * 0.8), ey = y2 - Math.sin(ang) * (r2 + ah * 0.8);
    const cx = sx + (ex - sx) * p, cy = sy + (ey - sy) * p;
    g.save();
    g.globalAlpha *= a;
    if (o.glow) { g.shadowColor = color; g.shadowBlur = o.glow; }
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = 'round';
    if (o.dash) g.setLineDash(o.dash);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(cx, cy);
    g.stroke();
    g.setLineDash([]);
    g.shadowBlur = 0;
    if (ah > 0 && p >= 0.98) D.arrowHead(g, x2 - Math.cos(ang) * (r2 + 1), y2 - Math.sin(ang) * (r2 + 1), ang, ah, color);
    if (ah1 > 0 && p >= 0.98) D.arrowHead(g, x1 + Math.cos(ang) * (r1 + 1), y1 + Math.sin(ang) * (r1 + 1), ang + Math.PI, ah1, color);
    g.restore();
  };

  // 링크 위를 움직이는 빛 알갱이
  D.pulse = function (g, x1, y1, x2, y2, p, o = {}) {
    const x = U.lerp(x1, x2, p), y = U.lerp(y1, y2, p);
    D.node(g, x, y, o.r || 6, { fill: o.color || C.amber, stroke: 'transparent', lw: 0, halo: o.halo == null ? 12 : o.halo, a: o.a == null ? 1 : o.a });
  };
  // 경로(노드 좌표 목록)를 따라 이동하는 알갱이. p: 0~1
  D.pathPoint = function (pts, p) {
    if (pts.length < 2) return pts[0];
    const segs = pts.length - 1;
    const f = U.clamp(p) * segs;
    const i = Math.min(segs - 1, Math.floor(f));
    const lt = f - i;
    return { x: U.lerp(pts[i].x, pts[i + 1].x, lt), y: U.lerp(pts[i].y, pts[i + 1].y, lt) };
  };

  D.badge = function (g, str, x, y, o = {}) {
    const size = o.size || 18;
    const a = o.a == null ? 1 : o.a;
    if (a <= 0) return;
    const w = D.measure(g, str.replace(/\*\*/g, ''), size, o.kind || 'body', o.weight || 600) + size * 1.3;
    const h = size * 1.8;
    let bx = x - w / 2;
    if (o.align === 'left') bx = x;
    if (o.align === 'right') bx = x - w;
    D.panel(g, bx, y - h / 2, w, h, { r: h / 2, fill: o.fill || C.amber, stroke: o.stroke || false, a });
    D.rich(g, str, bx + w / 2, y + size * 0.36, {
      size, kind: o.kind || 'body', weight: o.weight || 600, hlWeight: 800,
      color: o.color || C.bg, hl: o.hl || o.color || C.bg, align: 'center', a,
    });
    return w;
  };

  // 지시선이 달린 설명 상자. (x, y)는 지시선 끝점, 글자는 그 아래(또는 above면 위)에 놓임
  D.callout = function (g, fromX, fromY, x, y, title, sub, o = {}) {
    const a = o.a == null ? 1 : o.a;
    if (a <= 0) return;
    const color = o.color || C.amber;
    const size = o.size || 34;
    const above = o.above == null ? y < fromY : o.above;
    g.save();
    g.globalAlpha *= a;
    g.strokeStyle = U.rgba(color, 0.8);
    g.lineWidth = 2;
    g.setLineDash([4, 5]);
    g.beginPath();
    g.moveTo(fromX, fromY);
    g.lineTo(x, y);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = color;
    g.beginPath();
    g.arc(fromX, fromY, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const al = o.align || 'left';
    const ty = above ? y - (sub ? 42 : 10) : y + size + 2;
    const sy = above ? y - 12 : ty + 30;
    D.text(g, title, x, ty, { size, kind: 'display', color, align: al, a, shadow: 8 });
    if (sub) D.rich(g, sub, x, sy, { size: o.subSize || 19, color: C.ink, hl: color, align: al, a, maxW: o.maxW, shadow: 6 });
  };

  /* ---------- 작은 아이콘 (이모지 대신 직접 그림: 어떤 환경에서도 같게 보이도록) ---------- */
  D.icon = function (g, type, x, y, s, color, a = 1) {
    if (a <= 0) return;
    g.save();
    g.globalAlpha *= a;
    g.translate(x, y);
    g.scale(s / 24, s / 24);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (type === 'person') {
      g.beginPath(); g.arc(0, -5, 5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(0, 11, 9, Math.PI, 0); g.closePath(); g.fill();
    } else if (type === 'station') {
      g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.lineWidth = 4; g.stroke();
    } else if (type === 'page') {
      D.rr(g, -8, -10, 16, 20, 2); g.lineWidth = 2.2; g.stroke();
      g.beginPath(); g.moveTo(-8, -4); g.lineTo(8, -4); g.stroke();
      g.beginPath(); g.arc(-4.5, -7, 1.2, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-4, 1); g.lineTo(4, 1); g.moveTo(-4, 5); g.lineTo(2, 5); g.stroke();
    } else if (type === 'doc') {
      g.beginPath(); g.moveTo(-8, -10); g.lineTo(3, -10); g.lineTo(8, -5); g.lineTo(8, 10); g.lineTo(-8, 10); g.closePath();
      g.lineWidth = 2.2; g.stroke();
      g.beginPath(); g.moveTo(-4, -2); g.lineTo(4, -2); g.moveTo(-4, 2); g.lineTo(4, 2); g.moveTo(-4, 6); g.lineTo(1, 6); g.stroke();
    }
    g.restore();
  };

  /* ---------- 장면 제목 ---------- */
  D.header = function (g, kicker, title, t, dur) {
    const a = U.vis(t, 0.15, dur + 10, 0.7);
    const slide = (1 - U.easeOut(U.seg(t, 0.15, 0.9))) * -30;
    if (a <= 0) return;
    D.text(g, kicker, 64 + slide, 62, { size: 16, kind: 'mono', weight: 500, color: C.amber, a, spacing: 1.5 });
    D.text(g, title, 64 + slide, 104, { size: 40, kind: 'display', color: C.ink, a, shadow: 10 });
  };

  /* ---------- 자막 ---------- */
  D.caption = function (g, str, a) {
    if (!str || a <= 0) return;
    const size = 25;
    const m = D.rich(g, str, 0, 0, { size, maxW: 1060, measureOnly: true, weight: 500, lh: 36 });
    const padX = 26, padY = 16;
    const w = m.w + padX * 2, h = m.h + padY * 2 - 6;
    const x = D.W / 2 - w / 2, y = D.H - 40 - h;
    D.panel(g, x, y, w, h, { r: 14, fill: U.rgba('#061016', 0.82), stroke: U.rgba(C.ink, 0.08), a });
    D.rich(g, str, D.W / 2, y + padY + 24, { size, maxW: 1060, align: 'center', weight: 500, lh: 36, a, color: C.ink, hl: C.amber });
  };

  NA.D = D;
})();
