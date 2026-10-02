# DH 튜토리얼 — 작업 규칙

디지털 인문학 연구에 쓰는 데이터 분석 방법을 **인터랙티브 모션그래픽 영상**으로 설명하는 튜토리얼 모음입니다.
튜토리얼 하나 = 폴더 하나이고, 사이트 첫 화면(`index.html`)이 목록을 보여 줍니다. 이 문서는 새 튜토리얼을 추가하거나 고칠 때 지킬 규칙입니다.

## 구조

```
index.html              사이트 첫 화면 (카드 목록, assets/catalog.js를 읽어 그림)
assets/catalog.js       튜토리얼 목록 — 첫 화면과 상단 바가 함께 씀 (단일 출처)
assets/site-bar.js      각 튜토리얼 위에 붙는 공통 상단 바 (섀도 DOM, 추출 화면에서는 안 붙음)
assets/site.css         사이트 페이지 디자인 토큰(밝은/어두운 테마)
shared/narration.js     공통 부품: 음성 해설 (DH.narration)
shared/quiz.js          공통 부품: 퀴즈 (DH.quiz)
shared/components.css   공통 부품 모양: 퀴즈(.dhq), 용어집(.dh-gloss)
_template/index.html    새 튜토리얼의 출발점. 한 파일에 모든 기능이 동작하는 34초짜리 예시(단어 세기)
tools/render-video.cjs  공통 렌더러: DH_EXPORT 약속을 지킨 튜토리얼을 MP4·SRT·미리보기 그림으로
<slug>/index.html       튜토리얼 본체. 폴더 안에서 완결됨
<slug>/docs/poster.jpg  카드 미리보기 그림 1280×720
<slug>/video/*.mp4      수업용 영상 (자막 포함, 장 표시)
<slug>/tools/           그 튜토리얼의 영상 렌더러 등
.nojekyll               GitHub Pages가 _로 시작하는 폴더도 그대로 내보내도록
```

지금 있는 튜토리얼
- `network-analysis/` 점과 선의 과학 — 여러 파일(`assets/js/*.js`), 장면은 `scenes-a.js`, `scenes-b.js`
- `bertopic/` BERTopic 토픽 지도 — `index.html` 한 파일에 모두 들어 있음
- `_template/` 템플릿 — `catalog.js`에 없으므로 첫 화면·상단 바 메뉴에 나오지 않음. 주소로는 열림(`_template/index.html`)

두 폴더는 원래 `vadoro/network_tutorial`, `vadoro/bertopic_tutorial` 저장소였고 `git subtree`로 커밋 기록과 함께 옮겼습니다.

## 지킬 원칙

