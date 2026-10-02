/* DH 튜토리얼 목록 — 사이트 첫 화면과 각 튜토리얼 위의 상단 바가 이 목록을 함께 씁니다.
 * 새 튜토리얼을 만들면 아래 tutorials 배열에 항목 하나를 추가하세요. (CLAUDE.md 참고)
 *
 * slug      폴더 이름이자 주소. 예: network-analysis → network-analysis/index.html
 * title     튜토리얼 이름
 * topic     다루는 분석 방법 (카드 위 작은 글씨)
 * summary   한두 문장 소개
 * length    영상 길이 (분:초)
 * scenes    장면 수
 * features  카드에 칩으로 보여 줄 기능
 * tags      첫 화면에서 거르는 데 쓰는 데이터 종류 (예: 관계 데이터, 텍스트 데이터, 이미지, 공간 데이터)
 * thumb     16:9 미리보기 그림 (사이트 루트 기준 경로)
 * video     MP4 파일 경로 또는 주소 (없으면 null)
 * added     처음 올린 날짜 (YYYY-MM-DD)
 *
 * fetch() 대신 스크립트로 읽기 때문에 index.html을 더블클릭해 열어도 동작합니다.
 */
window.DH_CATALOG = {
  site: {
    title: 'DH 튜토리얼',
    repo: 'https://github.com/vadoro/dh_tutorials',
  },
  tutorials: [
    {
      slug: 'network-analysis',
      title: '점과 선의 과학',
      topic: '네트워크 분석',
      summary: '노드와 링크에서 출발해 연결정도, 경로, 밀도, 네 가지 중심성, 군집 계수, 커뮤니티, 네트워크 모델까지. 관계의 구조를 점과 선으로 읽는 법을 배웁니다.',
      length: '6:57',
      scenes: 13,
      features: ['음성 해설', '장면별 실습', '놀이터', '퀴즈', '용어집', '파이썬 예제'],
      tags: ['관계 데이터'],
      thumb: 'network-analysis/docs/poster.jpg',
      video: 'network-analysis/video/network-analysis.mp4',
      added: '2026-10-01',
    },
    {
      slug: 'bertopic',
      title: 'BERTopic 토픽 지도',
      topic: '토픽 모델링',
      summary: '문서 더미가 임베딩, UMAP, HDBSCAN, c-TF-IDF를 거쳐 이름 붙은 토픽 지도가 되기까지. 짧은 한국어 문장 90개로 한 단계씩 따라갑니다.',
      length: '3:46',
      scenes: 9,
      features: ['음성 해설', '장면별 실습', '놀이터', '퀴즈', '용어집'],
      tags: ['텍스트 데이터'],
      thumb: 'bertopic/docs/poster.jpg',
      video: 'bertopic/video/bertopic-explainer.mp4',
      added: '2026-10-02',
    },
  ],
};
