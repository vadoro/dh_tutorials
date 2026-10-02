# DH 튜토리얼 — 작업 규칙

디지털 인문학 연구에 쓰는 데이터 분석 방법을 **인터랙티브 모션그래픽 영상**으로 설명하는 튜토리얼 모음입니다.
튜토리얼 하나 = 폴더 하나이고, 사이트 첫 화면(`index.html`)이 목록을 보여 줍니다. 이 문서는 새 튜토리얼을 추가하거나 고칠 때 지킬 규칙입니다.

## 구조

```
index.html              사이트 첫 화면 (카드 목록, assets/catalog.js를 읽어 그림)
assets/catalog.js       튜토리얼 목록 — 첫 화면과 상단 바가 함께 씀 (단일 출처)
assets/site-bar.js      각 튜토리얼 위에 붙는 공통 상단 바 (섀도 DOM, 추출 화면에서는 안 붙음)
assets/site.css         사이트 페이지 디자인 토큰(밝은/어두운 테마)
<slug>/index.html       튜토리얼 본체. 폴더 안에서 완결됨
<slug>/docs/poster.jpg  카드 미리보기 그림 1280×720
<slug>/video/*.mp4      수업용 영상 (자막 포함, 장 표시)
<slug>/tools/           그 튜토리얼의 영상 렌더러 등
.nojekyll               GitHub Pages가 _로 시작하는 폴더도 그대로 내보내도록
```

지금 있는 튜토리얼
- `network-analysis/` 점과 선의 과학 — 여러 파일(`assets/js/*.js`), 장면은 `scenes-a.js`, `scenes-b.js`
- `bertopic/` BERTopic 토픽 지도 — `index.html` 한 파일에 모두 들어 있음

두 폴더는 원래 `vadoro/network_tutorial`, `vadoro/bertopic_tutorial` 저장소였고 `git subtree`로 커밋 기록과 함께 옮겼습니다.

## 지킬 원칙

