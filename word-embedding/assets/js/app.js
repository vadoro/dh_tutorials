/* 워드 임베딩 튜토리얼 — 플레이어, 직접 해 보기, 놀이터, 퀴즈, 영상 추출
 * 계산은 embedding.js(WE), 그림은 scenes.js(EV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const WE = window.WE, EV = window.EV, S = EV.S, M = WE.MODEL, D = WE.DATA;
const { CHAPTERS, CAPTIONS, END, POSTER } = EV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f2 = x => WE.fmt(x, 2);
const cv = $('cv'), ctx = cv.getContext('2d');

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = EV.fonts;
const FONT_SET = [[700, F.FD], [800, F.FD], [400, F.FB], [500, F.FB], [600, F.FB], [700, F.FB], [400, F.FM], [500, F.FM], [600, F.FM], [700, F.FM]];
const loadFonts = text => Promise.race([
  Promise.all(FONT_SET.map(([w, f]) => document.fonts.load(`${w} 20px ${f}`, text).catch(() => null))),
  new Promise(r => setTimeout(r, 15000)),
]).then(() => document.fonts.ready);

/* =========================================================
   2. 영상 추출 — 사이트 공통 렌더러가 쓰는 약속
   ========================================================= */
if (EXPORT) {
  cv.width = 1920; cv.height = 1080;
  const ready = new Promise(res => EV.collectText(res)).then(loadFonts);
  window.DH_EXPORT = {
    title: '단어를 지도 위에 — 워드 임베딩의 원리',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { EV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const cap = started ? EV.captionAt(T) : '재생 단추를 누르면 시작해요. 아무 때나 멈추고 화면의 단어를 눌러 보세요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = esc(cap).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') || '&nbsp;'; }
  const ci = EV.chapterAt(T);
  if (ci !== lastChap) { lastChap = ci; document.querySelectorAll('.chap').forEach((b, i) => b.setAttribute('aria-current', String(i === ci))); if (CHAPTERS[ci].id !== 'train') S.epoch = null; buildLab(); }
}
function play() {
  if (T >= END - 0.01) T = 0;
  S.epoch = null;                                       // 재생하면 학습 장면은 다시 영상 흐름대로
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
  if (dirty) { dirty = false; EV.render(ctx, started ? T : POSTER); }
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
  // 이 튜토리얼의 읽기 규칙 (→, ×, ÷ 같은 기호는 공통 부품이 바꿈)
  read: [
    [/word embedding/g, '워드 임베딩'], [/word2vec/g, '워드투벡'], [/one-hot/g, '원핫'], [/skip-gram/g, '스킵그램'],
    [/distributional hypothesis/g, '디스트리뷰셔널 하이퍼시스'], [/\(window\)/g, ''], [/\(analogy\)/g, ''], [/BERTopic/g, '버토픽'], [/BERT/g, '버트'],
    [/Mikolov/g, '미콜로프'], [/J\. R\. Firth/g, '제이 알 퍼스'], [/king − man \+ woman/g, '킹 빼기 맨 더하기 우먼'], [/queen/g, '퀸'],
    [/‘gay’/g, '게이'], [/‘broadcast’/g, '브로드캐스트'], [/____/g, '빈칸'], [/(\d)~(\d)/g, '$1에서 $2'], [/ − /g, ' 빼기 '], [/ \+ /g, ' 더하기 '], [/ : /g, ' 대 '], [/ = /g, ', '],
  ],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   5. 벡터와 단어를 HTML로
   ========================================================= */
const GROUP_ID = {};
EV.GROUP.forEach(([id, , , words]) => words.forEach(w => { GROUP_ID[w] = id; }));
const wHTML = w => `<span class="w ${GROUP_ID[w] || ''}">${esc(w)}</span>`;
const cellBg = (v, max) => `background:color-mix(in srgb, var(${v >= 0 ? '--pos' : '--neg'}) ${Math.round(clamp(Math.abs(v) / max) * 62 + 8)}%, transparent)`;
const vecHTML = (v, max = 3.2, digits = 1) => `<div class="vec">${v.map(x => `<i style="${cellBg(x, max)}">${WE.fmt(x, digits)}</i>`).join('')}</div>`;
const hotHTML = (data, w) => `<div class="vec hot" role="img" aria-label="${esc(w)}의 원-핫 벡터: ${data.vocab.length}칸 가운데 ${data.index[w] + 1}번 칸만 1">${data.vocab.map(x => `<i${x === w ? ' class="on"' : ''}></i>`).join('')}</div>`;
const nearHTML = (list, clickable) => `<div class="nlist">${list.map(o => {
  const tag = clickable ? `button type="button" data-word="${esc(o.w)}"` : 'div';
  return `<${tag} class="r"><span class="wd">${wHTML(o.w)}</span><span class="track"><i class="${o.s < 0 ? 'neg' : ''}" style="width:${(Math.min(1, Math.abs(o.s)) * 100).toFixed(1)}%"></i></span><span class="x">${f2(o.s)}</span></${clickable ? 'button' : 'div'}>`;
}).join('')}</div>`;
const NOUNS = D.vocab.filter(WE.isNoun);
const wordSelect = (id, val, words, label) => `<select class="sel" id="${id}"${label ? ` aria-label="${esc(label)}"` : ''}>${words.map(w => `<option${w === val ? ' selected' : ''}>${esc(w)}</option>`).join('')}</select>`;
const cur = def => (S.word && D.index[S.word] != null ? S.word : def);
// 학습 걸음 번호 → 몇 번째 문장의 어느 짝인지 (말뭉치를 읽는 순서 그대로)
function pairAt(step) {
  let k = step % M.pairs;
  for (const s of D.sents) for (let i = 0; i < s.length; i++) for (const j of WE.neighbors(s, i, WE.CONFIG.window)) { if (k-- === 0) return { s, i, j }; }
  return null;
}
const COOC_BY_WIN = {};
const coocWin = w => COOC_BY_WIN[w] || (COOC_BY_WIN[w] = WE.cooc(D, w));
const SEED_MODELS = { [WE.CONFIG.seed]: M };
const modelSeed = seed => SEED_MODELS[seed] || (SEED_MODELS[seed] = WE.train(D, Object.assign({}, WE.CONFIG, { seed })));

/* =========================================================
   6. 장면별 '직접 해 보기' — 장이 바뀌거나 직접 고를 때만 다시 만듦
   ========================================================= */
const LABS = {
  intro: () => {
    const w = cur('왕');
    return `<h2>직접 해 보기</h2><h3>단어 하나 = 숫자 8개</h3>
      <div class="row"><label for="labWord">단어</label>${wordSelect('labWord', w, NOUNS)}</div>
      ${vecHTML(WE.vec(M, w))}
      <p class="note">‘${esc(w)}’와 가까운 단어 (명사, 코사인 유사도). 누르면 그 단어로 바뀌어요. 화면의 단어 점을 눌러도 돼요.</p>
      ${nearHTML(WE.similar(M, w, 5, true), true)}`;
  },
  onehot: () => {
    const a = S.pa || '왕', b = S.pb || '임금';
    return `<h2>직접 해 보기</h2><h3>원-핫과 임베딩 비교</h3>
      <div class="row">${wordSelect('labPa', a, NOUNS, '첫 단어')} ${wordSelect('labPb', b, NOUNS, '둘째 단어')}</div>
      <p class="note">원-핫 (${D.vocab.length}칸)</p>${hotHTML(D, a)}${hotHTML(D, b)}
      <dl class="kv"><dt>원-핫 코사인</dt><dd>${f2(WE.cos(WE.onehot(D, a), WE.onehot(D, b)))}</dd><dt>임베딩 코사인</dt><dd>${f2(WE.sim(M, a, b))}</dd></dl>
      <p class="note">원-핫으로는 서로 다른 단어가 언제나 0이에요. 임베딩은 뜻이 비슷할수록 1에 가까워요.</p>`;
  },
  idea: () => {
    const w = cur('왕');
    const sents = WE.CORPUS.filter(r => r[1].split(' ').indexOf(w) >= 0).slice(0, 5);
    const alike = NOUNS.filter(x => x !== w).map(x => ({ w: x, s: WE.coocCos(w, x) })).sort((p, q) => q.s - p.s).slice(0, 4);
    return `<h2>직접 해 보기</h2><h3>빈칸에 들어갈 단어</h3>
      <div class="row"><label for="labWord">숨길 단어</label>${wordSelect('labWord', w, NOUNS)}</div>
      ${sents.map(r => `<p class="sent">${r[0].split(' ').map(tok => tok.indexOf(w) === 0 ? `<b class="w">____</b>${esc(tok.slice(w.length))}` : esc(tok)).join(' ')}</p>`).join('')}
      <p class="note">이웃이 많이 겹쳐서 같은 빈칸에 들어갈 만한 단어 (동시 출현 줄의 코사인 유사도)</p>${nearHTML(alike, true)}`;
  },
  count: () => {
    const win = S.win || 2, w = cur('왕'), C = coocWin(win), row = C[D.index[w]];
    const ctxs = D.vocab.map((x, j) => ({ w: x, n: row[j] })).filter(o => o.n).sort((p, q) => q.n - p.n);
    const lem = EV.EX.count.lem, c = 1, nb = WE.neighbors(lem, c, win);
    const ccos = (a, b) => WE.cos(C[D.index[a]], C[D.index[b]]);
    return `<h2>직접 해 보기</h2><h3>창 크기와 이웃 세기</h3>
      <div class="row"><label for="labWin">창 크기</label><input type="range" id="labWin" min="1" max="4" value="${win}"><output id="labWinOut">${win}</output></div>
      <div class="sentrow">${lem.map((x, i) => `<span class="wc${i === c ? ' c' : nb.indexOf(i) >= 0 ? ' n' : ' far'}">${esc(x)}</span>`).join('')}</div>
      <div class="row"><label for="labWord">단어</label>${wordSelect('labWord', w, D.vocab)}</div>
      <p class="note">‘${esc(w)}’의 이웃과 횟수</p>
      <p>${ctxs.map(o => `${wHTML(o.w)} <code>${o.n}</code>`).join(' · ') || '<span class="note">이웃이 없어요.</span>'}</p>
      <dl class="kv"><dt>왕–임금 코사인</dt><dd>${f2(ccos('왕', '임금'))}</dd><dt>왕–사과 코사인</dt><dd>${f2(ccos('왕', '사과'))}</dd><dt>왕–임금 함께 나온 횟수</dt><dd>${C[D.index['왕']][D.index['임금']]}</dd></dl>`;
  },
  dense: () => {
    const a = S.pa || '왕', b = S.pb || '사과';
    return `<h2>직접 해 보기</h2><h3>두 단어의 8칸 비교</h3>
      <div class="row">${wordSelect('labPa', a, NOUNS, '첫 단어')} ${wordSelect('labPb', b, NOUNS, '둘째 단어')}</div>
      <p class="note">${wHTML(a)}</p>${vecHTML(WE.vec(M, a))}<p class="note">${wHTML(b)}</p>${vecHTML(WE.vec(M, b))}
      <dl class="kv"><dt>내적</dt><dd>${f2(WE.dot(WE.vec(M, a), WE.vec(M, b)))}</dd><dt>코사인 유사도</dt><dd>${f2(WE.sim(M, a, b))}</dd></dl>
      <p class="note">칸마다 부호와 크기가 닮을수록 코사인 유사도가 커져요.</p>`;
  },
  w2v: () => {
    const k = S.step == null ? M.trace.indexOf(WE.STEP) : S.step, st = M.trace[k], p = pairAt(st.step);
    const negs = st.drawn.map(i => D.vocab[i]);
    return `<h2>직접 해 보기</h2><h3>실제 학습 걸음 살펴보기</h3>
      <div class="row"><button class="btn ghost" type="button" data-stepby="-1"${k ? '' : ' disabled'}>이전 걸음</button><button class="btn ghost" type="button" data-stepby="1"${k < M.trace.length - 1 ? '' : ' disabled'}>다음 걸음</button><span class="note">${st.step + 1}번째 걸음 (처음 ${M.trace.length}걸음까지)</span></div>
      <div class="sentrow">${p.s.map((x, i) => `<span class="wc${i === p.i ? ' c' : i === p.j ? ' n' : ' far'}">${esc(x)}</span>`).join('')}</div>
      <dl class="kv"><dt>가운데</dt><dd>${wHTML(D.vocab[st.center])}</dd><dt>진짜 이웃</dt><dd>${wHTML(D.vocab[st.ctx])} → 당기기</dd>
      <dt>가짜 이웃</dt><dd>${negs.map((w, i) => st.drawn[i] === st.ctx ? `<s>${esc(w)}</s> (진짜 이웃과 같아 건너뜀)` : esc(w)).join(', ')} → 밀어내기</dd>
      <dt>학습률</dt><dd>${st.lr.toFixed(4)}</dd></dl>
      <p class="note">가짜 이웃은 빈도의 0.75제곱에 비례해 뽑아요. 자주 나오는 낱말이 더 자주 뽑혀요.</p>`;
  },
  train: () => {
    const e = S.epoch == null ? 200 : S.epoch, a = S.pa || '왕', b = S.pb || '사과';
    return `<h2>직접 해 보기</h2><h3>읽은 횟수에 따라</h3>
      <div class="row"><label for="labEp">읽은 횟수</label><input type="range" id="labEp" min="0" max="200" value="${Math.round(e)}"><output id="labEpOut">${Math.round(e)}</output></div>
      <div class="row">${wordSelect('labPa', a, NOUNS, '첫 단어')} ${wordSelect('labPb', b, NOUNS, '둘째 단어')}</div>
      <div id="labTrainOut"></div>
      <div class="row"><button class="btn ghost" type="button" id="labFlow">영상 흐름으로</button></div>
      <p class="note">막대를 움직이면 화면의 지도도 그 횟수만큼 읽은 뒤의 모습으로 바뀌어요.</p>`;
  },
  use: () => {
    const w = cur('한양'), an = S.analogy || ['조선', '한양', '고려'], r = WE.analogy(M, an[0], an[1], an[2], 4, true);
    return `<h2>직접 해 보기</h2><h3>가까운 단어와 유추</h3>
      <div class="row"><label for="labWord">단어</label>${wordSelect('labWord', w, NOUNS)}</div>
      ${nearHTML(WE.similar(M, w, 5, true), true)}
      <div class="analogy">${['labA', 'labB', 'labC'].map((id, i) => wordSelect(id, an[i], NOUNS, 'abc'[i])).join(' ')}</div>
      <p class="note">${esc(an[0])} : ${esc(an[1])} = ${esc(an[2])} : ?  (${esc(an[1])} − ${esc(an[0])} + ${esc(an[2])})</p>
      ${nearHTML(r.list, false)}`;
  },
  limits: () => {
    const seed = S.seed || WE.CONFIG.seed, w = cur('신하'), m = modelSeed(seed);
    return `<h2>직접 해 보기</h2><h3>시드를 바꾸면?</h3>
      <div class="row"><label for="labSeed">시드</label><select class="sel" id="labSeed">${[7, 1, 2, 3, 4, 5].map(s => `<option${s === seed ? ' selected' : ''}>${s}</option>`).join('')}</select>
      <label for="labWord">단어</label>${wordSelect('labWord', w, NOUNS)}</div>
      ${nearHTML(WE.similar(m, w, 5, true), true)}
      <p class="note">‘배’, ‘한양’ 같은 단어도 골라 보세요. 뚜렷한 관계는 시드를 바꿔도 남고, 약한 관계는 흔들려요.</p>`;
  },
  dh: () => `<h2>직접 해 보기</h2><h3>내 연구에 쓴다면</h3>
      <p><b>뜻의 변화</b> — 시대별 말뭉치를 따로 학습한 뒤, 같은 단어의 가까운 단어가 어떻게 바뀌는지 비교해요. 놀이터에 한 시대의 글을 넣고 결과를 적어 둔 다음, 다른 시대의 글로 바꿔 보세요.</p>
      <p><b>개념의 축</b> — ‘부유’와 ‘가난’처럼 반대말 쌍의 벡터 차이로 축을 만들고, 다른 단어를 그 축에 올려놓아요(Kozlowski 외, 2019).</p>
      <p><b>문맥 임베딩</b> — 다의어가 많거나 문장 뜻이 중요하면 BERT 같은 모델의 벡터를 써요. 이 사이트의 BERTopic 튜토리얼이 문장 임베딩을 다뤄요.</p>
      <p class="note">어느 경우든 가까운 단어 목록은 출발점이에요. 원문으로 돌아가 그 단어가 쓰인 문장을 읽어 확인해요.</p>`,
  outro: () => `<h2>직접 해 보기</h2><h3>실제 연구에서는</h3>
      <dl class="kv"><dt>말뭉치</dt><dd>수만 문장 이상</dd><dt>낱말 나누기</dt><dd>형태소 분석기 (Kiwi, Okt 등)</dd><dt>vector_size</dt><dd>100~300</dd><dt>window</dt><dd>5</dd><dt>min_count</dt><dd>5</dd><dt>epochs</dt><dd>5 이상</dd></dl>
      <p><a href="#playground">놀이터</a>에서 이 페이지와 같은 계산을 내 문장으로 해 보고, 같은 설정의 gensim 코드를 받아 가세요.</p>`,
};
const lab = $('lab');
function buildLab(focusId) {
  const id = CHAPTERS[lastChap < 0 ? 0 : lastChap].id;
  lab.innerHTML = LABS[id]();
  if (id === 'train') labTrain();
  if (focusId) { const el = $(focusId) || lab.querySelector(focusId); if (el) el.focus(); }
}
function labTrain() {
  const e = S.epoch == null ? 200 : S.epoch, a = S.pa || '왕', b = S.pb || '사과';
  const pairs = [['왕', '임금'], ['왕', '사과'], [a, b]].filter((p, i, arr) => arr.findIndex(q => q[0] === p[0] && q[1] === p[1]) === i);
  $('labTrainOut').innerHTML = `<dl class="kv">${pairs.map(([x, y]) => `<dt>${esc(x)}–${esc(y)}</dt><dd>${f2(WE.sim(M, x, y, Math.round(e)))}</dd>`).join('')}</dl>`;
}
lab.addEventListener('click', e => {
  const w = e.target.closest('[data-word]'), sb = e.target.closest('[data-stepby]');
  if (w) { S.word = w.dataset.word; changed('labWord'); }
  else if (sb) { const k = S.step == null ? M.trace.indexOf(WE.STEP) : S.step; S.step = clamp(k + +sb.dataset.stepby, 0, M.trace.length - 1); changed(`[data-stepby="${sb.dataset.stepby}"]`); }
  else if (e.target.id === 'labFlow') { S.epoch = null; changed('labFlow'); }
});
lab.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labWord') { S.word = t.value; changed('labWord'); }
  else if (t.id === 'labPa' || t.id === 'labPb') { S[t.id === 'labPa' ? 'pa' : 'pb'] = t.value; changed(t.id); }
  else if (t.id === 'labA' || t.id === 'labB' || t.id === 'labC') { S.analogy = [$('labA').value, $('labB').value, $('labC').value]; changed(t.id); }
  else if (t.id === 'labSeed') { S.seed = +t.value; changed('labSeed'); }
});
lab.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'labWin') { S.win = +t.value; changed('labWin'); }
  else if (t.id === 'labEp') { S.epoch = +t.value; $('labEpOut').textContent = t.value; labTrain(); changed(false); }
});

