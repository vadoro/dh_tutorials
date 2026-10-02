/* DH 튜토리얼 공통 부품: 음성 해설
 *
 * 브라우저에 들어 있는 음성(speechSynthesis)으로 자막을 읽고,
 * 다 읽을 때까지 그 자막 끝에서 영상이 기다리게 합니다.
 *
 * 쓰는 법
 *   const narr = DH.narration({
 *     captions: [{ start: 0.5, end: 5, text: '자막' }, ...],   // 영상 전체 기준 시각(초)
 *     read: [[/UMAP/g, '유맵']],      // 이 튜토리얼에만 필요한 읽기 바꾸기 (선택)
 *     rate: () => speed,               // 지금 재생 속도 (선택, 기본 1)
 *     holdBefore: 0.05,                // 자막 끝보다 몇 초 앞에서 기다릴지 (자막이 사라지기 전에 멈추고 싶을 때 키움)
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
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  DH.narration = function (opts) {
    opts = opts || {};
    var caps = opts.captions || [];
    var read = (opts.read || []).concat(BASE_READ);
    var rate = opts.rate || function () { return 1; };
    var holdBefore = opts.holdBefore == null ? 0.05 : opts.holdBefore;
    var synth = window.speechSynthesis;
    var n = {
      supported: !!synth && typeof window.SpeechSynthesisUtterance === 'function',
      on: false, busy: false, idx: -1, voice: null, u: null, since: 0, len: 0,
    };

    n.line = function (text) {
      return read.reduce(function (s, r) { return s.replace(r[0], r[1]); }, String(text)).replace(/\s{2,}/g, ' ').trim();
    };
    n.pickVoice = function () {
      if (!n.supported) return null;
      var vs = synth.getVoices() || [];
      n.voice = vs.filter(function (v) { return /^ko/i.test(v.lang) && /google|yuna|sun-?hi|heami|injoon|female/i.test(v.name); })[0] ||
        vs.filter(function (v) { return /^ko/i.test(v.lang); })[0] || null;
      return n.voice;
    };
    n.reset = function () {
      if (n.supported && n.on) synth.cancel();
      n.busy = false; n.idx = -1;
    };
    n.set = function (on) {
      n.on = !!on && n.supported;
      if (n.on) { n.pickVoice(); n.idx = -1; }
      else { if (n.supported) synth.cancel(); n.busy = false; n.idx = -1; }
      return n.on;
    };
    n.speak = function (text) {
      synth.cancel();
      var u = new window.SpeechSynthesisUtterance(n.line(text));
      u.lang = 'ko-KR';
      if (n.voice) u.voice = n.voice;
      u.rate = clamp(1.05 * (rate() || 1), 0.6, 2);
      u.onend = u.onerror = function () { if (n.u === u) n.busy = false; };
      n.u = u; n.busy = true; n.since = performance.now(); n.len = String(text).length;
      synth.speak(u);
    };
    // 재생 중 다음 시각을 정할 때: 아직 읽고 있으면 지금 자막의 끝을 넘지 않게
    n.hold = function (T, next) {
      if (!n.on || !n.busy) return next;
      // 끝났다는 신호(onend)가 오지 않는 브라우저를 위한 시간 제한
      if (performance.now() - n.since > (n.len * 0.35 + 6) * 1000) { n.busy = false; return next; }
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
      return n.voice
        ? '음성 해설 켜짐 · ' + n.voice.name + '. 음성이 자막을 다 읽을 때까지 영상이 잠깐씩 기다려요.'
        : '음성 해설 켜짐 · 이 브라우저에는 한국어 음성이 없어 기본 음성으로 읽어요. 운영체제 설정에서 한국어 음성을 추가하면 더 자연스러워요.';
    };
    if (n.supported) {
      n.pickVoice();
      if (synth.addEventListener) synth.addEventListener('voiceschanged', n.pickVoice);
      else synth.onvoiceschanged = n.pickVoice;
    }
    return n;
  };

  // 단추(aria-pressed)와 안내 문구를 연결. 음성을 쓸 수 없는 브라우저에서는 단추를 숨김
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