- **빌드 없는 정적 파일.** 번들러·프레임워크·npm 의존성 없이 HTML/CSS/JS만. `index.html`을 더블클릭해도 동작해야 합니다.
  - 그래서 `type="module"`, `fetch()`로 같은 저장소의 JSON 읽기는 쓰지 않습니다(file://에서 막힘). 데이터는 `<script>`로 읽는 JS 파일에 둡니다.
  - 경로는 모두 상대 경로. 튜토리얼 안에서 사이트 공통 파일은 `../assets/…`.
  - 링크는 폴더가 아니라 `…/index.html`까지 적습니다(로컬 파일로 열 때 폴더 목록이 뜨지 않도록).
- **외부 자원은 Google Fonts 글꼴만.** 스크립트·그림은 저장소 안에 둡니다. 글꼴이 없어도 깨지지 않게 대체 글꼴을 꼭 적습니다.
- **쉬운 한국어.** 대상은 처음 배우는 학생입니다. 문장은 짧게, 전문 용어는 처음 나올 때 풀어서, 영어 이름은 괄호로 함께. 말투는 기존 튜토리얼처럼 "~예요/~해요".
- **진짜 계산과 비유를 구분해 밝히기.** 페이지가 실제로 계산하는 값(중심성, HDBSCAN, c-TF-IDF 등)과 설명용으로 흉내 낸 부분을 README와 화면 각주에 적습니다. 숫자·기본값·공식은 공식 문서와 맞는지 확인합니다(필요하면 파이썬으로 같은 값을 재현해 확인).
- **원래 화면을 유지.** 공통 상단 바나 사이트 쪽 변경이 영상 추출 결과를 바꾸면 안 됩니다. `site-bar.js`는 `#export`, `?render`일 때 아무것도 하지 않습니다.

## 새 튜토리얼 추가 절차

1. `<slug>/` 폴더를 만들고 `index.html`을 둡니다. slug는 영어 소문자와 `-` (예: `word-embedding`).
2. `<body>` 바로 다음에 공통 상단 바를 넣습니다.
   ```html
   <script src="../assets/catalog.js"></script>
   <script src="../assets/site-bar.js" data-slug="<slug>"></script>
   ```
3. `assets/catalog.js`의 `tutorials` 배열에 항목을 추가합니다(필드 설명은 파일 맨 위).
4. `<slug>/docs/poster.jpg`(1280×720) 미리보기를 만듭니다. 렌더러로 대표 장면 한 프레임을 뽑아 씁니다.
5. 영상을 렌더링해 `<slug>/video/`에 둡니다(아래 '영상' 참고).
6. `<slug>/README.md`에 장면 구성, 조작법, 진짜 계산/비유 구분, 영상 다시 만드는 법을 적습니다.
7. 루트 `README.md`의 튜토리얼 표에 한 줄 추가합니다.
8. 아래 '확인'을 모두 통과시킨 뒤 커밋합니다.

## 튜토리얼 페이지가 갖출 것

기존 두 튜토리얼이 모범 예시입니다. 새로 만들 때 둘 중 더 가까운 쪽 구조를 따라 하세요.

- **영상 플레이어**: 캔버스 무대(16:9, 논리 좌표 1280×720), 재생/일시정지, 진행 막대와 장 눈금, 장 목록, 속도, 자막 켜기/끄기, 전체 화면, 단축키(스페이스, ← →, C, F, V).
  - 그림은 **시간 t만의 함수**로 그립니다. 같은 t면 언제나 같은 그림(난수는 시드 고정, 예: mulberry32). 그래야 되감기와 MP4 추출이 정확합니다.
  - 장면 정의 예: `network-analysis/assets/js/scenes-a.js` 맨 위 주석, `bertopic/index.html`의 `CHAPTERS`/`CAPTIONS`.
- **자막**: `[시작 초, (끝 초,) '문장']`. 한 자막은 4~7초 분량. `**굵게**`나 강조 표시는 튜토리얼 방식을 따름.
- **음성 해설(V)**: 브라우저 `speechSynthesis`로 자막을 읽고, 다 읽을 때까지 그 자막 끝에서 영상이 기다립니다.
  - 핵심 동작: 자막이 바뀌면 읽기 시작 → 재생 중 시간을 올릴 때 `읽는 중이면 현재 자막 끝 - 0.05초를 넘지 않게` 막기 → 일시정지·이동하면 `cancel()` → 다시 재생하면 지금 자막을 처음부터 읽기 → `onend`가 안 오는 경우를 대비한 시간 제한.
  - 한국어 음성 고르기, 약어 읽기 변환(예: c-TF-IDF → "씨 티에프 아이디에프", ① → "첫째,"), 한국어 음성이 없을 때 안내 문구.
  - 구현 예: `bertopic/index.html`의 "8. 음성 해설", `network-analysis/assets/js/player.js`.
- **장면별 '직접 해 보기'**: 지금 장면에 맞춰 바뀌는 패널. 사용자가 조작하면 영상은 멈추고, 재생하면 영상 흐름으로 돌아갑니다.
- **놀이터**: 영상의 핵심 계산을 사용자가 직접 바꿔 보는 곳. 결과 표와 "지금 설정을 코드로" 보기를 함께 둡니다.
- **퀴즈 10문제**: 영상 순서대로. 정답 위치가 한쪽에 몰리지 않게 섞고, 답하면 바로 해설. 그림 문제는 페이지의 계산으로 정답을 확인합니다(맞지 않으면 콘솔 경고).
- **용어집**: 단계별로 묶고, 라이브러리 기본값과 공식을 적습니다.

## 디자인

- 튜토리얼마다 고유한 시각 정체성을 가져도 됩니다(글꼴·색). 다만 페이지 바탕은 밝은/어두운 테마 토큰을 모두 정의하고(`:root`, `@media (prefers-color-scheme: dark)` + `:root:not([data-theme="light"])`, `:root[data-theme="dark"]`), 영상 무대는 항상 어둡게 둡니다.
- 사이트 첫 화면과 상단 바는 `assets/site.css`의 토큰(인장 붉은색 강조, Hahmlet + IBM Plex Sans KR)을 씁니다.
- 휴대폰 너비 390px에서 가로 스크롤이 생기면 안 됩니다. 캔버스 속 작은 글씨는 좁은 화면에서 키우거나 캔버스 밖 글로 보여 줍니다.
- 이모지 대신 직접 그린 아이콘(SVG/캔버스)을 씁니다. 환경마다 이모지 글꼴이 달라 영상 결과가 바뀌기 때문입니다.

## 영상

- 각 튜토리얼의 렌더러가 페이지를 추출 모드(`#export` 또는 `?render`)로 열고 프레임마다 그려 ffmpeg로 넘깁니다. 1920×1080, 30fps, 자막 포함.
  - `network-analysis`: `node tools/render-video.cjs` (장 표시와 `.srt` 자막 원고도 만듦)
  - `bertopic`: `node tools/render-video.mjs video/bertopic-explainer.mp4 30` (`FRAMES="6.2,100"`으로 몇 장면만 그림으로 확인)
- 프록시 환경에서 헤드리스 브라우저가 Google Fonts 인증서를 믿지 못하면, 두 렌더러 모두 글꼴 요청을 Node `fetch`가 대신 받아 넘깁니다(`NODE_USE_ENV_PROXY=1`과 함께 실행). TLS 검증을 끄지 마세요.
- 새 MP4는 되도록 GitHub Releases에 올리고 `catalog.js`의 `video`에 그 주소를 적습니다(저장소가 무거워지지 않게). **Git LFS는 쓰지 마세요** — GitHub Pages가 LFS 파일을 내보내지 못합니다. 기존 두 영상은 커밋 기록에 이미 들어 있어 그대로 둡니다.

## 확인 (커밋 전에)

헤드리스 Chromium(Playwright, `/opt/pw-browsers`)으로:
- 콘솔 오류 0개. 재생, 장 이동, 직접 해 보기, 놀이터, 퀴즈를 실제로 눌러 봄.
- 음성 해설: `speechSynthesis`를 가짜로 바꿔(`page.addInitScript`) 느리게 읽힐 때 영상이 자막 끝에서 기다리는지 확인.
- 데스크톱 1280px·휴대폰 390px, 밝은·어두운 테마 화면을 찍어 겹침·잘림 확인. 390px에서 `scrollWidth === innerWidth`.
- 사이트 쪽만 바꿨다면 추출 프레임이 바꾸기 전과 바이트 단위로 같은지 비교(`cmp`).
- 첫 화면(`index.html`)에서 새 카드가 보이고, 상단 바의 '다른 튜토리얼' 메뉴로 오갈 수 있는지.

## 배포

- `main` 브랜치의 루트를 GitHub Pages로 내보냅니다(Settings → Pages → Deploy from a branch → `main` / `(root)`). 주소: `https://vadoro.github.io/dh_tutorials/`
- 커밋 메시지는 한국어로, 무엇을 왜 바꿨는지 적습니다.
