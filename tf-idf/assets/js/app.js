/* TF-IDF 튜토리얼 — 플레이어, 직접 해 보기, 놀이터, 퀴즈, 영상 추출
 * 계산은 corpus.js(TI), 그림은 scenes.js(TV)가 맡습니다.
 */
(() => {
'use strict';
const EXPORT = location.hash === '#export';                // 영상 추출 모드 (../tools/render-video.cjs가 엶)
if (EXPORT) document.body.classList.add('export');
const $ = id => document.getElementById(id);
const TI = window.TI, TV = window.TV, M = TI.M, D = TI.DOCS, S = TV.S;
const { CHAPTERS, CAPTIONS, END, POSTER } = TV;
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f2 = x => TI.fmt(x, 2);
const ix = w => M.index[w];
const cv = $('cv'), ctx = cv.getContext('2d');

/* =========================================================
   1. 글꼴 — 캔버스에 쓰는 글자를 모두 미리 받음
   ========================================================= */
const F = TV.fonts;
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
  const ready = new Promise(res => TV.collectText(res)).then(loadFonts);
  window.DH_EXPORT = {
    title: '단어의 무게, 문서의 거리 — TF-IDF와 문서 유사도',
    duration: END,
    chapters: CHAPTERS.map(c => ({ id: c.id, title: c.title, start: c.t })),
    captions: CAPTIONS.map(([start, end, text]) => ({ start, end, text })),
    ready: () => ready,
    frame(t, fps, q) { TV.render(ctx, t, { caption: true }); return cv.toDataURL('image/jpeg', q || 0.95); },
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
  const cap = started ? TV.captionAt(T) : '재생 단추를 누르면 시작해요. 아무 때나 멈추고 화면을 눌러 보세요.';
  if (cap !== lastCap) { lastCap = cap; capText.innerHTML = esc(cap).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') || '&nbsp;'; }
  const ci = TV.chapterAt(T);
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
  if (dirty) { dirty = false; TV.render(ctx, started ? T : POSTER); }
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
  // 이 튜토리얼의 약어 읽기 (①, →, ×, ÷ 같은 기호는 공통 부품이 바꿈)
  read: [
    [/TF-IDF/g, '티에프 아이디에프'], [/\bIDF\b/g, '아이디에프'], [/\bTF\b/g, '티에프'], [/\bDF\b/g, '디에프'],
    [/Term Frequency/g, '텀 프리퀀시'], [/Document Frequency/g, '도큐먼트 프리퀀시'],
    [/scikit-learn/g, '사이킷런'], [/TfidfVectorizer/g, '티에프아이디에프 벡터라이저'], [/cosine_similarity/g, '코사인 시밀래리티'],
    [/L2/g, '엘투'], [/ln\(/g, '로그 ('], [/≈/g, ' 약 '], [/√/g, '루트 '], [/ − /g, ' 빼기 '], [/\s*=\s*/g, ', '],
  ],
  rate: () => speed,
  holdBefore: 0.05,
}) : { supported: false, reset() {}, hold: (T, next) => next, sync() {} };

/* =========================================================
   5. 장면별 '직접 해 보기' — 장이 바뀌거나 직접 고를 때만 다시 만듦
   ========================================================= */
const dotOf = d => `<span class="dot" style="--cl:${d.light};--cd:${d.dark}"></span>`;
const docChips = () => `<div class="chips" role="group" aria-label="문서 고르기">${D.map((d, i) => `<button type="button" class="chip" data-doc="${i}" aria-pressed="${i === S.doc}">${dotOf(d)}${d.title}</button>`).join('')}</div>`;
const docOptions = sel => D.map((d, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${d.title}</option>`).join('');
function markedHTML(doc) {
  let out = '', pos = 0;
  doc.spans.forEach(sp => { out += esc(doc.text.slice(pos, sp.start)) + '<mark>' + esc(sp.word) + '</mark>'; pos = sp.end; });
  return out + esc(doc.text.slice(pos));
}
const CALC = { a: 0, b: 1 };                              // 두 문서 비교 계산기
const pairSelects = () => `<div class="row"><label for="labA">문서</label><select class="sel" id="labA">${docOptions(CALC.a)}</select><span aria-hidden="true">↔</span><select class="sel" id="labB" aria-label="비교할 문서">${docOptions(CALC.b)}</select></div>`;
const RAWW = M.w;
const LONG = M.transform([].concat(D[0].tokens, D[0].tokens, D[0].tokens));
const vocabByDf = M.vocab.map((w, v) => v).sort((a, b) => M.df[b] - M.df[a] || a - b);

const LABS = {
  intro: () => `<h2>직접 해 보기</h2><h3>줄거리 읽기</h3>${docChips()}
    <p class="quote">${markedHTML(D[S.doc])}</p>
    <p class="note">표시한 낱말이 명사예요(형태소 분석기 흉내). 여기서 고른 문서가 단어 가방·TF·TF-IDF 장면에 나와요. 화면의 카드를 눌러도 돼요.</p>`,
  bag: () => {
    const d = S.doc, seen = M.top(d, null, 'tf');
    return `<h2>직접 해 보기</h2><h3>다른 문서의 단어 가방</h3>${docChips()}
      <p class="quote">${seen.map(v => `${esc(M.vocab[v])} <b>${M.tf[d][v]}</b>`).join(' · ')}</p>
      <p class="note">명사 ${D[d].tokens.length}개, 서로 다른 단어 ${seen.length}개. 순서는 버리고 개수만 남겨요.</p>`;
  },
  tf: () => `<h2>직접 해 보기</h2><h3>다른 문서의 TF</h3>${docChips()}
    <p class="note">TF는 그 문서 안에서만 세요. 다른 문서는 보지 않아요. 그래서 여섯 편 모두에 나오는 ‘이야기’도 TF는 1이에요.</p>`,
  idf: () => {
    const v = S.word ? ix(S.word) : ix('사랑'), df = M.df[v], N = M.N;
    return `<h2>직접 해 보기</h2><h3>단어를 골라 IDF 보기</h3>
      <div class="row"><label for="labWord">단어</label><select class="sel" id="labWord">${vocabByDf.map(k => `<option value="${esc(M.vocab[k])}"${k === v ? ' selected' : ''}>${esc(M.vocab[k])} (DF ${M.df[k]})</option>`).join('')}</select></div>
      <dl class="kv"><dt>DF</dt><dd>${df}</dd>
        <dt>교과서 ln(N ÷ DF)</dt><dd>ln(${N} ÷ ${df}) = ${f2(TI.IDF.classic(N, df))}</dd>
        <dt>scikit-learn 기본</dt><dd>ln(${N + 1} ÷ ${df + 1}) + 1 = ${f2(TI.IDF.smooth(N, df))}</dd>
        <dt>smooth_idf=False</dt><dd>ln(${N} ÷ ${df}) + 1 = ${f2(TI.IDF.plain(N, df))}</dd></dl>
      <p class="note">고른 단어가 화면 넷째 줄에 나와요. scikit-learn 공식은 1을 더해서, 모든 문서에 나오는 단어도 0이 되지 않아요.</p>`;
  },
  tfidf: () => {
    const d = S.doc;
    return `<h2>직접 해 보기</h2><h3>다른 문서의 특징어</h3>${docChips()}
      <table class="tw" style="margin-top:10px"><thead><tr><th>단어</th><th>TF</th><th>IDF</th><th>TF-IDF</th></tr></thead><tbody>
      ${M.top(d, 5).map(v => `<tr><td>${esc(M.vocab[v])}</td><td>${M.tf[d][v]}</td><td>${f2(M.idf[v])}</td><td>${f2(RAWW[d][v])}</td></tr>`).join('')}</tbody></table>
      <p class="note">화면의 표도 고른 문서로 바뀌어요. 문서 카드를 눌러도 돼요.</p>`;
  },
  vector: () => `<h2>직접 해 보기</h2><h3>평면에 그릴 두 단어</h3>
    <div class="row"><label for="labAx">가로</label><select class="sel" id="labAx">${vocabByDf.map(k => `<option${M.vocab[k] === S.ax ? ' selected' : ''}>${esc(M.vocab[k])}</option>`).join('')}</select>
    <label for="labAy">세로</label><select class="sel" id="labAy">${vocabByDf.map(k => `<option${M.vocab[k] === S.ay ? ' selected' : ''}>${esc(M.vocab[k])}</option>`).join('')}</select></div>
    <p class="note">두 단어 칸만 골라 그려요. 두 단어가 모두 없는 문서는 원점에 머물러요. 실제 계산은 ${M.V}칸 모두로 해요. 고른 두 단어는 거리·코사인·정규화 장면에도 쓰여요.</p>`,
  euclid: () => {
    const a = CALC.a, b = CALC.b, x = [RAWW[a][ix(S.ax)], RAWW[a][ix(S.ay)]], y = [RAWW[b][ix(S.ax)], RAWW[b][ix(S.ay)]];
    return `<h2>직접 해 보기</h2><h3>두 문서의 유클리드 거리</h3>${pairSelects()}
      <dl class="kv"><dt>그림 속 두 칸</dt><dd>${f2(TI.euclid(x, y))}</dd>
        <dt>${M.V}칸 모두 (정규화 전)</dt><dd>${f2(TI.euclid(RAWW[a], RAWW[b]))}</dd>
        <dt>${M.V}칸 모두 (길이 1로)</dt><dd>${f2(TI.euclid(M.u[a], M.u[b]))}</dd></dl>
      <div class="row"><label class="chk"><input type="checkbox" id="labLong"${S.long ? ' checked' : ''}> 긴 춘향전 보이기</label></div>
      <p class="note">긴 춘향전 ↔ 춘향전 (정규화 전): ${f2(TI.euclid(LONG, RAWW[0]))}. 내용이 같아도 길이만으로 멀어져요.</p>`;
  },
  cosine: () => {
    const a = CALC.a, b = CALC.b, sh = a === b ? [] : M.shared(a, b).filter(s => s.part > 1e-12);
    return `<h2>직접 해 보기</h2><h3>두 문서의 코사인 유사도</h3>${pairSelects()}
      <dl class="kv"><dt>코사인 유사도</dt><dd>${f2(M.cos[a][b])}</dd><dt>각도</dt><dd>${(Math.acos(clamp(M.cos[a][b], -1, 1)) * 180 / Math.PI).toFixed(1)}°</dd></dl>
      <p class="note">${a === b ? '같은 문서끼리는 1이에요.' : sh.length ? '함께 쓰는 단어와 코사인에 보탠 몫: ' + sh.map(s => `${esc(s.word)} ${f2(s.part)}`).join(', ') : '함께 쓰는 단어가 (IDF가 0인 단어 말고는) 없어서 0이에요. 두 화살표가 직각이에요.'}</p>`;
  },
  norm: () => {
    const a = CALC.a, b = CALC.b, c = M.cos[a][b];
    return `<h2>직접 해 보기</h2><h3>거리 = √(2 − 2 × 코사인) 확인하기</h3>${pairSelects()}
      <dl class="kv"><dt>코사인 유사도</dt><dd>${f2(c)}</dd><dt>√(2 − 2 × ${f2(c)})</dt><dd>${f2(Math.sqrt(Math.max(0, 2 - 2 * c)))}</dd><dt>길이 1로 맞춘 거리</dt><dd>${f2(TI.euclid(M.u[a], M.u[b]))}</dd></dl>
      <div class="row"><label class="chk"><input type="checkbox" id="labLong"${S.long ? ' checked' : ''}> 긴 춘향전 보이기</label></div>`;
  },
  map: () => {
    const p = S.pair, sh = p ? M.shared(p[0], p[1]).filter(s => s.part > 1e-12) : [];
    return `<h2>직접 해 보기</h2><h3>네트워크로 이을 기준</h3>
      <div class="row"><label for="labTh">코사인 유사도 &gt;</label><input type="range" id="labTh" min="0" max="0.12" step="0.01" value="${S.th}"><output id="labThOut">${f2(S.th)}</output></div>
      <p class="note">기준을 올리면 약한 연결이 사라지고 가장 닮은 짝만 남아요.</p>
      <p class="quote">${p ? `<b>${D[p[0]].title} ↔ ${D[p[1]].title}</b> · 코사인 ${f2(M.cos[p[0]][p[1]])}<br>${sh.length ? '함께 쓰는 단어: ' + sh.map(s => esc(s.word)).join(', ') : '함께 쓰는 단어가 없어요.'}` : '화면의 표에서 칸을 누르면 두 문서가 함께 쓰는 단어를 보여 줘요.'}</p>`;
  },
  outro: () => `<h2>직접 해 보기</h2><h3>내 문서로 해 보기</h3>
    <p>아래 <a href="#playground">놀이터</a>에서 문서를 바꾸고 IDF 공식과 정규화를 골라 보세요. 같은 계산을 하는 파이썬 예제는 <code>tf-idf/examples/tfidf_classics.py</code>에 있어요.</p>
    <p class="note">파이썬 결과와 이 페이지의 숫자는 소수점까지 같아요.</p>`,
};
const lab = $('lab');
function buildLab(focusId) {
  const id = CHAPTERS[lastChap < 0 ? 0 : lastChap].id;
  lab.innerHTML = LABS[id]();
  if (focusId) { const el = $(focusId) || lab.querySelector(`[data-doc="${S.doc}"]`); if (el) el.focus(); }
}
// 이벤트는 한 번만 걸고, 안쪽 내용이 바뀌어도 그대로 동작
lab.addEventListener('click', e => {
  const chip = e.target.closest('[data-doc]');
  if (chip) { S.doc = +chip.dataset.doc; changed('chip'); }
});
lab.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'labWord') { S.word = t.value; changed('labWord'); }
  else if (t.id === 'labAx') { S.ax = t.value; changed('labAx'); }
  else if (t.id === 'labAy') { S.ay = t.value; changed('labAy'); }
  else if (t.id === 'labA' || t.id === 'labB') { CALC[t.id === 'labA' ? 'a' : 'b'] = +t.value; buildLab(t.id); }
  else if (t.id === 'labLong') { S.long = t.checked; changed('labLong'); }
});
lab.addEventListener('input', e => {
  if (e.target.id === 'labTh') { S.th = +e.target.value; $('labThOut').textContent = f2(S.th); changed(false); }
});

/* =========================================================
   6. 놀이터
   ========================================================= */
const PARTICLES = ['에서', '으로', '은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', '로'];
const PUNCT = /^[.,!?"'()[\]·…‘’“”]+|[.,!?"'()[\]·…‘’“”]+$/g;
function tokenizeKo(line) {
  return line.split(/\s+/).map(w => w.replace(PUNCT, '')).filter(Boolean).map(w => {
    for (const p of PARTICLES) if (w.endsWith(p) && w.length > p.length) return w.slice(0, -p.length);
    return w;
  });
}
const DEFAULT_TEXT = D.map(d => `${d.title}: ${d.tokens.join(' ')}`).join('\n');
const PG = { metric: 'cos', sel: null, doc: 0 };
function pgDocs() {
  const mode = $('pgMode').value;
  return $('pgText').value.split('\n').map(l => l.trim()).filter(Boolean).map((l, k) => {
    const m = l.match(/^([^:：]{1,30})[:：]\s*(.*)$/);
    const title = m ? m[1].trim() : `문서 ${k + 1}`, body = m ? m[2] : l;
    const tokens = mode === 'text' ? tokenizeKo(body) : body.split(/\s+/).filter(Boolean);
    const same = D.find(d => d.title === title);
    return { title, body, tokens, light: same ? same.light : '#8A8F98', dark: same ? same.dark : '#8A8F98' };
  }).filter(d => d.tokens.length);
}
const pyStr = s => JSON.stringify(s);
function pyCode(docs, idf, norm, mode) {
  const titles = `titles = [${docs.map(d => pyStr(d.title)).join(', ')}]`;
  const body = `docs = [\n${docs.map(d => '    ' + pyStr(mode === 'text' ? d.body : d.tokens.join(' ')) + ',').join('\n')}\n]`;
  const tok = mode === 'text' ? `
PARTICLES = (${PARTICLES.map(pyStr).join(', ')})

def tokenize(line):
    """띄어쓰기로 자르고 끝의 조사를 떼는 단순한 방법 (형태소 분석기를 쓰면 더 정확해요)"""
    words = []
    for w in line.split():
        w = w.strip(".,!?\\"'()[]·…‘’“”")
        for p in PARTICLES:
            if w.endswith(p) and len(w) > len(p):
                w = w[: -len(p)]
                break
        if w:
            words.append(w)
    return words
` : '';
  const an = mode === 'text' ? 'tokenize' : 'str.split';
  const tail = `
words = ${idf === 'classic' ? 'counter' : 'vec'}.get_feature_names_out()
for title, row in zip(titles, ${idf === 'classic' ? 'X' : 'X.toarray()'}):
    print(title, [words[i] for i in row.argsort()[::-1][:5]])   # TF-IDF가 큰 단어

print(cosine_similarity(X).round(2))     # 코사인 유사도
print(euclidean_distances(X).round(2))   # 유클리드 거리`;
  if (idf === 'classic') return `import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity, euclidean_distances
${tok}
${titles}
${body}

counter = CountVectorizer(analyzer=${an})   # 이미 나눈 단어를 그대로 셈 (기본 규칙은 한 글자 단어를 버림)
tf = counter.fit_transform(docs).toarray()
df = (tf > 0).sum(axis=0)
X = tf * np.log(len(docs) / df)                      # 교과서 공식: TF × ln(N ÷ DF)
${norm ? 'X = X / np.linalg.norm(X, axis=1, keepdims=True)     # L2 정규화: 길이를 1로' : '# 정규화하지 않음 (L2 정규화를 하려면 X를 각 줄의 길이로 나눔)'}
${tail}`;
  return `from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity, euclidean_distances
${tok}
${titles}
${body}

vec = TfidfVectorizer(analyzer=${an}, smooth_idf=${idf === 'smooth' ? 'True' : 'False'}, norm=${norm ? '"l2"' : 'None'})
X = vec.fit_transform(docs)               # 문서 × 단어 TF-IDF 행렬
${tail}`;
}
function pgUpdate() {
  const docs = pgDocs(), idf = $('pgIdf').value, norm = $('pgNorm').checked, mode = $('pgMode').value;
  const N = docs.length;
  $('pgCode').textContent = N ? pyCode(docs, idf, norm, mode) : '';
  if (N < 2) {
    $('pgStat').innerHTML = '문서를 두 개 이상 넣어 주세요.';
    ['pgTop', 'pgHm', 'pgLegend', 'pgPair'].forEach(id => { $(id).innerHTML = ''; });
    $('pgDoc').innerHTML = '';
    return;
  }
  const Mp = TI.model(docs, { idf, norm });
  const total = docs.reduce((s, d) => s + d.tokens.length, 0);
  $('pgStat').innerHTML = `문서 <b>${N}</b>개 · 단어 <b>${total}</b>개 · 서로 다른 단어 <b>${Mp.V}</b>개 = 벡터 <b>${Mp.V}</b>차원`;
  // 문서마다 독특한 단어
  PG.doc = Math.min(PG.doc, N - 1);
  $('pgDoc').innerHTML = docs.map((d, i) => `<option value="${i}"${i === PG.doc ? ' selected' : ''}>${esc(d.title)}</option>`).join('');
  const top = Mp.top(PG.doc, 8), wmax = Math.max(1e-9, ...top.map(v => Mp.w[PG.doc][v]));
  $('pgTop').innerHTML = `<thead><tr><th>단어</th><th>TF</th><th>DF</th><th>IDF</th><th>TF-IDF</th><th aria-hidden="true"></th></tr></thead><tbody>${top.map(v =>
    `<tr><td>${esc(Mp.vocab[v])}</td><td>${Mp.tf[PG.doc][v]}</td><td>${Mp.df[v]}</td><td>${f2(Mp.idf[v])}</td><td>${f2(Mp.w[PG.doc][v])}</td><td class="bcell"><i style="width:${(Mp.w[PG.doc][v] / wmax * 100).toFixed(1)}%"></i></td></tr>`).join('')}</tbody>`;
  // 문서 사이의 관계 (표)
  const cosM = PG.metric === 'cos', A = cosM ? Mp.cos : Mp.dist;
  const off = []; A.forEach((r, i) => r.forEach((x, j) => { if (i !== j) off.push(x); }));
  const lo = Math.min(...off), hi = Math.max(...off);
  const strength = x => cosM ? (hi > 0 ? x / hi : 0) : (hi > lo ? (hi - x) / (hi - lo) : 0);   // 닮을수록 1
  const hm = $('pgHm');
  hm.style.gridTemplateColumns = `minmax(64px, 0.9fr) repeat(${N}, minmax(0, 1fr))`;
  const short = t => t.replace(/전$/, '');
  let html = '<span></span>' + docs.map(d => `<span class="h" title="${esc(d.title)}">${esc(short(d.title))}</span>`).join('');
  docs.forEach((d, i) => {
    html += `<span class="r" title="${esc(d.title)}"><span class="dot" style="--cl:${d.light};--cd:${d.dark}"></span>${esc(short(d.title))}</span>`;
    docs.forEach((e, j) => {
      if (i === j) { html += `<button type="button" class="c self" disabled aria-label="${esc(d.title)} 자기 자신">${cosM ? '1' : '0'}</button>`; return; }
      const p = Math.round(strength(A[i][j]) * 100), sel = PG.sel && ((PG.sel[0] === i && PG.sel[1] === j) || (PG.sel[0] === j && PG.sel[1] === i));
      html += `<button type="button" class="c${p > 55 ? ' dark' : ''}" data-i="${i}" data-j="${j}" aria-pressed="${!!sel}" style="background:color-mix(in oklab, var(--accent) ${Math.max(4, p)}%, var(--surface-2))" aria-label="${esc(d.title)}와 ${esc(e.title)}: ${cosM ? '코사인 유사도' : '유클리드 거리'} ${f2(A[i][j])}">${f2(A[i][j])}</button>`;
    });
  });
  hm.innerHTML = html;
  $('pgLegend').innerHTML = cosM
    ? `<span>0</span><i style="background:linear-gradient(90deg,var(--surface-2),var(--accent))"></i><span>${f2(hi)} · 진할수록 닮음 (대각선 제외)</span>`
    : `<span>${f2(hi)}</span><i style="background:linear-gradient(90deg,var(--surface-2),var(--accent))"></i><span>${f2(lo)} · 진할수록 가까움 (${norm ? '길이 1로 맞춘 뒤' : '정규화 전'})</span>`;
  // 고른 두 문서, 또는 가장 닮은 짝
  let pi, pj;
  if (PG.sel && PG.sel[0] < N && PG.sel[1] < N) [pi, pj] = PG.sel;
  else { let best = -1; Mp.cos.forEach((r, i) => r.forEach((x, j) => { if (j > i && x > best) { best = x; pi = i; pj = j; } })); }
  const sh = Mp.shared(pi, pj).filter(s => s.part > 1e-12);
  const raw = TI.euclid(Mp.w[pi], Mp.w[pj]), unit = TI.euclid(Mp.u[pi], Mp.u[pj]);
  $('pgPair').innerHTML = `${PG.sel ? '' : '가장 닮은 짝: '}<strong>${esc(docs[pi].title)} ↔ ${esc(docs[pj].title)}</strong><br>
    코사인 유사도 <b>${f2(Mp.cos[pi][pj])}</b> · 유클리드 거리 <b>${f2(raw)}</b> (정규화 전) / <b>${f2(unit)}</b> (길이 1로)<br>
    ${sh.length ? '함께 쓰는 단어: ' + sh.map(s => `${esc(s.word)}`).join(', ') : '함께 쓰는 단어가 없어요 (IDF가 0인 단어 제외).'}`;
}
$('pgText').value = DEFAULT_TEXT;
['pgText', 'pgIdf', 'pgNorm', 'pgMode'].forEach(id => $(id).addEventListener('input', () => { PG.sel = null; pgUpdate(); }));
$('pgDoc').addEventListener('change', e => { PG.doc = +e.target.value; pgUpdate(); });
$('pgReset').addEventListener('click', () => { $('pgText').value = DEFAULT_TEXT; $('pgMode').value = 'nouns'; PG.sel = null; pgUpdate(); });
$('pgLong').addEventListener('click', () => {
  const t = $('pgText').value.replace(/\s+$/, '');
  if (!/^긴 춘향전:/m.test(t)) $('pgText').value = t + `\n긴 춘향전: ${[].concat(D[0].tokens, D[0].tokens, D[0].tokens).join(' ')}`;
  $('pgMode').value = 'nouns'; PG.sel = null; pgUpdate();
});
$('pgClear').addEventListener('click', () => { $('pgText').value = ''; PG.sel = null; pgUpdate(); $('pgText').focus(); });
document.querySelector('.seg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  PG.metric = b.dataset.m;
  document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  pgUpdate();
});
$('pgHm').addEventListener('click', e => {
  const c = e.target.closest('button.c[data-i]'); if (!c) return;
  const i = +c.dataset.i, j = +c.dataset.j;
  PG.sel = PG.sel && PG.sel[0] === i && PG.sel[1] === j ? null : [i, j];
  pgUpdate();
  const again = $('pgHm').querySelector(`button[data-i="${i}"][data-j="${j}"]`); if (again) again.focus();
});
pgUpdate();

/* =========================================================
   7. 퀴즈 — 사이트 공통 부품(../shared/quiz.js). 답은 이 페이지의 계산으로 정함
   ========================================================= */
const QCOL = { bg: '#12161D', text: '#ECEFF3', muted: '#94A1AF', faint: 'rgba(236,239,243,0.18)', accent: '#FFCB6B', ok: '#7BE0A6', no: '#FF8E8E' };
const qfnt = (px, w = 600) => `${w} ${px}px ${F.FB}, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
// 4번: IDF가 가장 큰 단어 (점 = 그 단어가 나온 문서)
const Q4W = ['벌', '사랑', '이야기', '제비'];
const Q4A = Q4W.reduce((b, w, k) => M.idf[ix(w)] > M.idf[ix(Q4W[b])] ? k : b, 0);
const Q4FIG = {
  width: 400, height: 200, label: '단어 네 개(A부터 D)와, 각 단어가 나온 문서를 칸으로 표시한 그림',
  pick: (x, y) => { const k = Math.floor((y - 12) / 45); return k >= 0 && k < 4 ? k : -1; },
  draw(g, st) {
    g.fillStyle = QCOL.bg; g.fillRect(0, 0, 400, 200);
    Q4W.forEach((w, k) => {
      const y = 34 + k * 45, v = ix(w), on = st.done && k === st.answer, bad = st.done && k === st.pick && k !== st.answer;
      if (st.hover === k) { g.fillStyle = 'rgba(236,239,243,0.06)'; g.fillRect(6, y - 20, 388, 40); }
      g.font = qfnt(15, 700); g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillStyle = '#F5C343'; g.fillText('ABCD'[k], 14, y);
      g.fillStyle = on ? QCOL.ok : bad ? QCOL.no : QCOL.text; g.fillText(w, 40, y);
      D.forEach((d, i) => {
        const x = 110 + i * 30;
        g.beginPath(); g.roundRect ? g.roundRect(x, y - 11, 22, 22, 5) : g.rect(x, y - 11, 22, 22);
        if (M.tf[i][v] > 0) { g.fillStyle = d.dark; g.fill(); } else { g.strokeStyle = QCOL.faint; g.lineWidth = 1.2; g.stroke(); }
      });
      if (st.done) { g.font = qfnt(13, 600); g.fillStyle = on ? QCOL.ok : QCOL.muted; g.fillText(`DF ${M.df[v]} · IDF ${f2(M.idf[v])}`, 296, y); }
    });
  },
};
// 9번: 장화홍련전과 가장 닮은 문서 (밝을수록 닮음)
const Q9C = [2, 4, 5, 0];                                    // 심청전, 콩쥐팥쥐전, 흥부전, 춘향전
const Q9A = Q9C.reduce((b, j, k) => M.cos[3][j] > M.cos[3][Q9C[b]] ? k : b, 0);
const Q9MAX = Math.max(...Q9C.map(j => M.cos[3][j]));
const Q9FIG = {
  width: 400, height: 200, label: '장화홍련전과 다른 네 문서의 코사인 유사도를 밝기로 칠한 칸 네 개(A부터 D)',
  pick: (x, y) => { const k = Math.floor((x - 16) / 94); return y > 40 && y < 170 && k >= 0 && k < 4 ? k : -1; },
  draw(g, st) {
    g.fillStyle = QCOL.bg; g.fillRect(0, 0, 400, 200);
    g.font = qfnt(14, 600); g.fillStyle = QCOL.muted; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('장화홍련전과의 코사인 유사도 · 밝을수록 닮음', 16, 22);
    Q9C.forEach((j, k) => {
      const x = 16 + k * 94, p = Q9MAX > 0 ? M.cos[3][j] / Q9MAX : 0, c = Math.round(34 + 202 * p);
      g.beginPath(); g.roundRect ? g.roundRect(x, 44, 82, 82, 8) : g.rect(x, 44, 82, 82);
      g.fillStyle = `rgb(${c},${Math.round(40 + 199 * p)},${Math.round(52 + 191 * p)})`; g.fill();
      const on = st.done && k === st.answer, bad = st.done && k === st.pick && k !== st.answer;
      if (on || bad || st.hover === k) { g.strokeStyle = on ? QCOL.ok : bad ? QCOL.no : '#7CC4F2'; g.lineWidth = 3; g.stroke(); }
      g.textAlign = 'center';
      g.font = qfnt(16, 700); g.fillStyle = p > 0.55 ? '#10141A' : '#F5C343'; g.fillText('ABCD'[k], x + 41, 72);
      if (st.done) { g.font = qfnt(14, 600); g.fillStyle = p > 0.55 ? '#10141A' : QCOL.text; g.fillText(f2(M.cos[3][j]), x + 41, 100); }
      g.font = qfnt(13, 600); g.fillStyle = QCOL.text; g.fillText(D[j].title, x + 41, 146);
    });
  },
};
const top1 = d => M.vocab[M.top(d, 1)[0]];
const Q5O = ['박', '다리', '제비', '흥부'];
const QS = [
  { q: '문서를 단어 가방(bag of words)으로 바꿀 때 버리는 정보는?', opts: ['단어가 나온 횟수', '단어의 순서', '어떤 단어가 있는지', '문서가 몇 개인지'], a: 1, why: '단어 가방은 단어마다 몇 번 나왔는지만 남기고 순서는 버려요. 그래서 ‘개가 사람을 물었다’와 ‘사람이 개를 물었다’의 명사 가방은 똑같아요.' },
  { q: '춘향전 줄거리에서 ‘몽룡’의 TF(단어 빈도)는?', opts: ['1', '2', '3', '4'], a: M.tf[0][ix('몽룡')] - 1, why: `‘몽룡’은 춘향전에 ${M.tf[0][ix('몽룡')]}번 나와요. TF는 그 문서 안에서 센 횟수 그대로예요.` },
  { q: '여섯 문서 모두에 나오는 ‘이야기’의 IDF를 교과서 공식 ln(N ÷ DF)로 구하면?', opts: ['0', '1', '1.79', '6'], a: 0, why: `N = ${M.N}, DF = ${M.df[ix('이야기')]}이라 ln(6 ÷ 6) = ln 1 = 0이에요. 어느 문서에나 있는 단어는 문서를 구별하는 데 도움이 안 돼요.` },
  { q: 'A~D 중 IDF가 가장 큰 단어는? 칸은 그 단어가 나온 문서예요. 줄을 누르거나 아래 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], figure: Q4FIG, a: Q4A, why: `‘제비’는 흥부전 한 문서에만 나와서 IDF가 ln(6 ÷ 1) ≈ ${f2(M.idf[ix('제비')])}로 가장 커요. 나오는 문서가 많을수록 IDF는 작아져요.` },
  { q: '흥부전에서 TF-IDF 점수가 가장 높은 단어는?', opts: Q5O, a: Q5O.indexOf(top1(5)), why: `‘제비’는 흥부전에 ${M.tf[5][ix('제비')]}번(TF) 나오고 다른 문서에는 없어서(IDF ${f2(M.idf[ix('제비')])}) ${f2(RAWW[5][ix('제비')])}점으로 가장 높아요. ‘다리’와 ‘박’은 두 번씩, ‘흥부’는 한 번 나와요.` },
  { q: '문서를 TF-IDF 벡터로 바꾸면 벡터의 칸 수(차원)는 무엇과 같을까요?', opts: ['문서의 수', '문서 모음 전체에 나온 서로 다른 단어의 수', '그 문서에 나온 단어의 수', '가장 긴 문서의 글자 수'], a: 1, why: `모든 문서가 같은 단어 목록을 칸으로 써요. 이 예시는 서로 다른 단어가 ${M.V}개라서 ${M.V}차원이에요. 그 문서에 없는 단어 칸은 0이에요.` },
  { q: '춘향전을 세 번 이어 붙인 긴 문서와 원래 춘향전의 코사인 유사도는?', opts: ['1', '0', '0.33', '3'], a: 0, why: `점수가 모두 세 배가 되어 길이만 길어지고 방향은 같아요. 각도 0°, 코사인 ${f2(TI.cosine(LONG, RAWW[0]))}. 반면 정규화 전 유클리드 거리는 ${f2(TI.euclid(LONG, RAWW[0]))}로 다른 어느 소설보다 멀어요.` },
  { q: '함께 쓰는 단어가 하나도 없는 두 문서의 코사인 유사도는?', opts: ['1', '-1', '0.5', '0'], a: 3, why: '칸마다 곱하면 한쪽이 늘 0이라 내적이 0이에요. 두 화살표가 직각을 이뤄요. TF-IDF에는 음수가 없어서 -1은 나오지 않아요.' },
  { q: 'A~D 중 장화홍련전과 가장 닮은 문서는? 칸을 누르거나 아래 단추를 고르세요.', opts: ['A', 'B', 'C', 'D'], figure: Q9FIG, a: Q9A, why: `콩쥐팥쥐전(${f2(M.cos[3][4])})이에요. 둘 다 ‘계모’, ‘어머니’, ‘구박’, ‘벌’을 써요. 심청전은 ‘아버지’ 하나만 함께 써서 ${f2(M.cos[3][2])}예요.` },
  { q: '길이를 1로 맞춘(L2 정규화) 두 벡터의 코사인 유사도가 0.5이면 유클리드 거리는?', opts: ['0', '0.5', '1', '2'], a: 2, why: '거리 = √(2 − 2 × 코사인) = √(2 − 1) = 1이에요. 길이를 1로 맞추면 코사인이 클수록 거리가 짧아져서 두 값이 같은 순서를 줘요.' },
];
if (Q4W[Q4A] !== '제비' || Q5O[QS[4].a] !== '제비' || Q9C[Q9A] !== 4 || QS[1].a !== 2) console.warn('TF-IDF 퀴즈: 계산한 정답이 해설과 다릅니다.');
DH.quiz({
  list: $('quizList'), score: $('quizScore'), reset: $('quizReset'), questions: QS,
  done: (ok, total) => ok === total ? 'TF-IDF와 문서 유사도를 모두 이해했네요!' : ok >= 7 ? '거의 다 왔어요. 틀린 문제의 해설을 읽어 보세요.' : '영상의 해당 장면을 다시 보고 도전해 보세요.',
});

/* =========================================================
   8. 조작
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
  const ci = TV.chapterAt(T);
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
// 화면 누르기: 문서 카드 → 그 문서 고르기, 유사도 표의 칸 → 두 문서 고르기, 빈 곳 → 재생/일시정지
const toLogical = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * TV.W, (e.clientY - r.top) / r.height * TV.H]; };
const hitAt = (x, y) => started ? TV.hits().find(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) : null;
cv.addEventListener('click', e => {
  if (!started) { T = 0; play(); return; }
  const h = hitAt(...toLogical(e));
  if (h && h.kind === 'doc') { S.doc = h.i; changed(true); }
  else if (h && h.kind === 'pair') { S.pair = S.pair && S.pair[0] === h.i && S.pair[1] === h.j ? null : [h.i, h.j]; changed(true); }
  else playing ? pause() : play();
});
cv.addEventListener('mousemove', e => { cv.style.cursor = hitAt(...toLogical(e)) ? 'pointer' : 'default'; });
// 주소 끝 #c-장면이름 으로 바로 가기 (예: index.html#c-cosine)
const deep = CHAPTERS.find(c => location.hash === '#c-' + c.id);
if (deep) { T = deep.t + 0.5; started = true; bigPlay.hidden = true; }

new ResizeObserver(resize).observe($('screen'));
resize(); syncUI();
requestAnimationFrame(loop);
// 글꼴: 먼저 자막·문서 글자를 받고, 영상 전체의 글자는 조금씩 모아 이어서 받음
loadFonts(TV.baseText()).then(() => { dirty = true; });
setTimeout(() => TV.collectText(text => loadFonts(text).then(() => { dirty = true; }), 8), 400);
})();
