/* 감정분석 튜토리얼 — 플레이어, 직접 해 보기, 놀이터, 퀴즈, 영상 추출
 * 계산은 sentiment.js(SA), 그림은 scenes.js(SV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const SA = window.SA, SV = window.SV, S = SV.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = SV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sf = (x, k = 1) => SA.fmt(x, k);
const cv = $('cv'), ctx = cv.getContext('2d');

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = SV.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [400, F.FM], [500, F.FM], [600, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => SV.collectText(res)).then(loadFonts);
  window.DH_EXPORT = {
    title: '글에 담긴 마음 — 감정분석의 기본 원리와 방법',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { SV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
  };
  return;
}

/* =========================================================
   3. 플레이어
   ========================================================= */
let T = 0, playing = false, started = false, speed = 1, dirty = true, lastTs = 0, ccOn = true;
const playBtn = $('playBtn'), bigPlay = $('bigPlay'), seekEl = $('seek'), timeLbl = $('timeLbl'), capBox = $('cap'), capText = $('capText');
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/></svg>',
};
let lastBtn = '', lastCap = null, lastChap = -1;
function syncUI() {
  // 단추 아이콘은 상태가 바뀔 때만 교체 (매 프레임 바꾸면 누르는 사이에 클릭이 사라짐)
  const btn = playing ? 'pause' : T >= END - 0.01 ? 'replay' : 'play';
  if (btn !== lastBtn) { lastBtn = btn; playBtn.innerHTML = ICON[btn]; playBtn.setAttribute('aria-label', btn === 'pause' ? '일시정지 (스페이스)' : btn === 'replay' ? '처음부터 다시 (스페이스)' : '재생 (스페이스)'); }
  seekEl.value = T;
  timeLbl.textContent = `${fmtT(T)} / ${fmtT(END)}`;
  const cap = started ? SV.captionAt(T) : '재생 단추를 누르면 시작해요. 아무 때나 멈추고 화면을 눌러 보세요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = esc(cap).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') || '&nbsp;'; }
  const ci = SV.chapterAt(T);
  if (ci !== lastChap) { lastChap = ci; document.querySelectorAll('.chap').forEach((b, i) => b.setAttribute('aria-current', String(i === ci))); buildLab(); }
}
function play() {
  if (T >= END - 0.01) T = 0;
  playing = true; started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true;
}
function pause() { playing = false; NARR.reset(); syncUI(); dirty = true; }
function seek(t) { T = clamp(t, 0, END); started = true; bigPlay.hidden = true; NARR.reset(); syncUI(); dirty = true; }
function loop(ts) {
  const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
  if (playing) {
    T = NARR.hold(T, T + dt * speed);                    // 음성 해설이 읽는 중이면 자막 끝에서 기다림
    if (T >= END) { T = END; playing = false; NARR.reset(); }
    syncUI(); NARR.sync(T, playing); dirty = true;
  }
  if (dirty) { dirty = false; SV.render(ctx, started ? T : POSTER); }
  requestAnimationFrame(loop);
}
function resize() {
  const r = $('screen').getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); dirty = true;
}
// '직접 해 보기'로 상태를 바꾸면 영상은 멈추고 바뀐 그림을 보여 줌
function changed(rebuild) { if (playing) pause(); dirty = true; if (rebuild) buildLab(rebuild === true ? null : rebuild); }

/* =========================================================
   4. 음성 해설 — 사이트 공통 부품(../shared/narration.js)
   ========================================================= */
