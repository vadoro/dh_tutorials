/* 영상 플레이어 — 타임라인, 자막, 컨트롤, 상호작용, 음성 해설, 영상 렌더링 모드 */
(function () {
  'use strict';
  const NA = window.NA;
  const { U, C, D } = NA;
  const scenes = NA.scenes;

  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  const FADE = 0.45;

  let acc = 0;
  scenes.forEach((s, i) => {
    s.index = i;
    s.start = acc;
    acc += s.dur;
    s.state = s.init();
  });
  const TOTAL = acc;

  const fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  const strip = (s) => String(s).replace(/\*\*/g, '');

  function captionAt(sc, t) {
    const cs = sc.captions || [];
    let k = -1;
    for (let i = 0; i < cs.length; i++) if (cs[i][0] <= t) k = i;
    if (k < 0) return null;
    const start = cs[k][0];
    const end = k + 1 < cs.length ? cs[k + 1][0] : sc.dur - 0.2;
    const a = Math.min(U.seg(t, start, start + 0.25), 1 - U.seg(t, end - 0.25, end));
    return { k, text: cs[k][1], a, start, end };
  }

  class Player {
    constructor(canvas) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.T = 0;
      this.playing = false;
      this.speed = 1;
      this.cc = true;
      this.hits = [];
      this.hover = null;
      this.ptr = { x: -999, y: -999 };
      this.drag = null;
      this.cur = -1;
      this.listeners = [];
      this.tts = { on: false, busy: false, key: null, voice: null };
      this.started = false;
    }
    get total() { return TOTAL; }
    sceneAt(T) {
      for (let i = scenes.length - 1; i >= 0; i--) if (T >= scenes[i].start) return scenes[i];
      return scenes[0];
    }
    on(fn) { this.listeners.push(fn); }
    emit(type) { this.listeners.forEach((fn) => fn(type, this)); }

    clearOverrides() {
      scenes.forEach((s) => {
        if (s.state.ov) {
          s.state.ov = null;
          if (s.state.syncPanel) s.state.syncPanel();
        }
      });
    }
    play() {
      if (this.T >= TOTAL - 0.05) this.seek(0);
      this.clearOverrides();
      this.playing = true;
      this.started = true;
      this.ttsKey = null;
      this.emit('play');
    }
    pause() {
      if (!this.playing) return;
      this.playing = false;
      this.stopSpeech();
      this.emit('pause');
    }
    toggle() { this.playing ? this.pause() : this.play(); }
    seek(T) {
      this.T = U.clamp(T, 0, TOTAL);
      this.clearOverrides();
      this.stopSpeech();
      this.emit('seek');
    }
    seekScene(id, t = 0, play = false) {
      const s = scenes.find((x) => x.id === id);
      if (!s) return;
      this.T = s.start + t;
      this.stopSpeech();
      this.emit('seek');
      if (play) { this.playing = true; this.started = true; this.emit('play'); }
    }
    chapterJump(dir) {
      const s = this.sceneAt(this.T);
      const local = this.T - s.start;
      let i = s.index + dir;
      if (dir < 0 && local > 2) i = s.index;
      i = U.clamp(i, 0, scenes.length - 1);
      this.seek(scenes[i].start);
    }

    /* ---------- 음성 해설 (브라우저 내장 TTS) ---------- */
    stopSpeech() {
      if (this.tts.on && window.speechSynthesis) window.speechSynthesis.cancel();
      this.tts.busy = false;
      this.tts.key = null;
    }
    speak(text) {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(strip(text).replace(/·/g, ', ').replace(/×/g, ' 곱하기 ').replace(/÷/g, ' 나누기 '));
      u.lang = 'ko-KR';
      if (this.tts.voice) u.voice = this.tts.voice;
      u.rate = 1.08 * Math.min(1.4, this.speed);
      this.tts.busy = true;
      u.onend = u.onerror = () => { this.tts.busy = false; };
      synth.speak(u);
    }

    /* ---------- 매 프레임 ---------- */
    tick(dt) {
      if (this.playing) {
        let next = this.T + dt * this.speed;
        const sc = this.sceneAt(this.T);
        const cap = captionAt(sc, this.T - sc.start);
        // 음성이 아직 읽는 중이면 다음 자막으로 넘어가지 않고 기다림
        if (this.tts.on && this.tts.busy && cap) {
          const limit = sc.start + cap.end - 0.3;
          if (next > limit) next = Math.max(this.T, limit);
        }
        this.T = next;
        if (this.T >= TOTAL) { this.T = TOTAL; this.playing = false; this.emit('pause'); }
      }
      const sc = this.sceneAt(this.T);
      if (sc.index !== this.cur) { this.cur = sc.index; this.emit('scene'); }
      if (this.tts.on && this.playing) {
        const cap = captionAt(sc, this.T - sc.start);
        const key = cap ? sc.index + ':' + cap.k : null;
        if (key && key !== this.tts.key) { this.tts.key = key; this.speak(cap.text); }
      }
      this.draw(this.T, dt);
    }

    draw(T, dt, opt = {}) {
      const g = this.g;
      const scale = this.canvas.width / D.W;
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.globalAlpha = 1;
      D.bg(g);
      const sc = this.sceneAt(T);
      const t = Math.min(T - sc.start, sc.dur);
      const last = sc.index === scenes.length - 1;
      const fa = Math.min(1, U.seg(t, 0, FADE), last ? 1 : 1 - U.seg(t, sc.dur - FADE, sc.dur));
      const hits = [];
      const env = {
        dt: dt || 1 / 60,
        T,
        render: !!opt.render,
        hover: opt.render ? null : this.hover,
        ptr: this.ptr,
        hit: (h) => hits.push(h),
      };
      sc.state._lastT = t;
      g.save();
      g.globalAlpha = fa;
      sc.draw(g, t, sc.state, env);
      if (sc.title) D.header(g, sc.kicker, sc.title, t, sc.dur);
      g.restore();
      // 사용자가 장면을 직접 조작 중이면 자막은 영상 흐름과 맞지 않으므로 숨김
      const cap = captionAt(sc, t);
      const capOn = opt.render || (this.cc && !opt.noCaption && !sc.state.ov);
      if (capOn && this.capInCanvas !== false && cap) D.caption(g, cap.text, cap.a * fa);
      if (!opt.render && this.onCaption) this.onCaption(capOn && cap ? cap.text : '');
      if (!opt.render) {
        this.hits = hits;
        this.hover = this.hitTest(this.ptr.x, this.ptr.y);
      }
    }

    /* ---------- 상호작용 ---------- */
    hitTest(x, y) {
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const h = this.hits[i];
        if (h.w != null) { if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; }
        else if (U.dist(x, y, h.x, h.y) <= h.r) return h;
      }
      return null;
    }
    toStage(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * D.W, y: ((e.clientY - r.top) / r.height) * D.H };
    }
    bindPointer() {
      const cv = this.canvas;
      cv.addEventListener('pointermove', (e) => {
        const p = this.toStage(e);
        if (this.drag) {
          const sc = scenes[this.cur];
          const S = sc.state;
          const dx = p.x - this.ptr.x, dy = p.y - this.ptr.y;
          if (Math.abs(p.x - this.drag.sx) + Math.abs(p.y - this.drag.sy) > 5) this.drag.moved = true;
          if (this.drag.hit.drag != null && this.drag.moved) {
            S.off = S.off || {};
            const o = S.off[this.drag.hit.drag] || { x: 0, y: 0 };
            S.off[this.drag.hit.drag] = { x: o.x + dx, y: o.y + dy };
          }
        }
        this.ptr = p;
        this.hover = this.hitTest(p.x, p.y);
        cv.style.cursor = this.drag && this.drag.moved ? 'grabbing' : this.hover ? (this.hover.drag != null && !this.hover.pair && !this.hover.cell ? 'grab' : 'pointer') : 'default';
      });
      cv.addEventListener('pointerdown', (e) => {
        const p = this.toStage(e);
        this.ptr = p;
        const hit = this.hitTest(p.x, p.y);
        this.drag = { hit: hit || {}, sx: p.x, sy: p.y, moved: false, empty: !hit };
        cv.setPointerCapture(e.pointerId);
      });
      const up = (e) => {
        if (!this.drag) return;
        const d = this.drag;
        this.drag = null;
        try { cv.releasePointerCapture(e.pointerId); } catch (err) { /* 이미 해제됨 */ }
        if (d.moved) return;
        const sc = scenes[this.cur];
        let changed = false;
        if (d.empty) {
          // 빈 곳을 누르면 보통 영상처럼 재생/일시정지
          if (sc.clickEmpty && sc.clickEmpty(sc.state, this.ptr, this)) return;
          this.toggle();
          return;
        } else if (sc.click) changed = sc.click(sc.state, d.hit, this);
        if (changed) { this.playing = false; this.stopSpeech(); this.emit('pause'); }
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', () => { this.drag = null; });
      cv.addEventListener('pointerleave', () => { if (!this.drag) { this.ptr = { x: -999, y: -999 }; this.hover = null; } });
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(320, Math.round(r.width * dpr));
      if (this.canvas.width !== w) {
        this.canvas.width = w;
        this.canvas.height = Math.round((w * D.H) / D.W);
      }
    }
  }

  /* ---------- 글꼴 미리 불러오기 ---------- */
  function collectTexts() {
    const texts = new Set();
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 180;
    const g = cv.getContext('2d');
    const orig = g.fillText.bind(g);
    g.fillText = (s, x, y) => { texts.add(String(s)); return orig(s, x, y); };
    const env = { dt: 1 / 30, render: true, hover: null, ptr: { x: -999, y: -999 }, hit: () => {} };
    scenes.forEach((s) => {
      (s.captions || []).forEach((c) => texts.add(strip(c[1])));
      texts.add(s.title || ''); texts.add(s.kicker || '');
      for (let t = 0; t <= s.dur; t += 0.25) { g.setTransform(0.25, 0, 0, 0.25, 0, 0); s.draw(g, t, s.state, env); }
    });
    return [...texts].join(' ');
  }
  async function loadFonts(text) {
    if (!document.fonts || !document.fonts.load) return;
    const jobs = [];
    ['400', '500', '600', '700'].forEach((w) => jobs.push(document.fonts.load(`${w} 24px "IBM Plex Sans KR"`, text)));
    ['400', '500', '600'].forEach((w) => jobs.push(document.fonts.load(`${w} 24px "IBM Plex Mono"`, text)));
    jobs.push(document.fonts.load('400 24px "Do Hyeon"', text));
    await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, 15000))]);
  }

  /* ---------- 영상 렌더링 모드 (tools/render-video.mjs가 사용) ---------- */
  if (RENDER) {
    document.documentElement.classList.add('render');
    const cv = document.getElementById('screen');
    const w = +(params.get('w') || 1920);
    cv.width = w;
    cv.height = Math.round((w * D.H) / D.W);
    const player = new Player(cv);
    window.__NA_RENDER = {
      total: TOTAL,
      chapters: scenes.map((s) => ({ id: s.id, title: s.chapter, start: s.start })),
      captions: scenes.flatMap((s) => (s.captions || []).map((c, k, arr) => ({
        start: s.start + c[0],
        end: s.start + (k + 1 < arr.length ? arr[k + 1][0] : s.dur - 0.2),
        text: c[1],
      }))),
      async ready() {
        await loadFonts(collectTexts());
        scenes.forEach((s) => (s.state = s.init()));
        return true;
      },
      draw(T, fps) { player.draw(T, 1 / (fps || 30), { render: true }); return true; },
    };
    return;
  }

  /* ---------- 일반(인터랙티브) 모드 ---------- */
  const $ = (s) => document.querySelector(s);
  const canvas = $('#screen');
  const player = new Player(canvas);
  NA.player = player;
  player.bindPointer();
  player.resize();
  new ResizeObserver(() => player.resize()).observe(canvas);

  // 자막 글꼴은 미리 받아 두기 (나머지는 쓰일 때 받아짐)
  loadFonts(scenes.map((s) => (s.captions || []).map((c) => strip(c[1])).join(' ') + s.title + s.kicker).join(' ') + ' 네트워크 분석 점과 선으로 세상의 연결을 읽는 법');

  // 첫 화면: 제목이 보이는 순간을 포스터로
  const posterT = scenes[0].start + 15.5;
  let posterMode = true;

  const btnPlay = $('#btn-play'), poster = $('#poster');
  const track = $('#track'), fill = $('#track-fill'), knob = $('#track-knob'), tip = $('#track-tip');
  const timeEl = $('#time'), chapterEl = $('#now-chapter');
  const tryit = $('#tryit'), chapters = $('#chapters');

  // 진행 막대의 장 구분선
  scenes.forEach((s) => {
    if (s.start === 0) return;
    const m = document.createElement('span');
    m.className = 'tick';
    m.style.left = (s.start / TOTAL) * 100 + '%';
    track.appendChild(m);
  });
  // 목차
  scenes.forEach((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="num">${String(i).padStart(2, '0')}</span><span class="name">${s.chapter}</span><span class="at">${fmtTime(s.start)}</span>`;
    b.onclick = () => { posterMode = false; poster.hidden = true; player.seek(s.start); player.play(); };
    li.appendChild(b);
    chapters.appendChild(li);
  });

  function renderPanel() {
    const s = scenes[player.cur];
    const head = `<div class="tryit-head"><span class="eyebrow">직접 해 보기</span><h3>${s.chapter}</h3></div>`;
    const body = s.panel ? s.panel.html : '<p>영상이 끝나면 아래 놀이터에서 직접 네트워크를 만들어 보세요.</p>';
    tryit.innerHTML = head + `<div class="tryit-body">${body}</div><p class="tryit-note">조작하면 영상이 잠시 멈춰요. ▶ 재생을 누르면 영상 흐름으로 돌아갑니다.</p>`;
    if (s.panel && s.panel.bind) s.panel.bind(tryit, s.state, player);
    if (s.state.syncPanel) s.state.syncPanel();
    [...chapters.children].forEach((li, i) => li.classList.toggle('on', i === player.cur));
    chapterEl.textContent = s.chapter;
  }
  function syncControls() {
    btnPlay.classList.toggle('is-playing', player.playing);
    btnPlay.setAttribute('aria-label', player.playing ? '일시정지' : '재생');
    btnPlay.title = player.playing ? '일시정지 (스페이스)' : '재생 (스페이스)';
  }
  player.on((type) => {
    if (type === 'scene') renderPanel();
    if (type === 'play' || type === 'pause' || type === 'seek') syncControls();
    if (type === 'play') { posterMode = false; poster.hidden = true; }
  });

  // 좁은 화면: 캔버스 속 자막은 너무 작아지므로 영상 아래에 글자로 보여 줌
  const ccText = $('#cc-text');
  const narrow = window.matchMedia('(max-width: 700px)');
  const syncNarrow = () => { player.capInCanvas = !narrow.matches; };
  syncNarrow();
  if (narrow.addEventListener) narrow.addEventListener('change', syncNarrow);
  let lastCap = null;
  player.onCaption = (text) => {
    if (text === lastCap) return;
    lastCap = text;
    ccText.innerHTML = text ? text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') : '&nbsp;';
  };

  btnPlay.onclick = () => player.toggle();
  poster.onclick = () => { posterMode = false; poster.hidden = true; player.seek(0); player.play(); };
  $('#btn-prev').onclick = () => player.chapterJump(-1);
  $('#btn-next').onclick = () => player.chapterJump(1);
  $('#btn-back').onclick = () => player.seek(player.T - 10);

  const ccBtn = $('#btn-cc');
  ccBtn.onclick = () => {
    player.cc = !player.cc;
    ccBtn.setAttribute('aria-pressed', player.cc);
  };
  $('#speed').onchange = (e) => { player.speed = +e.target.value; };

  // 음성 해설
  const ttsBtn = $('#btn-tts');
  if (!('speechSynthesis' in window)) ttsBtn.hidden = true;
  const pickVoice = () => {
    const vs = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    player.tts.voice = vs.find((v) => /^ko/i.test(v.lang) && /google|yuna|sun-hi|heami|female/i.test(v.name)) || vs.find((v) => /^ko/i.test(v.lang)) || null;
  };
  if (window.speechSynthesis) { pickVoice(); window.speechSynthesis.onvoiceschanged = pickVoice; }
  ttsBtn.onclick = () => {
    pickVoice();
    player.tts.on = !player.tts.on;
    ttsBtn.setAttribute('aria-pressed', player.tts.on);
    if (!player.tts.on) { window.speechSynthesis.cancel(); player.tts.busy = false; }
    player.tts.key = null;
    const note = $('#tts-note');
    note.hidden = !(player.tts.on && !player.tts.voice);
  };

  // 전체 화면
  const stageWrap = $('#player');
  $('#btn-full').onclick = () => {
    const el = stageWrap;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  // 진행 막대 드래그
  let scrubbing = false;
  const scrubTo = (e) => {
    const r = track.getBoundingClientRect();
    const f = U.clamp((e.clientX - r.left) / r.width);
    posterMode = false; poster.hidden = true;
    player.T = f * TOTAL;
    player.stopSpeech();
  };
  track.addEventListener('pointerdown', (e) => { scrubbing = true; player.clearOverrides(); track.setPointerCapture(e.pointerId); scrubTo(e); });
  track.addEventListener('pointermove', (e) => {
    const r = track.getBoundingClientRect();
    const f = U.clamp((e.clientX - r.left) / r.width);
    const s = player.sceneAt(f * TOTAL);
    tip.textContent = `${fmtTime(f * TOTAL)} · ${s.chapter}`;
    tip.style.left = f * 100 + '%';
    if (scrubbing) scrubTo(e);
  });
  track.addEventListener('pointerup', () => { scrubbing = false; });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { player.seek(player.T + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { player.seek(player.T - 5); e.preventDefault(); }
  });

  // 키보드
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag)) return;
    if (tag === 'button' && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.target === track && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    const inView = stageWrap.getBoundingClientRect().bottom > 0 && stageWrap.getBoundingClientRect().top < innerHeight;
    if (!inView) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); posterMode = false; poster.hidden = true; player.toggle(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? player.chapterJump(1) : player.seek(player.T + 5); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? player.chapterJump(-1) : player.seek(player.T - 5); }
    else if (e.key === 'c') ccBtn.click();
    else if (e.key === 'f') $('#btn-full').click();
  });

  // 처음 장면 설정
  player.cur = 0;
  renderPanel();
  syncControls();

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (posterMode) {
      player.draw(posterT, dt, { noCaption: true });
      player.hits = [];
    } else player.tick(dt);
    const f = player.T / TOTAL;
    fill.style.width = f * 100 + '%';
    knob.style.left = f * 100 + '%';
    track.setAttribute('aria-valuenow', Math.round(player.T));
    track.setAttribute('aria-valuetext', `${fmtTime(player.T)} / ${fmtTime(TOTAL)}`);
    timeEl.textContent = `${fmtTime(player.T)} / ${fmtTime(TOTAL)}`;
    requestAnimationFrame(loop);
  }
  track.setAttribute('aria-valuemax', Math.round(TOTAL));
  $('#total-time').textContent = fmtTime(TOTAL);
  requestAnimationFrame(loop);

  // 주소 끝에 #c-장면id 로 바로 가기 (예: #c-centrality)
  const hash = location.hash.replace('#', '');
  if (hash.startsWith('c-')) {
    const s = scenes.find((x) => 'c-' + x.id === hash);
    if (s) { posterMode = false; poster.hidden = true; player.seek(s.start); }
  }
})();
