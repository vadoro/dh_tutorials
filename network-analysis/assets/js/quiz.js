/* 퀴즈 — 객관식과 '노드 클릭' 문제. 화면은 사이트 공통 부품(../shared/quiz.js)이 그림 */
(function () {
  'use strict';
  const NA = window.NA;
  if (!NA || !window.DH || !window.DH.quiz || new URLSearchParams(location.search).has('render') || location.hash === '#export') return;
  const { U, C, D, G } = NA;
  const root = document.getElementById('quiz-list');
  if (!root) return;
  const W = 800, H = 360;

  // 노드 클릭 문제용 그래프
  const BRIDGE = {
    n: 9,
    E: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [4, 5], [4, 6], [5, 6], [5, 7], [6, 7], [5, 8], [6, 8], [7, 8]],
    P: [{ x: 110, y: 110 }, { x: 110, y: 250 }, { x: 240, y: 110 }, { x: 240, y: 250 }, { x: 400, y: 180 }, { x: 560, y: 110 }, { x: 560, y: 250 }, { x: 690, y: 110 }, { x: 690, y: 250 }],
  };
  const HUB = {
    n: 9,
    E: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 2], [3, 4], [6, 7], [7, 8], [5, 8]],
    P: [{ x: 360, y: 180 }, { x: 200, y: 80 }, { x: 140, y: 210 }, { x: 260, y: 300 }, { x: 420, y: 320 }, { x: 540, y: 250 }, { x: 470, y: 70 }, { x: 640, y: 80 }, { x: 680, y: 220 }],
  };
  const answerOf = (graph, fn) => {
    const v = fn(G.make(graph.n, graph.E));
    return v.indexOf(Math.max(...v));
  };

  // 노드를 누르는 그림: 번호가 적힌 노드, 답한 뒤에는 정답(초록)과 고른 것(빨강)을 표시
  function graphFigure(gr) {
    return {
      width: W, height: H,
      label: '노드에 1부터 ' + gr.n + '까지 번호가 붙은 네트워크 그림. 노드를 누르거나 아래 번호 단추로 답하세요.',
      draw(g, st) {
        g.fillStyle = C.bg;
        g.fillRect(0, 0, W, H);
        gr.E.forEach(([a, b]) => D.edge(g, gr.P[a].x, gr.P[a].y, gr.P[b].x, gr.P[b].y, { w: 3, color: C.edge }));
        gr.P.forEach((p, i) => {
          let fill = C.node;
          if (st.done && i === st.answer) fill = C.mint;
          else if (st.done && i === st.pick) fill = C.coral;
          D.node(g, p.x, p.y, 22, { fill, ring: st.hover === i ? 1 : 0, text: i + 1, textSize: 18 });
        });
      },
      pick: (x, y) => gr.P.findIndex((p) => U.dist(x, y, p.x, p.y) < 30),
    };
  }

  const QS = [
    { q: '네트워크를 이루는 두 가지 기본 요소는?', opts: ['노드와 링크', '행과 열', '점과 면', '표와 그래프'], a: 0, why: '노드(점)는 대상, 링크(선)는 대상 사이의 관계입니다.' },
    { q: '노드가 6개인 무방향 네트워크에서 만들 수 있는 링크는 최대 몇 개일까요?', opts: ['12개', '15개', '30개', '36개'], a: 1, why: 'n×(n−1)÷2 = 6×5÷2 = 15개입니다. 같은 쌍을 두 번 세지 않도록 2로 나눠요.' },
    { q: '그 네트워크에 실제 링크가 6개 있다면 밀도는?', opts: ['0.2', '0.4', '0.6', '1'], a: 1, why: '밀도 = 실제 링크 ÷ 가능한 링크 = 6 ÷ 15 = 0.4.' },
    { q: '이 네트워크에서 매개 중심성이 가장 높은 노드를 클릭하세요.', opts: BRIDGE.P.map((_, i) => String(i + 1)), figure: graphFigure(BRIDGE), a: answerOf(BRIDGE, G.betweenness), why: '가운데 노드는 친구가 4명뿐이지만, 왼쪽 무리와 오른쪽 무리를 오가는 모든 최단 경로가 이 노드를 지나갑니다.' },
    { q: 'SNS에서 내 계정의 "팔로워 수"에 해당하는 것은?', opts: ['out-degree', 'in-degree', '밀도', '군집 계수'], a: 1, why: '팔로워는 나에게 들어오는 링크이므로 in-degree, 팔로잉은 나가는 링크라 out-degree입니다.' },
    { q: '"내 친구들끼리도 서로 친구인 정도"를 나타내는 지표는?', opts: ['밀도', '매개 중심성', '군집 계수', '지름'], a: 2, why: '군집 계수 = 이웃끼리 실제 연결된 쌍 ÷ 가능한 쌍. 삼각형이 많을수록 높아집니다.' },
    { q: '이 네트워크에서 연결정도가 가장 높은 노드(허브)를 클릭하세요.', opts: HUB.P.map((_, i) => String(i + 1)), figure: graphFigure(HUB), a: answerOf(HUB, G.degree), why: '링크를 하나씩 세어 보면 가운데 노드가 6개로 가장 많습니다.' },
    { q: '인접 행렬이 대각선을 기준으로 대칭이라면, 그 네트워크는?', opts: ['방향 네트워크', '무방향 네트워크', '가중 네트워크', '연결되지 않은 네트워크'], a: 1, why: 'A와 B가 연결되면 B와 A도 연결된 것이므로 (A,B)칸과 (B,A)칸이 같습니다.' },
    { q: '새 노드가 인기 많은 노드에 더 잘 붙어서 허브가 생기는 모델은?', opts: ['무작위 네트워크', '작은 세상 네트워크', '척도 없는 네트워크', '완전 그래프'], a: 2, why: '바라바시–알버트의 선호적 연결(부익부)이 척도 없는 네트워크를 만듭니다.' },
    { q: '커뮤니티가 얼마나 잘 나뉘었는지 평가하는 점수는?', opts: ['모듈성', '밀도', '근접 중심성', '평균 경로 길이'], a: 0, why: '모듈성은 무리 안쪽 링크가 무작위로 기대되는 것보다 얼마나 많은지를 잽니다.' },
  ];

  DH.quiz({
    list: root,
    score: document.getElementById('quiz-score'),
    reset: document.getElementById('quiz-reset'),
    questions: QS,
    done: (ok, total) => ok === total ? '네트워크 분석의 기본 개념을 모두 이해했네요!' : ok >= 7 ? '거의 다 왔어요. 틀린 문제의 해설을 확인해 보세요.' : '영상의 해당 장면을 다시 보고 도전해 보세요.',
  });
})();
