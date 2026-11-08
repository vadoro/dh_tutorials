/* DH 튜토리얼 공통 부품: 음성 해설
 *
 * 자막을 소리 내어 읽고, 다 읽을 때까지 그 자막 끝에서 영상이 기다리게 합니다.
 * 미리 만든 음성 파일(audio/narration/clips.js)이 있으면 그 파일로, 없으면 브라우저 음성(speechSynthesis)으로 읽어요.
 *
 * 쓰는 법
 *   const narr = DH.narration({
 *     captions: [{ start: 0.5, end: 5, text: '자막' }, ...],   // 영상 전체 기준 시각(초)
 *     read: [[/UMAP/g, '유맵']],      // 이 튜토리얼에만 필요한 읽기 바꾸기 (선택)
 *     rate: () => speed,               // 지금 재생 속도 (선택, 기본 1)
 *     holdBefore: 0.05,                // 자막 끝보다 몇 초 앞에서 기다릴지 (자막이 사라지기 전에 멈추고 싶을 때 키움)
 *     clips: window.DH_CLIPS,          // 미리 만든 음성 파일 목록 (선택, 기본 window.DH_CLIPS)
 *   });
 *   // 재생 중 매 프레임
 *   T = narr.hold(T, T + dt * speed);   // 읽는 중이면 시간이 자막 끝을 넘지 않게
 *   narr.sync(T, playing);              // 자막이 바뀌면 읽기 시작
 *   // 일시정지·이동할 때
 *   narr.reset();
 *   // 단추와 안내 문구 연결
 *   DH.narration.bind(narr, buttonEl, noteEl, { onEnable() { if (!started) play(); } });
 *
 * 단추는 aria-pressed로 켜짐/꺼짐을 나타냅니다. 키보드 단축키(V)는 튜토리얼이 단추를 눌러 주면 됩니다.
 *
 * 미리 만든 음성 파일: 튜토리얼 폴더의 audio/narration/clips.js가
 *   window.DH_CLIPS = { voice: '목소리 이름', base: 'audio/narration/', clips: { 조각id: ['파일', 초] } }
 * 를 만들어요(tools/voicestudio-narration.py가 씀). 자막 하나 = 읽기 조각 하나이고, 조각 글은 읽기 바꾸기(read)를 거친 자막이에요.
 * 조각 id는 DH.narration.pieceId(글), 조각 목록은 narr.pieces() (tools/narration-pieces.cjs가 받아 적음).
 * 영어 낱말도 한국어 목소리로 한 번에 읽어요(목소리를 바꾸며 끊기지 않게). 파일이 없거나 못 읽는 조각만 브라우저 음성으로 읽어요.
 */