const NARR = (window.DH && DH.narration) ? DH.narration({
  captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
  // 이 튜토리얼의 읽기 규칙 (①, →, ×, ÷ 같은 기호는 공통 부품이 바꿈)
  read: [
    [/sentiment analysis/g, '센티먼트 애널리시스'], [/Naive Bayes/g, '나이브 베이즈'], [/VADER/g, '베이더'], [/BERT/g, '버트'],
    [/NSMC/g, '엔에스엠씨'], [/KNU/g, '케이엔유'], [/~/g, ''], [/ − /g, ' 빼기 '], [/−(\d)/g, '마이너스 $1'], [/\+(\d)/g, '플러스 $1'], [/\s*=\s*/g, ', '],
  ],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   5. 점수를 HTML로 보여 주기
   ========================================================= */
const NOTE = { neg: '부정', boost: '강조', contrast: '대조' };
function tokHTML(res) {
  return `<div class="toks">${res.words.map(w => {
    const cls = w.key ? (w.score > 1e-9 ? ' on p' : w.score < -1e-9 ? ' on n' : ' on') : '';
    const notes = w.notes.map(n => `${NOTE[n.kind]} ×${n.x === -1 ? '(−1)' : n.x}`).join(' ');
    return `<span class="tok${cls}"><span class="s">${w.key ? sf(w.score) : '0'}</span><span class="w">${esc(w.raw)}</span>${notes ? `<span class="r">${notes}</span>` : ''}</span>`;
  }).join('')}</div>`;
}
const pill = lab => `<span class="pill ${lab}">${SA.LABEL_KO[lab]}</span>`;
const verdictHTML = total => `<span class="verdict">합 ${sf(total)} ${pill(SA.label(total))}</span>`;
function nbHTML(nb, text) {
  const p = nb.predict(text);
  const chips = p.parts.map(o => `<span class="tok on ${o.x > 0 ? 'p' : o.x < 0 ? 'n' : ''}"><span class="s">${sf(o.x, 2)}</span><span class="w">${esc(o.w)}</span></span>`).join('');
  return `<div class="toks">${chips || '<span class="note">배운 낱말이 없어요.</span>'}</div>
    ${p.unknown.length ? `<p class="note">배운 적 없는 낱말(빼고 셈): ${p.unknown.map(esc).join(', ')}</p>` : ''}
    <p><span class="verdict">합 ${sf(p.logit, 2)} → 긍정일 확률 ${(p.prob * 100).toFixed(0)}% ${pill(p.label)}</span></p>
    <div class="prob" aria-hidden="true"><i style="left:${(p.prob * 100).toFixed(1)}%"></i></div>`;
}
// "꿀잼 +2, 노잼 -2" → { 꿀잼: 2, 노잼: -2 }
function parseExtra(s) {
  const out = {}; let n = 0;
  String(s).split(/[,\n]/).forEach(part => {
    const m = part.trim().match(/^([가-힣A-Za-z0-9]+)\s*[:=]?\s*([+\-−]?\d+(?:\.\d+)?)$/);
    if (m) { out[m[1]] = parseFloat(m[2].replace('−', '-')); n++; }
  });
  return n ? out : null;
}

/* =========================================================
   6. 장면별 '직접 해 보기' — 장이 바뀌거나 직접 고를 때만 다시 만듦
   ========================================================= */
const ruleBoxes = () => `<div class="row"><span class="note">규칙</span>${[['neg', '부정어'], ['boost', '강조어'], ['contrast', '대조']].map(([k, t]) => `<label class="chk"><input type="checkbox" data-rule="${k}"${S.rules[k] ? ' checked' : ''}> ${t}</label>`).join('')}</div>`;
const LABS = {
  intro: () => {
    const i = S.card == null ? 0 : S.card, [kind, text] = SV.EX.intro[i], r = SA.score(text, S.rules, S.extra);
    return `<h2>직접 해 보기</h2><h3>점수가 어떻게 나왔을까?</h3>
      <div class="chips" role="group" aria-label="예문 고르기">${SV.EX.intro.map(([k, t], j) => `<button type="button" class="chip" data-card="${j}" aria-pressed="${j === i}">${k}</button>`).join('')}</div>
      ${tokHTML(r)}<p>${verdictHTML(r.total)}</p>
      <p class="note">색칠한 어절이 감성 사전에 있는 단어예요. 화면의 카드를 눌러도 돼요.</p>`;
  },
  what: () => `<h2>직접 해 보기</h2><h3>내 문장은 어디쯤?</h3>
    <div class="row"><input class="inp" id="labWhat" type="text" value="이 책 정말 좋았다" aria-label="문장"></div>
    <div id="labWhatOut"></div>
    <p class="note">−1~+1 값은 합 ÷ √(합² + 15)로 줄인 값이에요(VADER의 방식). 합이 커질수록 1에 가까워지지만 넘지는 않아요.</p>`,
  lexicon: () => {
    const groups = [2, 1, -1, -2].map(v => [v, Object.keys(SA.LEXICON).filter(k => SA.LEXICON[k] === v)]);
    return `<h2>직접 해 보기</h2><h3>이 튜토리얼의 감성 사전 (설명용 예시)</h3>
      ${groups.map(([v, ks]) => `<p><b class="${v > 0 ? 'okmark' : 'nomark'}" style="color:var(${v > 0 ? '--pos' : '--neg'})">${sf(v, 0)}</b> ${ks.map(k => esc(k) + '…').join(' · ')}</p>`).join('')}
      <p class="note">단어의 앞부분(어간)으로 적어 두고, 어절이 그 앞부분으로 시작하면 점수를 줘요. 실제 KNU 한국어 감성사전은 1만 4천여 개 표현에 −2~+2를 매겼어요.</p>`;
  },
  rules: () => `<h2>직접 해 보기</h2><h3>규칙을 끄고 켜 보기</h3>${ruleBoxes()}
    <div class="row"><input class="inp" id="labRuleText" type="text" value="번역은 조금 어색하지만 이야기는 정말 좋다" aria-label="시험해 볼 문장"></div>
    <div id="labRuleOut"></div>
    <p class="note">규칙을 바꾸면 영상의 점수와 아래 놀이터에도 함께 반영돼요.</p>`,
  limits: () => `<h2>직접 해 보기</h2><h3>사전에 단어 더하기</h3>
    <div class="row"><input class="inp" id="labExtra" type="text" value="${esc(extraText())}" placeholder="예: 꿀잼 +2, 눈물 0" aria-label="더할 단어와 점수"></div>
    <p class="note">‘꿀잼 +2’를 더하면 첫 번째 문장이 긍정이 되고, ‘눈물 0’으로 고치면 두 번째 문장이 중립이 돼요. 사전을 분야에 맞게 고치는 일이 곧 사람이 하는 ‘학습’이에요.</p>`,
  learn: () => {
    const nb = SA.NB, w = S.word && nb.index[S.word] != null ? S.word : '눈물', o = nb.weights.find(x => x.w === w);
    const list = nb.weights.slice().sort((a, b) => b.x - a.x);
    const pp = (o.pos + 1) / (nb.tot['+'] + nb.V), pn = (o.neg + 1) / (nb.tot['-'] + nb.V);
    return `<h2>직접 해 보기</h2><h3>낱말의 무게 계산</h3>
      <div class="row"><label for="labWord">낱말</label><select class="sel" id="labWord">${list.map(x => `<option${x.w === w ? ' selected' : ''}>${esc(x.w)}</option>`).join('')}</select></div>
      <dl class="kv"><dt>긍정 서평에 나온 수</dt><dd>${o.pos} (긍정 낱말 ${nb.tot['+']}개 중)</dd><dt>부정 서평에 나온 수</dt><dd>${o.neg} (부정 낱말 ${nb.tot['-']}개 중)</dd>
        <dt>P(낱말|긍정)</dt><dd>(${o.pos} + 1) ÷ (${nb.tot['+']} + ${nb.V}) = ${pp.toFixed(4)}</dd>
        <dt>P(낱말|부정)</dt><dd>(${o.neg} + 1) ÷ (${nb.tot['-']} + ${nb.V}) = ${pn.toFixed(4)}</dd>
        <dt>무게</dt><dd>ln(${pp.toFixed(4)} ÷ ${pn.toFixed(4)}) = ${sf(o.x, 2)}</dd></dl>
      <p class="note">고른 낱말은 화면 표에도 나와요. ‘없다’는 ‘지루할 틈이 없다’ 같은 긍정 서평에 나와서 오히려 긍정 쪽 무게를 받았어요. 데이터가 작으면 이런 우연도 그대로 배워요.</p>`;
  },
  eval: () => {
    const ev = SA.evaluate(SA.TEST, SA.NB, S.rules, S.extra), i = S.test == null ? 5 : S.test, r = ev.rows[i];
    return `<h2>직접 해 보기</h2><h3>시험 서평 하나씩 보기</h3>
      <div class="chips" role="group" aria-label="시험 서평 고르기">${ev.rows.map((x, j) => `<button type="button" class="chip" data-test="${j}" aria-pressed="${j === i}">${j + 1}</button>`).join('')}</div>
      <p><b>${esc(r.text)}</b> · 실제 ${pill(r.y)}</p>
      <h4>감성 사전 + 규칙 ${r.lexOk ? '<span class="okmark">맞음</span>' : '<span class="nomark">틀림</span>'}</h4>${tokHTML(r.lex)}<p>${verdictHTML(r.lex.total)}</p>
      <h4>나이브 베이즈 ${r.nbOk ? '<span class="okmark">맞음</span>' : '<span class="nomark">틀림</span>'}</h4>${nbHTML(SA.NB, r.text)}
      <h4>나이브 베이즈 혼동 행렬</h4>
      <table class="cm"><tr><th></th><th>예측 긍정</th><th>예측 부정</th></tr><tr><th>실제 긍정</th><td>${ev.cm.tp}</td><td>${ev.cm.fn}</td></tr><tr><th>실제 부정</th><td>${ev.cm.fp}</td><td>${ev.cm.tn}</td></tr></table>
      <p class="note">화면의 표에서 줄을 눌러도 돼요.</p>`;
  },
  models: () => `<h2>직접 해 보기</h2><h3>더 알아보기</h3>
    <p>언어 모델은 이 페이지에서 계산하지 않아요. 직접 써 보려면 NSMC 같은 데이터로 학습한 한국어 모델(예: KcBERT를 감정분석에 맞게 더 학습한 모델)을 Hugging Face에서 찾아 쓸 수 있어요.</p>
    <p><a href="https://github.com/e9t/nsmc" target="_blank" rel="noopener">NSMC</a> · <a href="https://github.com/park1200656/KnuSentiLex" target="_blank" rel="noopener">KNU 한국어 감성사전</a> · <a href="https://github.com/cjhutto/vaderSentiment" target="_blank" rel="noopener">VADER</a></p>
    <p class="note">어떤 모델이든 내 자료의 일부를 직접 표시해 두고, 모델의 판단과 비교해 정확도를 재 보세요. 고전 문학처럼 학습 데이터와 문체가 다른 글에서는 성능이 크게 떨어질 수 있어요.</p>`,
  arc: () => {
    const i = S.sent, story = SA.STORY;
    return `<h2>직접 해 보기</h2><h3>창 크기와 문장 살펴보기</h3>
      <div class="row"><label for="labWin">이동 평균</label><input type="range" id="labWin" min="1" max="7" step="2" value="${S.win}"><output id="labWinOut">문장 ${S.win}개씩</output></div>
      <div class="row"><label for="labSent">문장</label><select class="sel" id="labSent"><option value="">고르기</option>${story.map((s, j) => `<option value="${j}"${j === i ? ' selected' : ''}>${j + 1}. ${esc(s.slice(0, 22))}${s.length > 22 ? '…' : ''}</option>`).join('')}</select></div>
      ${i != null ? (() => { const r = SA.score(story[i], S.rules, S.extra); return tokHTML(r) + `<p>${verdictHTML(r.total)}</p>`; })() : '<p class="note">화면의 막대를 눌러도 그 문장의 점수를 볼 수 있어요.</p>'}
      <p class="note">창을 넓히면 큰 흐름만 남고, 1로 하면 문장 점수 그대로예요.</p>`;
  },
  outro: () => `<h2>직접 해 보기</h2><h3>내 글로 해 보기</h3>
    <p>아래 <a href="#playground">놀이터</a>에서 문장의 점수를 매기고, 학습 데이터를 바꿔 보고, 내 글의 감정 곡선을 그려 보세요. 같은 계산을 하는 파이썬 예제는 <code>sentiment-analysis/examples/sentiment_basics.py</code>에 있어요.</p>`,
};
const lab = $('lab');
function buildLab(focusId) {
  const id = CHAPTERS[lastChap < 0 ? 0 : lastChap].id;
  lab.innerHTML = LABS[id]();
  if (id === 'what') labWhat();
  if (id === 'rules') labRule();
  if (focusId) { const el = $(focusId) || lab.querySelector(focusId); if (el) el.focus(); }
}
function labWhat() {
  const t = $('labWhat').value, r = SA.score(t, S.rules, S.extra), v = r.total / Math.sqrt(r.total * r.total + 15);
  $('labWhatOut').innerHTML = `${tokHTML(r)}<dl class="kv"><dt>합</dt><dd>${sf(r.total)}</dd><dt>−1~+1로</dt><dd>${sf(v, 2)}</dd><dt>판정</dt><dd>${pill(r.label)}</dd></dl>`;
}
function labRule() { const r = SA.score($('labRuleText').value, S.rules, S.extra); $('labRuleOut').innerHTML = tokHTML(r) + `<p>${verdictHTML(r.total)}</p>`; }
const extraText = () => S.extra ? Object.keys(S.extra).map(k => `${k} ${S.extra[k] >= 0 ? '+' : ''}${S.extra[k]}`).join(', ') : '';
function setRule(k, v) {
  S.rules = Object.assign({}, S.rules, { [k]: v });
  ['neg', 'boost', 'contrast'].forEach(r => { const id = { neg: 'rNeg', boost: 'rBoost', contrast: 'rContrast' }[r]; $(id).checked = S.rules[r]; });
  lab.querySelectorAll('[data-rule]').forEach(b => { b.checked = S.rules[b.dataset.rule]; });
  if ($('labRuleText')) labRule();
  pgAll(); changed(false);
}
function setExtra(s, from) {
  S.extra = parseExtra(s);
  if (from !== 'pg') $('pgExtra').value = extraText();
  pgAll(); changed(false);
}
lab.addEventListener('click', e => {
  const c = e.target.closest('[data-card]'), t = e.target.closest('[data-test]');
  if (c) { S.card = +c.dataset.card; changed(`[data-card="${S.card}"]`); }
  if (t) { S.test = +t.dataset.test; changed(`[data-test="${S.test}"]`); }
});
lab.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.rule) setRule(t.dataset.rule, t.checked);
  else if (t.id === 'labWord') { S.word = t.value; changed('labWord'); }
  else if (t.id === 'labSent') { S.sent = t.value === '' ? null : +t.value; changed('labSent'); }
});
lab.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'labWhat') labWhat();
  else if (t.id === 'labRuleText') labRule();
  else if (t.id === 'labExtra') setExtra(t.value, 'lab');
  else if (t.id === 'labWin') { S.win = +t.value; $('labWinOut').textContent = `문장 ${S.win}개씩`; changed(false); }
});