/* =========================================================
   7. 놀이터 — 말뭉치와 설정을 바꾸면 바로 다시 학습
   ========================================================= */
const PG = { data: D, model: M, cfg: Object.assign({}, WE.CONFIG), sents: D.sents };
const DEFAULT_CORPUS = WE.CORPUS.map(r => r[1]).join('\n');
$('pgCorpus').value = DEFAULT_CORPUS;
$('pgMapWords').value = WE.MAP_LEARN.join(' ');
let pgTimer = 0;
function pgTrain() {
  const sents = WE.tokenize($('pgCorpus').value, $('pgJosa').checked);
  const cfg = Object.assign({}, WE.CONFIG, {
    dim: +$('pgDim').value, window: +$('pgWin').value, negative: +$('pgNeg').value, epochs: +$('pgEp').value,
    seed: Math.max(0, Math.floor(+$('pgSeed').value || 0)),
  });
  const data = WE.prepare(sents);
  let pairs = 0; data.sents.forEach(s => s.forEach((w, i) => { pairs += WE.neighbors(s, i, cfg.window).length; }));
  if (data.vocab.length < 3 || !pairs) { $('pgStat').textContent = '낱말이 3개 이상, 이웃이 있는 문장이 하나 이상 필요해요.'; return; }
  // 너무 오래 걸리지 않게: 계산량이 크면 읽는 횟수를 줄임
  let note = '';
  const work = n => pairs * n * (cfg.negative + 1) * cfg.dim;
  if (work(cfg.epochs) > 6e7) { const n = Math.max(1, Math.floor(6e7 / work(1))); note = ` · 말뭉치가 커서 읽는 횟수를 ${n}번으로 줄였어요`; cfg.epochs = n; }
  const t0 = performance.now();
  PG.data = data; PG.cfg = cfg; PG.sents = data.sents;
  PG.model = WE.train(data, cfg);
  $('pgStat').textContent = `문장 ${data.sents.length}개 · 단어 ${data.vocab.length}개 · 낱말 ${data.tokens}개 · 학습 ${Math.round(performance.now() - t0)}ms${note}`;
  $('pgVocab').innerHTML = data.vocab.map(w => `<option value="${esc(w)}">`).join('');
  pgAll();
}
const inVocab = w => PG.data.index[w] != null;
const missing = w => `<p class="note">‘${esc(w)}’는 말뭉치에 없는 단어예요.</p>`;
function pgNear() {
  const w = $('pgWord').value.trim();
  $('pgNear').innerHTML = !w ? '' : !inVocab(w) ? missing(w) : nearHTML(WE.similar(PG.model, w, 6, $('pgNouns').checked), true);
}
function pgAn() {
  const a = $('pgA').value.trim(), b = $('pgB').value.trim(), c = $('pgC').value.trim();
  const bad = [a, b, c].find(w => !inVocab(w));
  if (bad != null) { $('pgAn').innerHTML = bad ? missing(bad) : ''; return; }
  const r = WE.analogy(PG.model, a, b, c, 5, $('pgNouns').checked);
  $('pgAn').innerHTML = `<p class="note">${esc(b)} − ${esc(a)} + ${esc(c)} 와 가까운 단어</p>${nearHTML(r.list, true)}`;
}
function pgPair() {
  const p = $('pgP').value.trim(), q = $('pgQ').value.trim();
  if (!inVocab(p) || !inVocab(q)) { $('pgPair').innerHTML = !inVocab(p) ? missing(p) : missing(q); return; }
  const C = WE.cooc(PG.data, PG.cfg.window), ip = PG.data.index[p], iq = PG.data.index[q];
  $('pgPair').innerHTML = `<dl class="kv"><dt>임베딩 코사인 유사도</dt><dd class="big">${f2(WE.cos(WE.vec(PG.model, p), WE.vec(PG.model, q)))}</dd>
    <dt>이웃으로 함께 나온 횟수</dt><dd>${C[ip][iq]}</dd><dt>동시 출현 줄의 코사인</dt><dd>${f2(WE.cos(C[ip], C[iq]))}</dd></dl>`;
}
function pgCo() {
  const w = $('pgCo').value.trim();
  if (!inVocab(w)) { $('pgCoOut').innerHTML = w ? missing(w) : ''; return; }
  const C = WE.cooc(PG.data, PG.cfg.window), list = WE.coocRow(PG.data, C, w);
  $('pgCoOut').innerHTML = `<p class="note">창 크기 ${PG.cfg.window} 안에서 ‘${esc(w)}’의 이웃 (모두 ${list.reduce((a, o) => a + o.n, 0)}번)</p><p>${list.map(o => `${wHTML(o.w)} <code>${o.n}</code>`).join(' · ') || '없음'}</p>`;
}
function pgMap() {
  const words = [...new Set($('pgMapWords').value.split(/[\s,]+/).filter(inVocab))];
  if (words.length < 3) { $('pgMap').innerHTML = '<p class="note">말뭉치에 있는 단어를 3개 이상 적어 주세요.</p>'; return; }
  const map = WE.pca2(words.map(w => WE.vec(PG.model, w)));
  const Wd = 640, Hd = 380, pad = 46;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  map.pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  const s = Math.min((Wd - 2 * pad) / (x1 - x0 || 1), (Hd - 2 * pad) / (y1 - y0 || 1));
  const X = x => Wd / 2 + (x - (x0 + x1) / 2) * s, Y = y => Hd / 2 - (y - (y0 + y1) / 2) * s;
  const sel = $('pgWord').value.trim(), placed = [], P = map.pts.map(([x, y]) => [X(x), Y(y)]);
  const pts = words.map((w, i) => {
    const [px, py] = P[i], lw = w.length * 13 + 6;
    // 이름표 자리: 오른쪽 → 왼쪽 → 아래 → 위 가운데 다른 이름표·점과 겹치지 않는 곳
    const cands = [[px + 10, py + 4.5, 'start', px + 8], [px - 10, py + 4.5, 'end', px - 10 - lw], [px, py + 21, 'middle', px - lw / 2], [px, py - 12, 'middle', px - lw / 2]];
    const fits = c => { const r = [c[3], c[1] - 13, lw, 16]; return !placed.some(q => r[0] < q[0] + q[2] && q[0] < r[0] + r[2] && r[1] < q[1] + q[3] && q[1] < r[1] + r[3]) && !P.some((p, k) => k !== i && p[0] > r[0] - 5 && p[0] < r[0] + r[2] + 5 && p[1] > r[1] - 5 && p[1] < r[1] + r[3] + 5); };
    const c = cands.find(fits) || cands[0];
    placed.push([c[3], c[1] - 13, lw, 16]);
    const cls = w === '배' ? 'both' : GROUP_ID[w] || 'other';
    return `<g class="pt${w === sel ? ' sel' : ''}" data-word="${esc(w)}" tabindex="0" role="button" aria-label="${esc(w)}"><circle class="hit" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="15"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6.5" class="${cls}"/><text x="${c[0].toFixed(1)}" y="${c[1].toFixed(1)}" text-anchor="${c[2]}">${esc(w)}</text></g>`;
  }).join('');
  const groups = EV.GROUP.filter(gr => gr[3].some(w => words.indexOf(w) >= 0));
  $('pgMap').innerHTML = `<svg class="map" viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="단어 ${words.length}개를 2차원으로 줄여 그린 지도"><defs><linearGradient id="gBoth"><stop offset="50%" style="stop-color:var(--g-boat)"/><stop offset="50%" style="stop-color:var(--g-fruit)"/></linearGradient></defs><line class="ax" x1="0" y1="${Y(0).toFixed(1)}" x2="${Wd}" y2="${Y(0).toFixed(1)}"/><line class="ax" x1="${X(0).toFixed(1)}" y1="0" x2="${X(0).toFixed(1)}" y2="${Hd}"/>${pts}</svg>
    <div class="legend">${groups.map(gr => `<span><i style="background:var(--g-${gr[0]})"></i>${esc(gr[1])}</span>`).join('')}<span>두 축이 담은 정보(분산) ${Math.round(map.vars[0] * 100)}% + ${Math.round(map.vars[1] * 100)}%. 점을 누르면 ‘가까운 단어’에 넣어요.</span></div>`;
}
const pyStr = s => JSON.stringify(s);
function pgCode() {
  const c = PG.cfg, sents = PG.sents, MAX = 80;
  const shown = sents.slice(0, MAX).map(s => `    [${s.map(pyStr).join(', ')}],`).join('\n') + (sents.length > MAX ? `\n    # … 나머지 ${sents.length - MAX}문장` : '');
  const w = $('pgWord').value.trim() || PG.data.vocab[0], a = $('pgA').value.trim(), b = $('pgB').value.trim(), cc = $('pgC').value.trim();
  $('pgCode').textContent = `# pip install gensim   (gensim 4)
from gensim.models import Word2Vec

sents = [
${shown}
]
# 이 페이지와 같은 방법: 스킵그램(sg=1) + 네거티브 샘플링, 창 크기 고정(shrink_windows=False)
# 작은 말뭉치라 sample=0 (흔한 낱말 덜어 내기를 끔), min_count=1 (모든 낱말을 남김)
model = Word2Vec(sents, vector_size=${c.dim}, window=${c.window}, min_count=1, sg=1, negative=${c.negative},
                 epochs=${c.epochs}, alpha=${c.alpha}, min_alpha=${c.minAlpha}, sample=0, shrink_windows=False,
                 seed=${c.seed}, workers=1)

print(model.wv.most_similar(${pyStr(w)}, topn=5))
print(model.wv.most_similar(positive=[${pyStr(b)}, ${pyStr(cc)}], negative=[${pyStr(a)}], topn=3))   # ${a} : ${b} = ${cc} : ?
# gensim은 난수 쓰는 방법이 달라 숫자가 이 페이지와 조금 달라요.
# 이 페이지와 똑같은 숫자는 examples/embedding_basics.py로 다시 계산할 수 있어요.`;
}
function pgAll() { pgNear(); pgAn(); pgPair(); pgCo(); pgMap(); pgCode(); }
$('pgCorpus').addEventListener('input', () => { clearTimeout(pgTimer); pgTimer = setTimeout(pgTrain, 450); });
['pgJosa', 'pgDim', 'pgSeed'].forEach(id => $(id).addEventListener('change', pgTrain));
[['pgWin', 'pgWinOut'], ['pgNeg', 'pgNegOut'], ['pgEp', 'pgEpOut']].forEach(([id, out]) => {
  $(id).addEventListener('input', () => { $(out).textContent = $(id).value; });
  $(id).addEventListener('change', pgTrain);
});
$('pgReset').addEventListener('click', () => { $('pgCorpus').value = DEFAULT_CORPUS; $('pgJosa').checked = false; pgTrain(); });
['pgWord', 'pgNouns'].forEach(id => $(id).addEventListener(id === 'pgNouns' ? 'change' : 'input', () => { pgNear(); pgAn(); pgMap(); pgCode(); }));
['pgA', 'pgB', 'pgC'].forEach(id => $(id).addEventListener('input', () => { pgAn(); pgCode(); }));
['pgP', 'pgQ'].forEach(id => $(id).addEventListener('input', pgPair));
$('pgCo').addEventListener('input', pgCo);
$('pgMapWords').addEventListener('input', pgMap);
$('playground').addEventListener('click', e => {
  const w = e.target.closest('[data-word]');
  if (w) { $('pgWord').value = w.dataset.word; pgNear(); pgAn(); pgMap(); pgCode(); }
});
$('pgMap').addEventListener('keydown', e => {
  const w = e.target.closest && e.target.closest('[data-word]');
  if (w && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('pgWord').value = w.dataset.word; pgNear(); pgAn(); pgMap(); pgCode(); }
});
$('pgVocab').innerHTML = D.vocab.map(w => `<option value="${esc(w)}">`).join('');
$('pgStat').textContent = `문장 ${D.sents.length}개 · 단어 ${D.vocab.length}개 · 낱말 ${D.tokens}개`;
pgAll();