- **빌드 없는 정적 파일.** 번들러·프레임워크·npm 의존성 없이 HTML/CSS/JS만. `index.html`을 더블클릭해도 동작해야 합니다.
  - 그래서 `type="module"`, `fetch()`로 같은 저장소의 JSON 읽기는 쓰지 않습니다(file://에서 막힘). 데이터는 `<script>`로 읽는 JS 파일에 둡니다.
  - 경로는 모두 상대 경로. 튜토리얼 안에서 사이트 공통 파일은 `../assets/…`, 공통 부품은 `../shared/…`.
  - 링크는 폴더가 아니라 `…/index.html`까지 적습니다(로컬 파일로 열 때 폴더 목록이 뜨지 않도록).
- **외부 자원은 Google Fonts 글꼴만.** 스크립트·그림은 저장소 안에 둡니다. 글꼴이 없어도 깨지지 않게 대체 글꼴을 꼭 적습니다.
- **쉬운 한국어.** 대상은 처음 배우는 학생입니다. 문장은 짧게, 전문 용어는 처음 나올 때 풀어서, 영어 이름은 괄호로 함께. 말투는 기존 튜토리얼처럼 "~예요/~해요".
- **진짜 계산과 비유를 구분해 밝히기.** 페이지가 실제로 계산하는 값(중심성, HDBSCAN, c-TF-IDF 등)과 설명용으로 흉내 낸 부분을 README와 화면 각주에 적습니다. 숫자·기본값·공식은 공식 문서와 맞는지 확인합니다(필요하면 파이썬으로 같은 값을 재현해 확인).
- **원래 화면을 유지.** 공통 상단 바나 사이트 쪽 변경이 영상 추출 결과를 바꾸면 안 됩니다. `site-bar.js`는 `#export`, `?render`일 때 아무것도 하지 않습니다.

## 새 튜토리얼 추가 절차

1. 템플릿을 복사합니다: `cp -r _template <slug>`. slug는 영어 소문자와 `-` (예: `word-embedding`).
2. 새 `index.html`에서 바꿀 곳(파일 맨 위 주석에도 적혀 있음)
   - `<script src="../assets/site-bar.js" data-slug="<slug>">`의 `data-slug`
   - `<title>`, 머리말, 각주(진짜 계산/비유 구분)
   - 스크립트 "2. 데이터와 진짜 계산", "3. 장면 정의"(`CHAPTERS`, `CAPTIONS`, `END`, `POSTER`), "5. 장면 그리기"(`SCENES`), "7. 직접 해 보기"(`LABS`), "9. 놀이터", "10. 퀴즈"(10문제), 용어집 마크업
   - 음성 해설의 약어 읽기(`read`), `DH_EXPORT.title`
   - 장면이 많아지면 network-analysis처럼 `assets/js/` 여러 파일로 나눠도 됩니다. 공통 부품과 `DH_EXPORT` 약속만 지키면 됩니다.
3. `assets/catalog.js`의 `tutorials` 배열에 항목을 추가합니다(필드 설명은 파일 맨 위).
4. 미리보기 그림을 만듭니다: `node tools/render-video.cjs <slug> --poster <대표 장면 초>` → `<slug>/docs/poster.jpg`(1280×720).
5. 영상을 렌더링합니다: `node tools/render-video.cjs <slug>` → `<slug>/video/<slug>.mp4`와 `.srt`(아래 '영상' 참고).
6. `<slug>/README.md`에 장면 구성, 조작법, 진짜 계산/비유 구분, 영상 다시 만드는 법을 적습니다.
7. 루트 `README.md`의 튜토리얼 표에 한 줄 추가합니다.
8. 아래 '확인'을 모두 통과시킨 뒤 커밋합니다.

## 튜토리얼 페이지가 갖출 것

`_template/index.html`이 아래를 모두 갖춘 최소 예시이고, 기존 두 튜토리얼이 큰 예시입니다.

- **영상 플레이어**: 캔버스 무대(16:9, 논리 좌표 1280×720), 재생/일시정지, 진행 막대와 장 눈금, 장 목록, 속도, 자막 켜기/끄기, 전체 화면, 단축키(스페이스, ← →, C, F, V).
  - 그림은 **시간 t만의 함수**로 그립니다. 같은 t면 언제나 같은 그림(난수는 시드 고정, 예: mulberry32). 그래야 되감기와 MP4 추출이 정확합니다.
  - 장면 정의 예: `network-analysis/assets/js/scenes-a.js` 맨 위 주석, `bertopic/index.html`의 `CHAPTERS`/`CAPTIONS`.
  - **재생 중 매 프레임 DOM을 다시 만들지 마세요.** 특히 단추 안의 아이콘(`innerHTML`)을 매 프레임 바꾸면, 누르고 떼는 사이에 아이콘이 교체되어 브라우저가 클릭을 버립니다(BERTopic 일시정지 단추가 아이콘 한가운데를 누르면 안 먹던 원인). 상태가 바뀔 때만 갱신하세요.
- **자막**: `[시작 초, (끝 초,) '문장']`. 한 자막은 4~7초 분량. `**굵게**`나 강조 표시는 튜토리얼 방식을 따름.
- **음성 해설(V)**: 공통 부품 `DH.narration`을 씁니다(아래 '공통 부품'). 브라우저 `speechSynthesis`로 자막을 읽고, 다 읽을 때까지 그 자막 끝에서 영상이 기다립니다. 튜토리얼은 약어 읽기 규칙만 넘기면 됩니다(예: c-TF-IDF → "씨 티에프 아이디에프").
- **장면별 '직접 해 보기'**: 지금 장면에 맞춰 바뀌는 패널. 사용자가 조작하면 영상은 멈추고, 재생하면 영상 흐름으로 돌아갑니다.
- **놀이터**: 영상의 핵심 계산을 사용자가 직접 바꿔 보는 곳. 결과 표와 "지금 설정을 코드로" 보기를 함께 둡니다.
- **퀴즈 10문제**: 공통 부품 `DH.quiz`. 영상 순서대로. 정답 위치가 한쪽에 몰리지 않게 섞고, 답하면 바로 해설. 그림 문제는 페이지의 계산으로 정답을 정하고, 맞지 않으면 콘솔 경고를 냅니다.
- **용어집**: `<div class="dh-gloss">` 안에 `<section><h3>단계</h3><dl><dt>용어 <span>영어 · 기본값</span></dt><dd>설명</dd>…</dl></section>`. 단계별로 묶고, 라이브러리 기본값과 공식을 적습니다.
- **영상 추출(`#export`)**: `window.DH_EXPORT`를 만듭니다(아래 '영상').

## 공통 부품 (`shared/`)

튜토리얼마다 따로 만들던 음성 해설·퀴즈·용어집을 한곳에 모았습니다. 고치면 모든 튜토리얼에 함께 반영되니, 바꾼 뒤에는 모든 튜토리얼을 확인하세요.

불러오기 (튜토리얼 스크립트보다 먼저)
```html
<link rel="stylesheet" href="../shared/components.css">   <!-- 튜토리얼 CSS보다 앞에 -->
<script src="../shared/narration.js"></script>
<script src="../shared/quiz.js"></script>
```

- **`DH.narration({ captions, read, rate, holdBefore })`** — `captions`는 `[{ start, end, text }]`(영상 전체 기준 초). 돌려받은 객체로
  - 재생 중 매 프레임: `T = narr.hold(T, T + dt * speed)` 다음 `narr.sync(T, playing)`
  - 일시정지·이동·재생 시작: `narr.reset()`
  - 단추: `DH.narration.bind(narr, 단추, 안내문, { onEnable() { if (!started) play(); } })` — 지원하지 않는 브라우저면 단추를 숨김
  - `**`, ①~⑤, →, …, ·, ×, ÷ 같은 기호 읽기는 부품이 처리합니다. `read`에는 그 튜토리얼의 약어만 `[[정규식, '읽는 법']]`으로.
  - 추출 모드에서는 만들지 말고 `{ supported: false, reset() {}, hold: (T, n) => n, sync() {} }` 같은 빈 객체를 씁니다(템플릿 참고).
- **`DH.quiz({ list, score, reset, done, questions })`** — 문제는 `{ q, opts, a, why }`. 그림 문제는 `figure: { width, height, label, draw(g, st), pick(x, y) }`를 더합니다. `draw`는 논리 좌표로 그리고 `st = { done, pick, answer, hover }`를 보고 정답/오답/마우스 올림을 표시합니다. `pick`은 좌표 → 보기 번호(없으면 -1).
- **색과 글꼴**: 공통 CSS는 아래 변수만 씁니다. 튜토리얼 `:root`에서 자기 토큰에 연결하면 밝은/어두운 테마를 따라갑니다.
  ```css
  --dh-text --dh-muted --dh-surface --dh-surface-2 --dh-line --dh-accent --dh-ok --dh-no --dh-display --dh-mono
  ```
- 부품 함수는 클래식 스크립트 전역 `window.DH`에 붙습니다(`type="module"`을 쓰지 않는 원칙 때문).

## 디자인

- 튜토리얼마다 고유한 시각 정체성을 가져도 됩니다(글꼴·색). 다만 페이지 바탕은 밝은/어두운 테마 토큰을 모두 정의하고(`:root`, `@media (prefers-color-scheme: dark)` + `:root:not([data-theme="light"])`, `:root[data-theme="dark"]`), 영상 무대는 항상 어둡게 둡니다.
- 사이트 첫 화면과 상단 바는 `assets/site.css`의 토큰(인장 붉은색 강조, Hahmlet + IBM Plex Sans KR)을 씁니다.
- 휴대폰 너비 390px에서 가로 스크롤이 생기면 안 됩니다. 캔버스 속 작은 글씨는 좁은 화면에서 키우거나 캔버스 밖 글로 보여 줍니다.
- 이모지 대신 직접 그린 아이콘(SVG/캔버스)을 씁니다. 환경마다 이모지 글꼴이 달라 영상 결과가 바뀌기 때문입니다.

## 영상

- 공통 렌더러 `tools/render-video.cjs`가 페이지를 `<slug>/index.html#export`로 열고 프레임마다 그려 ffmpeg로 넘깁니다. 1920×1080, 30fps, 자막은 그림에 들어가고, 장 표시(MP4 메타데이터)와 `.srt` 자막 원고도 만듭니다.
  ```bash
  node tools/render-video.cjs <slug>                     # → <slug>/video/<slug>.mp4 + .srt
  node tools/render-video.cjs <slug> --from 20 --to 34   # 구간만 (--out 경로.mp4, --fps, --crf)
  node tools/render-video.cjs <slug> --frames 6.2,100    # 몇 장면만 JPEG로 → frames/<slug>/ (git에 안 들어감)
  node tools/render-video.cjs <slug> --poster 26         # 카드 미리보기 → <slug>/docs/poster.jpg
  ```
- **`DH_EXPORT` 약속**: `#export`로 열렸을 때 페이지가 만듭니다.
  ```js
  window.DH_EXPORT = {
    title: '영상 제목',                    // MP4 메타데이터
    duration: 초,
    chapters: [{ title, start }],         // MP4 장 표시
    captions: [{ start, end, text }],     // .srt 원고 (**굵게** 표시는 지움)
    ready: () => Promise,                 // 글꼴 준비가 끝나면 풀림 (캔버스 글자에 쓰는 문자를 모두 document.fonts.load로)
    frame: (t, fps, quality) => 'data:image/jpeg;base64,…',   // t초 장면, 1920×1080, 자막 포함
  };
  ```
  추출 모드에서는 상단 바·플레이어 단추·놀이터를 만들지 않고, 같은 t에 언제나 같은 그림을 돌려줘야 합니다.
- 기존 튜토리얼의 자체 렌더러도 그대로 동작합니다: `network-analysis/tools/render-video.cjs`(`?render`), `bertopic/tools/render-video.mjs`.
- 프록시 환경에서 헤드리스 브라우저가 Google Fonts 인증서를 믿지 못하면, 렌더러가 글꼴 요청을 Node `fetch`로 대신 받아 넘깁니다(`NODE_USE_ENV_PROXY=1`과 함께 실행). TLS 검증을 끄지 마세요.
- 새 MP4는 되도록 GitHub Releases에 올리고 `catalog.js`의 `video`에 그 주소를 적습니다(저장소가 무거워지지 않게). **Git LFS는 쓰지 마세요** — GitHub Pages가 LFS 파일을 내보내지 못합니다. 기존 두 영상은 커밋 기록에 이미 들어 있어 그대로 둡니다.

## 확인 (커밋 전에)

헤드리스 Chromium(Playwright, `/opt/pw-browsers`)으로:
- 콘솔 오류 0개. 재생, 장 이동, 직접 해 보기, 놀이터, 퀴즈를 실제로 눌러 봄.
- 단추는 **사람 속도로** 눌러 확인: 화면에 보이게 스크롤한 뒤 단추 한가운데에서 `mouse.down()` → 0.15초 기다림 → `mouse.up()`. `page.click()`은 즉시 누르고 떼서 위 같은 문제를 놓칩니다. 재생 중 일시정지, 다시 재생 둘 다 확인.
- 음성 해설: `speechSynthesis`를 가짜로 바꿔(`page.addInitScript`) 느리게 읽힐 때 영상이 자막 끝에서 기다리는지 확인.
- 데스크톱 1280px·휴대폰 390px, 밝은·어두운 테마 화면을 찍어 겹침·잘림 확인. 390px에서 `scrollWidth === innerWidth`.
- 사이트 쪽이나 공통 부품만 바꿨다면 추출 프레임이 바꾸기 전과 바이트 단위로 같은지 비교(`cmp`): `node tools/render-video.cjs <slug> --frames …`를 바꾸기 전후로 뽑아 비교.
- 공통 부품(`shared/`)을 바꿨다면 모든 튜토리얼과 `_template/`에서 퀴즈(그림 문제 포함)와 음성 해설을 다시 확인.
- 첫 화면(`index.html`)에서 새 카드가 보이고, 상단 바의 '다른 튜토리얼' 메뉴로 오갈 수 있는지.

## 배포

- `main` 브랜치의 루트를 GitHub Pages로 내보냅니다(Settings → Pages → Deploy from a branch → `main` / `(root)`). 주소: `https://vadoro.github.io/dh_tutorials/`
- 커밋 메시지는 한국어로, 무엇을 왜 바꿨는지 적습니다.