/* =========================================================
   7. 놀이터
   ========================================================= */
const SAMPLES = ['추천하지 않는다', '정말 재미있다', '꿀잼! 하루 만에 다 읽었다', '읽는 내내 눈물이 났다', '참 잘하는 짓이다', '번역은 조금 어색하지만 이야기는 정말 따뜻하다'];
const PG = { nb: SA.NB, sel: null };
$('pgSamples').innerHTML = SAMPLES.map(s => `<button type="button" class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('');
$('pgStory').value = SA.STORY.join('\n');
const rowsText = rows => rows.map(r => `${r[0] === '+' ? '+' : '-'} ${r[1]}`).join('\n');
$('pgTrain').value = rowsText(SA.TRAIN);
$('pgTest').value = rowsText(SA.TEST);
const parseRows = s => String(s).split('\n').map(l => l.trim().match(/^([+\-−])\s*(.+)$/)).filter(Boolean).map(m => [m[1] === '+' ? '+' : '-', m[2].trim()]);

function pgScore() {
  const text = $('pgText').value, sents = SA.sentences(text);
  let total = 0;
  const parts = sents.map(s => { const r = SA.score(s, S.rules, S.extra); total += r.total; return `<div class="sent">${tokHTML(r)}${sents.length > 1 ? `<span class="note">이 문장 ${sf(r.total)}</span>` : ''}</div>`; });
  $('pgLex').innerHTML = `<h4>감성 사전 + 규칙</h4>${parts.join('') || '<p class="note">문장을 써 주세요.</p>'}<p>${verdictHTML(total)}</p>`;
  $('pgNb').innerHTML = `<h4>나이브 베이즈 <span class="note">(학습 서평 ${PG.nb.docs.length}개로 배운 무게)</span></h4>${nbHTML(PG.nb, text)}`;
}
function arcSVG(sents, k) {
  const a = SA.arc(sents, k, S.rules, S.extra), n = sents.length;
  if (!n) return '<p class="note">문장을 넣어 주세요.</p>';
  const W = 760, H = 250, L = 34, R = 10, top = 14, bot = 26, step = (W - L - R) / n;
  const m = Math.max(1, Math.ceil(Math.max(...a.scores.map(Math.abs), ...a.smooth.map(Math.abs))));
  const y = v => top + (H - top - bot) / 2 * (1 - v / m), x = i => L + (i + 0.5) * step, bw = Math.min(34, step * 0.62);
  const tick = m <= 4 ? 1 : 2;
  let g = '';
  for (let v = -m; v <= m; v += tick) g += `<line class="${v === 0 ? 'zero' : 'grid'}" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v > 0 ? '+' : ''}${v}</text>`;
  sents.forEach((s, i) => {
    const v = a.scores[i], y0 = y(Math.max(0, v)), h = Math.max(2, Math.abs(y(v) - y(0)));
    g += `<g class="b" tabindex="0" data-i="${i}" role="img" aria-label="${i + 1}번 문장 ${sf(v)}: ${esc(s)}"><title>${i + 1}. ${esc(s)} (${sf(v)})</title><rect class="hit" x="${x(i) - step / 2}" y="${top}" width="${step}" height="${H - top - bot}"/><rect class="${v > 1e-9 ? 'p' : v < -1e-9 ? 'n' : 'z'}" x="${x(i) - bw / 2}" y="${v < 0 ? y(0) : y0}" width="${bw}" height="${h}" rx="3"${PG.sel === i ? ' stroke="currentColor" stroke-width="2"' : ''}/></g>`;
    if (n <= 24 || i % 5 === 0) g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${i + 1}</text>`;
  });
  const d = a.smooth.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  g += `<path class="ma" d="${d}"/>` + a.smooth.map((v, i) => `<circle class="dot" cx="${x(i)}" cy="${y(v)}" r="3.5"/>`).join('');
  const hi = a.scores.indexOf(Math.max(...a.scores)), lo = a.scores.indexOf(Math.min(...a.scores));
  const sel = PG.sel != null && PG.sel < n ? (() => { const r = SA.score(sents[PG.sel], S.rules, S.extra); return `<div class="box" style="margin-top:8px"><b>${PG.sel + 1}.</b> ${tokHTML(r)}${verdictHTML(r.total)}</div>`; })() : '';
  return `<svg class="arc" viewBox="0 0 ${W} ${H}" role="group" aria-label="문장별 감정 점수와 이동 평균">${g}</svg>
    <div class="legend"><span><i style="background:var(--pos)"></i>긍정 문장</span><span><i style="background:var(--neg)"></i>부정 문장</span><span><i style="background:var(--accent);height:4px;vertical-align:3px"></i>이동 평균</span><span>막대를 누르면 그 문장의 점수를 보여 줘요</span></div>
    <p class="note">가장 높은 문장: ${hi + 1}번 (${sf(a.scores[hi])}) · 가장 낮은 문장: ${lo + 1}번 (${sf(a.scores[lo])})</p>${sel}`;
}
function pgArc() { $('pgArc').innerHTML = arcSVG(SA.sentences($('pgStory').value), +$('pgWin').value); }
function pgLearn() {
  const train = parseRows($('pgTrain').value), test = parseRows($('pgTest').value);
  PG.nb = SA.trainNB(train);
  const nb = PG.nb, n = { '+': train.filter(r => r[0] === '+').length, '-': train.filter(r => r[0] === '-').length };
  const warn = !n['+'] || !n['-'] ? '<p class="nomark">긍정과 부정 서평이 모두 있어야 제대로 배울 수 있어요.</p>' : '';
  if (test.length) {
    const ev = SA.evaluate(test, nb, S.rules, S.extra);
    $('pgEval').innerHTML = `${warn}<p><b>정확도</b> · 감성 사전 ${ev.lexAcc}/${ev.n} = ${(ev.lexAcc / ev.n * 100).toFixed(1)}% · 나이브 베이즈 ${ev.nbAcc}/${ev.n} = ${(ev.nbAcc / ev.n * 100).toFixed(1)}%</p>
      <table class="tw"><thead><tr><th>서평</th><th>실제</th><th>사전</th><th>나이브 베이즈</th></tr></thead><tbody>${ev.rows.map(r =>
        `<tr><td>${esc(r.text)}</td><td>${SA.LABEL_KO[r.y]}</td><td class="num">${sf(r.lex.total)} ${r.lexOk ? '<span class="okmark">✓</span>' : '<span class="nomark">✗</span>'}</td><td class="num">${(r.nb.prob * 100).toFixed(0)}% ${r.nbOk ? '<span class="okmark">✓</span>' : '<span class="nomark">✗</span>'}</td></tr>`).join('')}</tbody></table>
      <table class="cm" aria-label="나이브 베이즈 혼동 행렬"><tr><th>나이브 베이즈</th><th>예측 긍정</th><th>예측 부정</th></tr><tr><th>실제 긍정</th><td>${ev.cm.tp}</td><td>${ev.cm.fn}</td></tr><tr><th>실제 부정</th><td>${ev.cm.fp}</td><td>${ev.cm.tn}</td></tr></table>
      <p class="note">사전 방법의 ‘중립’(합 0)은 틀린 것으로 세요.</p>`;
  } else $('pgEval').innerHTML = warn + '<p class="note">시험 서평을 한 줄 이상 넣어 주세요.</p>';
  const ws = nb.weights.slice().sort((a, b) => b.x - a.x), max = Math.max(0.01, ...ws.map(o => Math.abs(o.x)));
  const row = o => `<div><span>${esc(o.w)}</span><span class="track"><i style="${o.x >= 0 ? `left:50%;width:${(o.x / max * 50).toFixed(1)}%;background:var(--pos)` : `right:50%;width:${(-o.x / max * 50).toFixed(1)}%;background:var(--neg)`}"></i></span><span class="x">${sf(o.x, 2)}</span></div>`;
  $('pgWeights').innerHTML = `<p class="note">학습 서평 ${nb.docs.length}개(긍정 ${n['+']} · 부정 ${n['-']}) · 낱말 ${nb.V}개. 무게 = ln P(낱말|긍정) − ln P(낱말|부정), 라플라스 스무딩 α = 1</p>
    <div class="wlist"><div style="grid-column:1/-1;display:block"><b style="color:var(--pos)">긍정 쪽</b></div>${ws.filter(o => o.x > 0).slice(0, 10).map(row).join('')}
    <div style="grid-column:1/-1;display:block"><b style="color:var(--neg)">부정 쪽</b></div>${ws.filter(o => o.x < 0).reverse().slice(0, 10).map(row).join('')}</div>`;
}
const py = s => JSON.stringify(s);
function pgCode() {
  const train = parseRows($('pgTrain').value), test = parseRows($('pgTest').value), story = SA.sentences($('pgStory').value);
  const lexLine = S.extra ? `lexicon = {**LEXICON, ${Object.keys(S.extra).map(k => `${py(k)}: ${S.extra[k]}`).join(', ')}}   # 내가 더한 단어` : 'lexicon = LEXICON';
  const docs = rows => rows.map(([y, t]) => `    (${py(y === '+' ? 'pos' : 'neg')}, ${py(SA.lemmas(t).join(' '))}),   # ${t}`).join('\n');
  $('pgCode').textContent = `# 튜토리얼의 examples 폴더에서 실행하세요 (pip install scikit-learn)
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sentiment_basics import LEXICON, score, moving_average

# 1) 감성 사전 + 규칙
${lexLine}
rules = dict(neg=${S.rules.neg ? 'True' : 'False'}, boost=${S.rules.boost ? 'True' : 'False'}, contrast=${S.rules.contrast ? 'True' : 'False'})
print(score(${py($('pgText').value.replace(/\n/g, ' '))}, lex=lexicon, **rules))

story = [
${story.map(s => '    ' + py(s) + ',').join('\n')}
]
scores = [score(s, lex=lexicon, **rules) for s in story]
print(moving_average(scores, k=${+$('pgWin').value}))     # 감정 곡선의 이동 평균

# 2) 나이브 베이즈 — 낱말 원형은 이 페이지가 어절 앞부분으로 고른 것
train = [
${docs(train)}
]
test = [
${docs(test)}
]
vec = CountVectorizer(analyzer=str.split)
nb = MultinomialNB(alpha=1.0).fit(vec.fit_transform([d for _, d in train]), [y for y, _ in train])
pred = nb.predict(vec.transform([d for _, d in test]))
print("정확도:", sum(p == y for p, (y, _) in zip(pred, test)) / len(test))`;
}
function pgAll() { pgScore(); pgArc(); pgCode(); if (lastChap >= 0 && ['eval', 'limits', 'arc', 'intro'].indexOf(CHAPTERS[lastChap].id) >= 0 && !lab.contains(document.activeElement)) buildLab(); }
$('pgText').addEventListener('input', () => { pgScore(); pgCode(); });
$('pgSamples').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { $('pgText').value = b.dataset.s; pgScore(); pgCode(); } });
[['rNeg', 'neg'], ['rBoost', 'boost'], ['rContrast', 'contrast']].forEach(([id, k]) => $(id).addEventListener('change', e => setRule(k, e.target.checked)));
$('pgExtra').addEventListener('input', e => setExtra(e.target.value, 'pg'));
$('pgStory').addEventListener('input', () => { PG.sel = null; pgArc(); pgCode(); });
$('pgWin').addEventListener('input', () => { $('pgWinOut').textContent = `문장 ${$('pgWin').value}개씩`; pgArc(); pgCode(); });
$('pgStoryReset').addEventListener('click', () => { $('pgStory').value = SA.STORY.join('\n'); PG.sel = null; pgArc(); pgCode(); });
const arcPick = e => { const g = e.target.closest('g.b'); if (!g) return; PG.sel = PG.sel === +g.dataset.i ? null : +g.dataset.i; pgArc(); const again = $('pgArc').querySelector(`g.b[data-i="${g.dataset.i}"]`); if (again) again.focus(); };
$('pgArc').addEventListener('click', arcPick);
$('pgArc').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); arcPick(e); } });
['pgTrain', 'pgTest'].forEach(id => $(id).addEventListener('input', () => { pgLearn(); pgScore(); pgCode(); }));
pgLearn(); pgAll();

