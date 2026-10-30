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
 * added     처음 올린 날짜 (YYYY-MM-DD)
 *
 * fetch() 대신 스크립트로 읽기 때문에 index.html을 더블클릭해 열어도 동작합니다.
 */
window.DH_CATALOG = {
  site: {
    title: 'DH 튜토리얼',
    repo: 'https://github.com/vadoro/dh_tutorials',
    // 방문자 통계 (assets/stats.js). goatcounter에 GoatCounter 코드를 적으면 켜지고, host 주소에서 연 페이지만 셉니다.
    stats: { goatcounter: 'dh-tutorials', host: 'vadoro.github.io' },
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
      added: '2026-10-02',
    },
    {
      slug: 'tf-idf',
      title: '단어의 무게, 문서의 거리',
      topic: 'TF-IDF · 문서 유사도',
      summary: '고전 소설 여섯 편의 줄거리로 TF, IDF, TF-IDF를 계산해 문서마다 독특한 단어를 찾고, 문서를 벡터로 바꿔 코사인 유사도와 유클리드 거리로 문서 사이의 관계를 재 봅니다.',
      length: '5:56',
      scenes: 11,
      features: ['음성 해설', '장면별 실습', '놀이터', '퀴즈', '용어집', '파이썬 예제'],
      tags: ['텍스트 데이터'],
      thumb: 'tf-idf/docs/poster.jpg',
      added: '2026-10-05',
    },
    {
      slug: 'sentiment-analysis',
      title: '글에 담긴 마음',
      topic: '감정분석',
      summary: '감성 사전과 부정·강조·대조 규칙으로 점수를 매기는 법, 나이브 베이즈로 서평에서 낱말의 무게를 배우는 법, 시험 데이터로 정확도를 재는 법, 흥부전의 감정 곡선까지 따라갑니다.',
      length: '5:26',
      scenes: 10,
      features: ['음성 해설', '장면별 실습', '놀이터', '퀴즈', '용어집', '파이썬 예제'],
      tags: ['텍스트 데이터'],
      thumb: 'sentiment-analysis/docs/poster.jpg',
      added: '2026-10-29',
    },
    {
      slug: 'word-embedding',
      title: '단어를 지도 위에',
      topic: '워드 임베딩',
      summary: '원-핫 인코딩에서 출발해 분포 가설, 함께 나오는 단어 세기, word2vec 학습을 따라가며 단어를 짧은 벡터로 바꾸고, 가까운 단어와 유추(조선 : 한양 = 고려 : ?), 한계와 디지털 인문학 활용까지 살펴봅니다.',
      length: '6:14',
      scenes: 11,
      features: ['음성 해설', '장면별 실습', '놀이터', '퀴즈', '용어집', '파이썬 예제'],
      tags: ['텍스트 데이터'],
      thumb: 'word-embedding/docs/poster.jpg',
      added: '2026-10-30',
    },
  ],
};