/* =========================================================
   8. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 답은 이 페이지의 계산으로 정함
   ========================================================= */
const QC = { bg: '#10151B', panel: '#212B37', text: '#EDF1F4', muted: '#93A0AC', ok: '#7BE0A6', no: '#FF8E8E', key: '#6EE7C8' };
const qfnt = (px, w = 600) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
// 4번: 창 크기 2일 때 ‘왕’의 이웃이 아닌 낱말
const Q4L = ['어질다', '왕', '궁궐', '신하', '부르다'], Q4C = 1, Q4O = [0, 2, 3, 4];
const Q4N = WE.neighbors(Q4L, Q4C, 2), Q4A = Q4O.findIndex(i => Q4N.indexOf(i) < 0);
const Q4X = [];
const Q4FIG = {
  width: 400, height: 150, label: '낱말 다섯 개: 어질다, 왕, 궁궐, 신하, 부르다. 가운데 낱말은 왕. A부터 D까지 나머지 낱말에 글자가 붙어 있음',
  pick: (x, y) => { if (y < 28 || y > 108) return -1; const i = Q4X.findIndex(([a, b]) => x >= a && x <= b); return i < 0 || i === Q4C ? -1 : Q4O.indexOf(i); },
  draw(g, st) {
    g.fillStyle = QC.bg; g.fillRect(0, 0, 400, 150);
    g.font = qfnt(16, 700); let x = 12; Q4X.length = 0;
    Q4L.forEach(w => { const cw = g.measureText(w).width + 18; Q4X.push([x, x + cw]); x += cw + 8; });
    const shift = (400 - (x - 8)) / 2 - 12; Q4X.forEach(r => { r[0] += shift; r[1] += shift; });
    if (st.done) {
      const lo = Q4X[Math.max(0, Q4C - 2)][0] - 6, hi = Q4X[Math.min(Q4L.length - 1, Q4C + 2)][1] + 6;
      g.setLineDash([5, 4]); g.strokeStyle = QC.key; g.lineWidth = 1.5; rr(g, lo, 52, hi - lo, 56, 10); g.stroke(); g.setLineDash([]);
      g.font = qfnt(12, 600); g.fillStyle = QC.key; g.textAlign = 'left'; g.fillText('창 크기 2', lo + 4, 124);
    }
    Q4L.forEach((w, i) => {
      const [a, b] = Q4X[i], k = Q4O.indexOf(i), on = st.done && k === st.answer, bad = st.done && k === st.pick && k !== st.answer;
      rr(g, a, 62, b - a, 36, 8);
      g.fillStyle = i === Q4C ? 'rgba(110,231,200,0.25)' : st.hover === k && k >= 0 ? 'rgba(237,241,244,0.14)' : QC.panel; g.fill();
      if (on || bad) { g.strokeStyle = on ? QC.ok : QC.no; g.lineWidth = 2.5; g.stroke(); }
      g.font = qfnt(16, 700); g.fillStyle = QC.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(w, (a + b) / 2, 81);
      g.font = qfnt(13, 700); g.fillStyle = i === Q4C ? QC.key : QC.muted; g.fillText(i === Q4C ? '가운데' : 'ABCD'[k], (a + b) / 2, 40);
    });
  },
};
// 9번: 색이 빠진 점 A~D 가운데 ‘배’ (배와 과일 낱말 지도)
const Q9W = WE.MAP_POLY, Q9C = ['배', '강', '가을', '바다'], Q9A = Q9C.indexOf('배');
const Q9P = (() => {
  const pts = EV.MAPS.poly.pts; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  const s = Math.min(320 / (x1 - x0), 150 / (y1 - y0));
  return pts.map(([x, y]) => [200 + (x - (x0 + x1) / 2) * s, 100 - (y - (y0 + y1) / 2) * s]);
})();
const Q9FIG = {
  width: 400, height: 200, label: '배와 물 낱말(보라), 과일 낱말(분홍)을 2차원으로 그린 지도. 이름이 가려진 점 A부터 D',
  pick: (x, y) => { let best = -1, bd = 22; Q9C.forEach((w, k) => { const [px, py] = Q9P[Q9W.indexOf(w)], d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = k; } }); return best; },
  draw(g, st) {
    g.fillStyle = QC.bg; g.fillRect(0, 0, 400, 200);
    Q9W.forEach((w, i) => {
      const [x, y] = Q9P[i], k = Q9C.indexOf(w);
      if (k < 0 || st.done) {
        g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fillStyle = EV.wcol(w) === '#8B93A1' ? '#8B93A1' : EV.wcol(w); if (w === '배') g.fillStyle = '#EDF1F4'; g.fill();
        // 가까이 붙은 두 점(사과·감, 나룻배·돛단배)은 이름표를 위아래로 나눔
        const twin = Q9W.findIndex((v, j) => j !== i && Math.hypot(Q9P[j][0] - x, Q9P[j][1] - y) < 44);
        const dy = twin < 0 ? 0 : (twin > i ? -11 : 11);
        g.font = qfnt(13, 700); g.fillStyle = QC.text; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(w, x + 11, y + 1 + dy);
      }
      if (k >= 0) {
        const on = st.done && k === st.answer, bad = st.done && k === st.pick && k !== st.answer;
        g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.strokeStyle = on ? QC.ok : bad ? QC.no : st.hover === k ? QC.text : QC.key; g.lineWidth = 2.5; g.stroke();
        if (!st.done) { g.font = qfnt(12, 700); g.fillStyle = QC.key; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ABCD'[k], x, y + 1); }
      }
    });
  },
};
const AN = EV.AN, Q2O = ['1', '0.96', '0', '0.5'], Q8O = ['서라벌', '궁궐', '개경', '신라'];
const QS = [
  { q: '워드 임베딩이 하는 일로 가장 알맞은 것은?', opts: ['문서를 주제별로 묶는다', '단어를 짧은 숫자 벡터로 바꿔 뜻이 비슷한 단어를 가까이 둔다', '문장의 감정을 점수로 매긴다', '단어를 가나다순으로 정렬한다'], a: 1, why: '워드 임베딩은 단어마다 짧은 실수 벡터를 주어, 뜻이 비슷한 단어가 공간에서 가까이 놓이게 해요. 주제 묶기는 토픽 모델링, 감정 점수는 감정분석이에요.' },
  { q: '원-핫 인코딩에서 ‘왕’과 ‘임금’의 코사인 유사도는?', opts: Q2O, a: Q2O.indexOf(WE.fmt(WE.cos(WE.onehot(D, '왕'), WE.onehot(D, '임금')), 0)), why: '원-핫 벡터는 자기 칸만 1이라 서로 다른 단어끼리는 겹치는 칸이 없어요. 그래서 어떤 두 단어든 코사인 유사도가 0이에요.' },
  { q: '분포 가설의 생각으로 맞는 것은?', opts: ['비슷한 자리(이웃)에 쓰이는 단어는 뜻도 비슷하다', '글자 모양이 비슷한 단어는 뜻도 비슷하다', '자주 나오는 단어일수록 중요하다', '사전 뜻풀이가 같아야 같은 뜻이다'], a: 0, why: '“단어는 그 단어가 어울리는 짝을 보면 알 수 있다”(Firth, 1957). 워드 임베딩은 모두 이 생각에서 출발해요.' },
  { q: '창 크기가 2일 때 가운데 낱말 ‘왕’의 이웃으로 세지 않는 낱말은? 낱말을 누르거나 아래 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], figure: Q4FIG, a: Q4A, why: `창 크기 2는 앞뒤 두 낱말까지예요. ‘왕’ 앞의 ‘어질다’, 뒤의 ‘궁궐’, ‘신하’는 이웃이고, 세 칸 떨어진 ‘${Q4L[Q4O[Q4A]]}’는 이웃이 아니에요.` },
  { q: '‘왕’과 ‘임금’은 한 번도 이웃으로 함께 나오지 않았는데, 동시 출현 줄의 코사인 유사도는 0.96이에요. 왜일까요?', opts: ['두 단어가 같은 문장에 자주 함께 나와서', '두 단어의 이웃(신하, 백성, 다스리다…)이 거의 같아서', '두 단어의 글자 수가 같아서', '사람이 비슷하다고 표시해 둬서'], a: 1, why: `두 줄은 ‘이웃으로 나온 횟수’예요. 이웃이 겹칠수록 줄이 닮아요. 실제로 ‘왕’과 ‘임금’이 함께 나온 횟수는 ${WE.together('왕', '임금')}번이에요.` },
  { q: 'word2vec의 스킵그램(skip-gram)이 푸는 문제는?', opts: ['이웃 낱말들로 가운데 낱말을 맞힌다', '다음 문장을 맞힌다', '단어의 품사를 맞힌다', '가운데 낱말로 이웃 낱말을 맞힌다'], a: 3, why: '스킵그램은 가운데 낱말의 벡터로 이웃 낱말을 맞혀요. 이웃 낱말들로 가운데 낱말을 맞히는 쪽은 CBOW(gensim 기본값)예요.' },
  { q: '네거티브 샘플링에서 일어나는 일은?', opts: ['아무렇게나 뽑은 ‘가짜 이웃’과는 벡터를 서로 밀어낸다', '진짜 이웃을 말뭉치에서 지운다', '자주 나오는 낱말을 사전에서 뺀다', '학습률을 0으로 만든다'], a: 0, why: `진짜 이웃은 당기고, 빈도에 따라 뽑은 가짜 이웃(여기서는 ${WE.CONFIG.negative}개)은 밀어내요. 모든 단어와 비교하지 않아도 되어 학습이 빨라요.` },
  { q: '이 페이지에서 배운 벡터로 ‘한양 − 조선 + 고려’를 계산하면 가장 가까운 단어는?', opts: Q8O, a: Q8O.indexOf(AN.list[0].w), why: `‘조선 → 한양’(나라 → 도읍) 방향을 ‘고려’에 더하면 ‘${AN.list[0].w}’(${f2(AN.list[0].s)})에 가장 가까워요. 다만 유추는 늘 맞지 않아요. 신라 : 서라벌 = 고려 : ? 는 ‘${EV.AN_BAD.list[0].w}’가 나와요.` },
  { q: '보라색은 배와 물 낱말, 분홍색은 과일 낱말이에요. 이름이 가려진 점 A~D 가운데 ‘배’는? 점을 누르거나 아래 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], figure: Q9FIG, a: Q9A, why: '‘배’는 타는 배와 먹는 배의 두 뜻이 섞여, 배 무리와 과일 무리 사이에 놓여요. 단어 하나에 벡터가 하나뿐이라 생기는 일이에요.' },
  { q: 'BERT 같은 문맥 임베딩의 장점으로 맞는 것은?', opts: ['학습 데이터가 전혀 필요 없다', '같은 단어라도 문장마다 다른 벡터를 줘서 다의어를 구별할 수 있다', '계산이 가장 가볍다', '말뭉치의 편향을 모두 없애 준다'], a: 1, why: '문맥 임베딩은 문장 속에서 단어 벡터를 새로 만들어요. ‘배를 타다’와 ‘배를 먹다’의 ‘배’가 서로 다른 벡터가 돼요. 편향은 여전히 배울 수 있어요.' },
];
if (QS[1].a !== 2 || QS[7].a !== 2 || Q4A !== 3 || Q9A !== 0) console.warn('워드 임베딩 퀴즈: 계산한 정답이 해설과 다릅니다.');
DH.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? '워드 임베딩의 원리를 모두 이해했네요!' : ok >= 7 ? '거의 다 왔어요. 틀린 문제의 해설을 읽어 보세요.' : '영상의 해당 장면을 다시 보고 도전해 보세요.',
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
  const ci = EV.chapterAt(T);
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
// 화면 누르기: 단어 점·목록 → 그 단어 고르기, 빈 곳 → 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * EV.W, (e.clientY - r.top) / r.height * EV.H]; };
const hitAt = (x, y) => started ? EV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.kind === 'word') { S.word = h.w2; changed(true); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { cv.style.cursor = hitAt(...toLogical(e)) ? 'pointer' : 'default'; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-use)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
requestAnimationFrame(loop);
// 글꼴: 먼저 자막·문장 글자를 받고, 영상 전체의 글자는 조금씩 모아 이어서 받음
loadFonts(EV.baseText()).then(() => { dirty = true; });
setTimeout(() => EV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
})();