/* =========================================================
   8. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 답은 이 페이지의 계산으로 정함
   ========================================================= */
const QC = { bg: '#13131A', text: '#EEEDF2', muted: '#9897A6', pos: '#4A90E8', neg: '#E66767', neu: '#8E8D9A', ok: '#7BE0A6', no: '#FF8E8E', key: '#C9A7FF' };
const qfnt = (px, w = 600) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
// 4번: 규칙을 적용하면 점수가 가장 낮은 문장
const Q4S = ['정말 재미있다', '추천하지 않는다', '너무 지루하다', '조금 지루하다'];
const Q4V = Q4S.map(t => SA.score(t).total), Q4A = Q4V.indexOf(Math.min(...Q4V));
const Q4FIG = {
  width: 400, height: 200, label: '문장 네 개(A부터 D). 규칙을 적용한 감성 사전 점수를 비교하는 문제',
  pick: (x, y) => { const k = Math.floor((y - 10) / 45); return k >= 0 && k < 4 ? k : -1; },
  draw(g, st) {
    g.fillStyle = QC.bg; g.fillRect(0, 0, 400, 200);
    Q4S.forEach((t, k) => {
      const y = 32 + k * 45, on = st.done && k === st.answer, bad = st.done && k === st.pick && k !== st.answer;
      if (st.hover === k) { g.fillStyle = 'rgba(238,237,242,0.07)'; g.fillRect(6, y - 20, 388, 40); }
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.font = qfnt(15, 700); g.fillStyle = QC.key; g.fillText('ABCD'[k], 16, y);
      g.font = qfnt(17, 600); g.fillStyle = on ? QC.ok : bad ? QC.no : QC.text; g.fillText(t, 44, y);
      if (st.done) { const v = Q4V[k]; g.font = qfnt(15, 700); g.fillStyle = v > 0 ? QC.pos : v < 0 ? QC.neg : QC.neu; g.textAlign = 'right'; g.fillText(sf(v), 380, y); }
    });
  },
};
// 9번: 흥부전 감정 곡선에서 가장 낮은 장면
const Q9P = SA.STORY_MARKS.map(m => m[0]), Q9L = SA.STORY_MARKS.map(m => m[1]);
const Q9A = Q9P.reduce((b, i, k) => SA.ARC.scores[i] < SA.ARC.scores[Q9P[b]] ? k : b, 0);
const Q9X = i => 22 + i * (356 / (SA.STORY.length - 1)), Q9U = 16, Q9Y = v => 100 - v * Q9U;   // ±3점과 이름표가 그림 안에 들어가도록
const Q9FIG = {
  width: 400, height: 200, label: '흥부전 문장 14개의 감정 점수 막대. A부터 D까지 네 장면이 표시되어 있음',
  pick: (x, y) => { let best = -1, bd = 1e9; Q9P.forEach((i, k) => { const d = Math.abs(Q9X(i) - x); if (d < bd && d < 26) { bd = d; best = k; } }); return best; },
  draw(g, st) {
    g.fillStyle = QC.bg; g.fillRect(0, 0, 400, 200);
    g.strokeStyle = 'rgba(238,237,242,0.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(10, Q9Y(0)); g.lineTo(390, Q9Y(0)); g.stroke();
    SA.ARC.scores.forEach((v, i) => {
      const x = Q9X(i), k = Q9P.indexOf(i);
      rr(g, x - 9, v >= 0 ? Q9Y(v) : Q9Y(0), 18, Math.max(2, Math.abs(v) * Q9U), 3);
      g.fillStyle = st.done || k >= 0 ? (v > 0 ? QC.pos : v < 0 ? QC.neg : QC.neu) : 'rgba(142,141,154,0.45)'; g.fill();
      if (k >= 0) {
        const on = st.done && k === st.answer, bad = st.done && k === st.pick && k !== st.answer, ly = v >= 0 ? Q9Y(v) - 16 : Q9Y(v) + 16;
        g.beginPath(); g.arc(x, ly, 11, 0, Math.PI * 2); g.fillStyle = on ? QC.ok : bad ? QC.no : st.hover === k ? '#E3D3FF' : QC.key; g.fill();
        g.font = qfnt(13, 700); g.fillStyle = '#15131C'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x, ly + 1);
        if (st.done) { g.font = qfnt(12, 600); g.fillStyle = QC.text; g.fillText(`${Q9L[k]} ${sf(v)}`, Math.min(360, Math.max(40, x)), v >= 0 ? ly - 18 : ly + 18); }
      }
    });
  },
};
const lex = t => SA.score(t).total;
const Q2O = ['+1', '+2', '+3', '0'], Q3O = ['−1', '+1', '0', '+1.5'];
const QS = [
  { q: '감정분석이 하는 일로 가장 알맞은 것은?', opts: ['글을 주제별로 묶는다', '글에 담긴 감정이 긍정인지 부정인지, 얼마나 강한지 잰다', '글쓴이가 누구인지 맞힌다', '글을 다른 언어로 옮긴다'], a: 1, why: '감정분석은 글 속 단서로 감정의 방향(극성)과 세기를 추정해요. 주제 묶기는 토픽 모델링, 글쓴이 맞히기는 저자 판별이에요.' },
  { q: '사전 점수가 ‘아름답다’ +1, ‘감동’ +2일 때 ‘문장이 아름답고 결말이 감동적이다’의 점수는?', opts: Q2O, a: Q2O.indexOf(sf(lex(SV.EX.lexicon), 0)), why: `사전에 있는 두 단어의 점수를 더해 ${sf(lex(SV.EX.lexicon), 0)}. ‘문장’, ‘결말’은 사전에 없어서 0점이에요.` },
  { q: '규칙을 쓰는 감성 사전에서 ‘추천하지 않는다’의 점수는? (‘추천’은 +1)', opts: Q3O, a: Q3O.indexOf(sf(lex(SV.EX.neg), 0)), why: '‘추천’ +1 뒤에 부정어 ‘않다’가 와서 점수를 뒤집어 −1이 돼요. 규칙이 없으면 +1로 긍정이라고 틀려요.' },
  { q: '규칙을 적용하면 A~D 중 점수가 가장 낮은 문장은? 줄을 누르거나 아래 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], figure: Q4FIG, a: Q4A, why: `‘너무 지루하다’는 −1 × 1.5 = ${sf(Q4V[2])}로 가장 낮아요. ‘추천하지 않는다’는 −1, ‘조금 지루하다’는 −1 × 0.5 = −0.5예요.` },
  { q: '서평 ‘읽는 내내 눈물이 났다’를 감성 사전이 부정으로 판단한 까닭은?', opts: ['문장이 너무 짧아서', '부정어가 들어 있어서', '강조어가 없어서', '사전은 ‘눈물’을 부정으로 보지만, 서평에서는 칭찬으로 쓰여서'], a: 3, why: '같은 단어도 분야에 따라 뜻이 달라요. 서평에서 눈물은 대개 감동을 뜻해요. 데이터에서 배우는 나이브 베이즈는 이 서평을 긍정으로 맞혔어요.' },
  { q: '나이브 베이즈는 낱말의 무게를 어떻게 정할까요?', opts: ['학습 데이터에서 그 낱말이 긍정·부정 글에 나온 횟수로', '사람이 낱말마다 점수를 정해서', '낱말의 글자 수로', '사전의 뜻풀이로'], a: 0, why: '긍정 글과 부정 글에서 낱말이 나온 비율을 비교해 무게를 정해요. 그래서 ‘꿀잼’처럼 사전에 없는 새말도 배울 수 있어요.' },
  { q: '라플라스 스무딩으로 모든 횟수에 1을 더하는 까닭은?', opts: ['계산을 빠르게 하려고', '한쪽에 한 번도 안 나온 낱말의 확률이 0이 되어 전체 확률이 0이 되는 것을 막으려고', '긍정 서평의 수를 늘리려고', '낱말의 순서를 기억하려고'], a: 1, why: '확률을 곱하는 계산이라 0이 하나만 있어도 전체가 0이 돼요. 1을 더하면 처음 보는 조합에도 작은 확률이 남아요.' },
  { q: '시험 서평 8개 중 7개를 맞혔다면 정확도는?', opts: ['70%', '78%', '80%', '87.5%'], a: 3, why: '정확도 = 맞힌 수 ÷ 전체 = 7 ÷ 8 = 0.875, 곧 87.5%예요. 영상의 나이브 베이즈 결과예요.' },
  { q: 'A~D는 흥부전 감정 곡선의 네 장면이에요. 감정 점수가 가장 낮은 장면은? 막대를 누르거나 아래 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], figure: Q9FIG, a: Q9A, why: `‘놀부의 벌’ 장면(‘놀부는 재산을 모두 잃고 슬프게 울었다’)이 ${sf(SA.ARC.scores[10])}로 가장 낮아요. ‘잃다’, ‘슬프다’, ‘울다’가 모두 부정 단어예요.` },
  { q: 'BERT 같은 언어 모델로 감정분석을 할 때의 특징으로 맞는 것은?', opts: ['문맥과 순서를 읽지만, 왜 그렇게 판단했는지 설명하기 어렵다', '학습 데이터가 전혀 필요 없다', '감성 사전만 있으면 된다', '계산이 가장 가볍다'], a: 0, why: '언어 모델은 문맥을 읽어 대조·부정 같은 문장도 잘 다루는 편이지만, 판단 근거를 보이기 어렵고 계산이 무거워요. 감정분석용 데이터로 더 학습시켜 써요.' },
];
if (QS[1].a !== 2 || QS[2].a !== 0 || Q4A !== 2 || Q9A !== 2) console.warn('감정분석 퀴즈: 계산한 정답이 해설과 다릅니다.');
DH.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '감정분석의 원리와 방법을 모두 이해했네요!' : ok >= 7 ? '거의 다 왔어요. 틀린 문제의 해설을 읽어 보세요.' : '영상의 해당 장면을 다시 보고 도전해 보세요.',
});

