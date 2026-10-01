"""영상에 나온 숫자를 NetworkX로 직접 계산해 보기

    pip install networkx
    python examples/basic_metrics.py                         # 영상 속 예제들
    python examples/basic_metrics.py examples/friends_edges.csv   # 내 엣지 리스트(CSV) 분석

CSV는 한 줄에 '노드1,노드2' 형식이고, 첫 줄이 source,target 이면 머리글로 봅니다.
"""
import csv
import sys

import networkx as nx


def show_table(G, title):
    """네 가지 중심성과 군집 계수를 표로 출력"""
    cent = {
        "연결정도": nx.degree_centrality(G),
        "근접": nx.closeness_centrality(G),
        "매개": nx.betweenness_centrality(G),
        "아이겐벡터": nx.eigenvector_centrality(G, max_iter=1000),
        "군집 계수": nx.clustering(G),
    }
    print(f"\n[{title}]")
    print(f"  노드 {G.number_of_nodes()}개, 링크 {G.number_of_edges()}개, 밀도 {nx.density(G):.3f}")
    print(f"  평균 군집 계수 {nx.average_clustering(G):.3f}")
    if nx.is_connected(G):
        print(f"  지름 {nx.diameter(G)}, 평균 경로 길이 {nx.average_shortest_path_length(G):.3f}")
    else:
        print(f"  연결 덩어리 {nx.number_connected_components(G)}개 (지름은 덩어리마다 따로 계산해야 해요)")
    header = "  " + "이름".ljust(6) + "".join(k.rjust(9) for k in cent)
    print(header)
    order = sorted(G.nodes, key=lambda v: -cent["매개"][v])
    for v in order:
        print("  " + str(v).ljust(6) + "".join(f"{cent[k][v]:9.2f}" for k in cent))
    for k in ("연결정도", "근접", "매개", "아이겐벡터"):
        best = max(cent[k].values())
        top = [str(v) for v in G.nodes if abs(cent[k][v] - best) < 1e-9]
        print(f"  → {k} 중심성 1위: {', '.join(top)}")


def show_communities(G):
    comms = nx.community.greedy_modularity_communities(G)
    q = nx.community.modularity(G, comms)
    print(f"  커뮤니티 {len(comms)}개, 모듈성 Q = {q:.2f}")
    for i, c in enumerate(comms, 1):
        print(f"    무리 {i}: {', '.join(sorted(map(str, c)))}")


def video_examples():
    # 07 중심성 — 크랙하트의 연(kite) 네트워크. 노드 번호를 영상 속 이름으로 바꿈
    names = ["지민", "서준", "하윤", "도윤", "수아", "예준", "서연", "민준", "지우", "하준"]
    kite = nx.relabel_nodes(nx.krackhardt_kite_graph(), dict(enumerate(names)))
    show_table(kite, "07 중심성: 연 네트워크")
    show_communities(kite)

    # 민준을 빼면?
    cut = kite.copy()
    cut.remove_node("민준")
    print(f"  민준을 빼면 연결 덩어리 {nx.number_connected_components(cut)}개로 나뉩니다.")

    # 06 밀도 — 노드 5개, 링크 4개
    D = nx.Graph([(0, 1), (1, 2), (0, 3), (3, 4)])
    print(f"\n[06 밀도] 링크 4개 ÷ 가능한 링크 10개 = {nx.density(D):.1f}")

    # 08 군집 계수 — '나'와 친구 4명, 친구끼리 3쌍
    C = nx.Graph([("나", f) for f in ["서준", "하윤", "도윤", "수아"]])
    C.add_edges_from([("서준", "하윤"), ("하윤", "도윤"), ("서준", "도윤")])
    print(f"[08 군집 계수] '나'의 군집 계수 = {nx.clustering(C, '나'):.1f}")

    # 11 분석 흐름 — 영상 속 코드 그대로
    G = nx.Graph()
    G.add_edges_from([("지민", "서준"), ("서준", "하윤"),
                      ("하윤", "지민"), ("하윤", "도윤")])
    print("\n[11 영상 속 코드]")
    print("  밀도", round(nx.density(G), 2))
    print("  연결정도 중심성", {k: round(v, 2) for k, v in nx.degree_centrality(G).items()})
    print("  매개 중심성", {k: round(v, 2) for k, v in nx.betweenness_centrality(G).items()})


def load_csv(path):
    G = nx.Graph()
    with open(path, newline="", encoding="utf-8-sig") as f:
        for i, row in enumerate(csv.reader(f)):
            row = [c.strip() for c in row if c.strip()]
            if len(row) < 2:
                continue
            if i == 0 and row[0].lower() in ("source", "from", "node1", "출발", "노드1"):
                continue
            G.add_edge(row[0], row[1])
    return G


if __name__ == "__main__":
    if len(sys.argv) > 1:
        G = load_csv(sys.argv[1])
        show_table(G, sys.argv[1])
        show_communities(G)
    else:
        video_examples()