(function () {
  'use strict';
  var DH = (window.DH = window.DH || {});

  // 모든 튜토리얼에 공통인 읽기 바꾸기: 화면용 기호를 소리 내어 읽기 좋게
  var BASE_READ = [
    [/\*\*/g, ''],
    [/①/g, '첫째, '], [/②/g, '둘째, '], [/③/g, '셋째, '], [/④/g, '넷째, '], [/⑤/g, '다섯째, '],
    [/[‘’“”]/g, ''], [/→/g, ', '], [/…/g, ', '], [/·/g, ', '],
    [/×/g, ' 곱하기 '], [/÷/g, ' 나누기 '],
  ];
  // 우리말 뒤 괄호 속 영어 이름(노드(node) · 분포 가설(distributional hypothesis))은 소리 내어 읽지 않아요 —
  // 같은 말을 두 번 읽게 되니까요. 짧은 대문자 약어(NSMC · TF)는 읽어요. 튜토리얼의 read보다 먼저 지워요.
  var GLOSS = /\(\s*(?:\*\*)?(?![A-Z]{1,5}(?:\*\*)?\s*\))[A-Za-z][A-Za-z .'’\-]*(?:\*\*)?\s*\)/g;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  // 조각 id: 'ko|글'의 FNV-1a 32비트 (UTF-16 단위) → 'k1a2b3c4d' (미리 만든 음성 파일 이름)
  var pieceId = function (text) {
    var s = 'ko|' + text, h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'k' + ('0000000' + h.toString(16)).slice(-8);
  };

  // 미리 만든 음성 파일을 읽는 오디오 하나 (Safari처럼 사용자가 누를 때만 소리를 허락하는 브라우저 때문에, 단추를 누를 때 한 번 풀어 둠)
  var AUD = null, SILENT = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  var audio = function () { if (!AUD && typeof window.Audio === 'function') { AUD = new window.Audio(); AUD.preload = 'auto'; } return AUD; };
  // 잠금 풀기용 무음(0.01초)은 멈추지 않고 끝나게 둠 (곧바로 멈추면 Safari가 풀린 것으로 보지 않을 수 있어요)
  var audioStop = function () { if (AUD) { AUD.onended = AUD.onerror = null; if (AUD.src === SILENT) return; try { AUD.pause(); } catch (e) { /* 이미 멈춤 */ } } };

  DH.narration = function (opts) {
    opts = opts || {};
    var caps = opts.captions || [];
    var read = (opts.read || []).concat(BASE_READ);
    var rate = opts.rate || function () { return 1; };
    var holdBefore = opts.holdBefore == null ? 0.05 : opts.holdBefore;
    var synth = window.speechSynthesis;
    var tts = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
    var C = opts.clips || window.DH_CLIPS;
    C = C && C.clips ? C : null;
    var CLIPS = C ? C.clips : {}, BASE = C ? (C.base || '') : '';
    var hasClips = Object.keys(CLIPS).length > 0 && typeof window.Audio === 'function';
    var n = {
      supported: tts || hasClips,
      on: false, busy: false, idx: -1, voice: null, u: null, since: 0, len: 0, limit: 0, token: 0,
    };
    DH.narration.last = n;

    n.line = function (text) {
      return read.reduce(function (s, r) { return s.replace(r[0], r[1]); }, String(text).replace(GLOSS, '')).replace(/\s{2,}/g, ' ').trim();
    };
    var clipOf = function (line) { return hasClips ? CLIPS[pieceId(line)] || null : null; };
    // 모든 자막의 읽기 조각 (겹치지 않게, 처음 나온 차례대로) → 음성 파일을 미리 만들 목록
    n.pieces = function () {
      var seen = {}, out = [];
      caps.forEach(function (c, ci) {
        var t = n.line(c.text), id = pieceId(t);
        if (t && !seen[id]) { seen[id] = 1; out.push({ id: id, text: t, cap: ci }); }
      });
      return out;
    };
    n.pickVoice = function () {
      if (!tts) return null;
      var vs = synth.getVoices() || [];
      n.voice = vs.filter(function (v) { return /^ko/i.test(v.lang) && /google|yuna|sun-?hi|heami|injoon|female/i.test(v.name); })[0] ||
        vs.filter(function (v) { return /^ko/i.test(v.lang); })[0] || null;
      return n.voice;
    };
    n.reset = function () {
      n.token++;
      if (tts && n.on) synth.cancel();
      if (n.on) audioStop();
      n.busy = false; n.idx = -1;
    };
    n.set = function (on) {
      n.on = !!on && n.supported;
      if (n.on) {
        n.pickVoice(); n.idx = -1;
        // 단추를 누른 지금(사용자의 동작 안에서) 오디오를 한 번 풀어 둠 → 나중에 영상이 흘러가며 파일을 읽을 수 있음
        if (hasClips && audio()) { var a = AUD; a.src = SILENT; var pr = a.play(); if (pr && pr.catch) pr.catch(function () { /* 다음에 다시 시도 */ }); }
      } else { n.token++; if (tts) synth.cancel(); audioStop(); n.busy = false; n.idx = -1; }
      return n.on;
    };
    // 브라우저 음성으로 읽기
    var speakTTS = function (line, token) {
      if (!tts) { if (n.token === token) n.busy = false; return; }
      var u = new window.SpeechSynthesisUtterance(line);
      u.lang = 'ko-KR';
      if (n.voice) u.voice = n.voice;
      u.rate = clamp(1.05 * (rate() || 1), 0.6, 2);
      u.onend = u.onerror = function () { if (n.token === token) n.busy = false; };
      n.u = u;
      synth.speak(u);
    };
    n.speak = function (text) {
      if (tts) synth.cancel();
      audioStop();
      var token = ++n.token, line = n.line(text), c = clipOf(line), a = c && audio();
      if (!line) { n.busy = false; return; }
      n.busy = true; n.since = performance.now(); n.len = String(text).length;
      n.limit = c ? (c[1] || 3) / clamp(rate() || 1, 0.5, 2) + 6 : 0;
      if (!a) { speakTTS(line, token); return; }
      // 파일을 못 읽으면 그 자막만 브라우저 음성으로
      var done = false, fail = function () { if (done || n.token !== token) return; done = true; speakTTS(line, token); };
      a.onended = function () { if (done || n.token !== token) return; done = true; n.busy = false; };
      a.onerror = fail;
      a.src = BASE + c[0];
      a.playbackRate = clamp(rate() || 1, 0.5, 2);
      var pr = a.play();
      if (pr && pr.catch) pr.catch(fail);
    };
    // 재생 중 다음 시각을 정할 때: 아직 읽고 있으면 지금 자막의 끝을 넘지 않게
    n.hold = function (T, next) {
      if (!n.on || !n.busy) return next;
      // 끝났다는 신호(onend)가 오지 않는 브라우저를 위한 시간 제한
      if (performance.now() - n.since > Math.max(n.len * 0.35 + 6, n.limit) * 1000) { n.busy = false; return next; }
      var c = caps[n.idx];
      if (!c) return next;
      return Math.min(next, Math.max(T, c.end - holdBefore));
    };
    // 지금 시각의 자막이 바뀌었으면 읽기 시작
    n.sync = function (T, playing) {
      if (!n.on || !playing) return;
      var i = -1;
      for (var k = 0; k < caps.length; k++) if (T >= caps[k].start && T < caps[k].end) { i = k; break; }
      if (i >= 0 && i !== n.idx) { n.idx = i; n.speak(caps[i].text); }
    };
    n.status = function () {
      var all = n.pieces(), have = all.filter(function (p) { return CLIPS[p.id]; }).length;
      var browser = n.voice ? n.voice.name : '기본 음성';
      if (hasClips && have) {
        return '음성 해설 켜짐 · ' + (C.voice || '미리 만든 음성') + (have < all.length ? ' (없는 자막은 ' + browser + ')' : '') +
          '. 음성이 자막을 다 읽을 때까지 영상이 잠깐씩 기다려요.';
      }
      return n.voice
        ? '음성 해설 켜짐 · ' + n.voice.name + '. 음성이 자막을 다 읽을 때까지 영상이 잠깐씩 기다려요.'
        : '음성 해설 켜짐 · 이 브라우저에는 한국어 음성이 없어 기본 음성으로 읽어요. 운영체제 설정에서 한국어 음성을 추가하면 더 자연스러워요.';
    };
    if (tts) {
      n.pickVoice();
      if (synth.addEventListener) synth.addEventListener('voiceschanged', n.pickVoice);
      else synth.onvoiceschanged = n.pickVoice;
    }
    return n;
  };

  DH.narration.pieceId = pieceId;
  // 단추(aria-pressed)와 안내 문구를 연결. 음성을 쓸 수 없는 브라우저에서는 단추를 숨김 (미리 만든 음성 파일이 있으면 보임)
  DH.narration.bind = function (n, btn, note, hooks) {
    hooks = hooks || {};
    if (!btn) return;
    if (!n.supported) { btn.hidden = true; return; }
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
      var on = n.set(!n.on);
      btn.setAttribute('aria-pressed', String(on));
      if (note) { note.textContent = on ? n.status() : ''; note.hidden = !on; }
      if (on && hooks.onEnable) hooks.onEnable();
      if (!on && hooks.onDisable) hooks.onDisable();
    });
  };
})();