/* =========================================================
   9. 조작
   ========================================================= */
playBtn.addEventListener('click', () => playing ? pause() : play());
bigPlay.addEventListener('click', () => { T = 0; play(); });
seekEl.addEventListener('input', () => seek(parseFloat(seekEl.value)));
$('speed').addEventListener('change', e => { speed = parseFloat(e.target.value); });
$('ccBtn').addEventListener('click', e => { ccOn = !ccOn; e.currentTarget.setAttribute('aria-pressed', String(ccOn)); capBox.classList.toggle('off', !ccOn); });
$('fsBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if ($('player').requestFullscreen) $('player').requestFullscreen().catch(() => {});
});
document.addEventListener('fullscreenchange', () => setTimeout(resize, 60));
if (NARR.supported) DH.narration.bind(NARR, $('ttsBtn'), $('ttsNote'), { onEnable() { if (!started) { T = 0; play(); } } });
else $('ttsBtn').hidden = true;
document.addEventListener('keydown', e => {
  const tg = e.target;
  if (tg.closest && tg.closest('input, select, textarea, #lab, #playground, #quiz, #glossary')) return;   // 직접 해 보기·놀이터·퀴즈에서 누른 키는 영상을 건드리지 않음
  if (tg.closest && tg.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const ci = SV.chapterAt(T);
  if (e.key === ' ' || e.key === 'k') { e.preventDefault(); playing ? pause() : play(); }
  else if (e.key === 'ArrowRight' && e.shiftKey) { e.preventDefault(); if (ci + 1 < CHAPTERS.length) seek(CHAPTERS[ci + 1].t); }
  else if (e.key === 'ArrowLeft' && e.shiftKey) { e.preventDefault(); seek(CHAPTERS[T - CHAPTERS[ci].t < 1.5 && ci > 0 ? ci - 1 : ci].t); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); seek(T + 5); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(T - 5); }
  else if (e.key === 'c') $('ccBtn').click();
  else if (e.key === 'f') $('fsBtn').click();
  else if (e.key === 'v' && !$('ttsBtn').hidden) $('ttsBtn').click();
});
CHAPTERS.forEach((ch, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'chap';
  b.innerHTML = `<span class="n">${ch.n}</span><span class="tt">${esc(ch.title)}<small>${esc(ch.sub)}</small></span><span class="tm">${fmtT(ch.t)}</span>`;
  b.addEventListener('click', () => { seek(ch.t + 0.01); if (!playing) play(); });
  $('chapters').appendChild(b);
  if (i) { const t = document.createElement('i'); t.style.left = `calc(${ch.t / END * 100}% - 1px)`; $('ticks').appendChild(t); }
});
seekEl.max = END;
// 화면 누르기: 예문 카드·시험 서평 줄·곡선 막대 → 그것 고르기, 빈 곳 → 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * SV.W, (e.clientY - r.top) / r.height * SV.H]; };
const hitAt = (x, y) => started ? SV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.kind === 'card') { S.card = h.i; changed(true); }
  else if (h && h.kind === 'test') { S.test = S.test === h.i ? null : h.i; changed(true); }
  else if (h && h.kind === 'sent') { S.sent = S.sent === h.i ? null : h.i; changed(true); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { cv.style.cursor = hitAt(...toLogical(e)) ? 'pointer' : 'default'; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-arc)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
requestAnimationFrame(loop);
// 글꼴: 먼저 자막·문장 글자를 받고, 영상 전체의 글자는 조금씩 모아 이어서 받음
loadFonts(SV.baseText()).then(() => { dirty = true; });
setTimeout(() => SV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
})();
