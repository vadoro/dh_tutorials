"""워드 임베딩 튜토리얼의 숫자를 파이썬으로 다시 계산합니다.

    python examples/embedding_basics.py          # 설치할 것 없음 (파이썬 표준 라이브러리만)
    pip install gensim                           # 맨 아래 gensim 예시까지 보려면 (gensim 4)

1) 동시 출현: 창 크기 2 안의 이웃 낱말을 세어 단어마다 한 줄 → 줄끼리 코사인 유사도
2) word2vec 스킵그램 + 네거티브 샘플링: 페이지(assets/js/embedding.js)와 똑같은 순서로 계산해서
   같은 벡터가 나옵니다(시드를 고정한 mulberry32 난수).
   word2vec의 방법을 따르되 작게 줄였어요. 창 크기를 무작위로 줄이지 않고, 흔한 낱말 덜어 내기(sample)도 하지 않아요.
3) 가까운 단어, 유추(b − a + c), 2차원 지도(PCA)

말뭉치(corpus.tsv)는 설명을 위해 만든 52문장입니다. lemmas 칸은 형태소 분석기가 고른 것처럼 적은 낱말 원형이에요.
실제 연구에서는 수만 문장 이상과 형태소 분석기(Kiwi, Okt 등), gensim 같은 라이브러리를 쓰세요.
"""
import csv
import math
from pathlib import Path

HERE = Path(__file__).parent
ROWS = list(csv.DictReader(open(HERE / "corpus.tsv", encoding="utf-8"), delimiter="\t"))
SENTS = [r["lemmas"].split() for r in ROWS]

VOCAB = []
for s in SENTS:
    for w in s:
        if w not in VOCAB:
            VOCAB.append(w)
INDEX = {w: i for i, w in enumerate(VOCAB)}
COUNT = [sum(s.count(w) for s in SENTS) for w in VOCAB]
CONFIG = dict(dim=8, window=2, negative=5, epochs=200, alpha=0.05, min_alpha=0.0001, seed=7)


def is_noun(w):
    """‘다’로 끝나는 원형은 동사·형용사로 봄 (바다는 예외)"""
    return not w.endswith("다") or w == "바다"


def dot(a, b):
    s = 0.0
    for x, y in zip(a, b):
        s += x * y
    return s


def norm(a):
    return math.sqrt(dot(a, a))


def cos(a, b):
    n = norm(a) * norm(b)
    return dot(a, b) / n if n else 0.0


def unit(a):
    n = norm(a) or 1.0
    return [x / n for x in a]


def mulberry32(a):
    """페이지와 같은 난수 (32비트 정수 연산)"""
    state = [a & 0xFFFFFFFF]

    def rnd():
        state[0] = (state[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = state[0]
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return rnd


def neighbors(s, i, win):
    return [j for j in range(max(0, i - win), min(len(s) - 1, i + win) + 1) if j != i]


# ---------- 1. 동시 출현 행렬 ----------
def cooc(win=2):
    M = [[0] * len(VOCAB) for _ in VOCAB]
    for s in SENTS:
        for i, w in enumerate(s):
            for j in neighbors(s, i, win):
                M[INDEX[w]][INDEX[s[j]]] += 1
    return M


# ---------- 2. word2vec: 스킵그램 + 네거티브 샘플링 ----------
def train(dim=8, window=2, negative=5, epochs=200, alpha=0.05, min_alpha=0.0001, seed=7):
    rnd = mulberry32(seed)
    V = len(VOCAB)
    W = [[(rnd() - 0.5) / dim for _ in range(dim)] for _ in range(V)]   # 입력 벡터 = 임베딩
    C = [[0.0] * dim for _ in range(V)]                                 # 출력 벡터
    Z = sum(c ** 0.75 for c in COUNT)
    cum, acc = [], 0.0
    for c in COUNT:
        acc += c ** 0.75 / Z
        cum.append(acc)

    def sample():                      # 가짜 이웃: 빈도^0.75에 비례해 뽑기
        x, lo, hi = rnd(), 0, V - 1
        while lo < hi:
            m = (lo + hi) // 2
            if cum[m] < x:
                lo = m + 1
            else:
                hi = m
        return lo

    per_epoch = sum(len(neighbors(s, i, window)) for s in SENTS for i in range(len(s)))
    total, step = per_epoch * epochs, 0
    for _ in range(epochs):
        for s in SENTS:
            for i, w in enumerate(s):
                v = W[INDEX[w]]
                for j in neighbors(s, i, window):
                    lr = alpha - (alpha - min_alpha) * step / total
                    step += 1
                    ctx = INDEX[s[j]]
                    targets = [(ctx, 1.0)]
                    for _ in range(negative):
                        t = sample()
                        if t != ctx:
                            targets.append((t, 0.0))
                    grad = [0.0] * dim
                    for t, label in targets:
                        u = C[t]
                        g = (label - 1 / (1 + math.exp(-dot(v, u)))) * lr   # 진짜 이웃은 당기고, 가짜는 밀어냄
                        for k in range(dim):
                            grad[k] += g * u[k]
                        for k in range(dim):
                            u[k] += g * v[k]
                    for k in range(dim):
                        v[k] += grad[k]
    return W


def similar(W, w, k=5, nouns=True):
    v = W[INDEX[w]]
    out = [(cos(v, W[INDEX[x]]), x) for x in VOCAB if x != w and (not nouns or is_noun(x))]
    return sorted(out, reverse=True)[:k]


def analogy(W, a, b, c, k=3, nouns=True):
    """a : b = c : ?  →  b − a + c 에 가장 가까운 단어"""
    A, B, Cc = unit(W[INDEX[a]]), unit(W[INDEX[b]]), unit(W[INDEX[c]])
    q = [y - x + z for x, y, z in zip(A, B, Cc)]
    out = [(cos(q, W[INDEX[x]]), x) for x in VOCAB if x not in (a, b, c) and (not nouns or is_noun(x))]
    return sorted(out, reverse=True)[:k]


def pca2(rows, orient=None):
    """단위 길이로 맞추고 평균을 뺀 뒤 거듭제곱법으로 두 축 (페이지와 같은 순서)"""
    X = [unit(r) for r in rows]
    n, d = len(X), len(X[0])
    mean = [sum(r[k] for r in X) / n for k in range(d)]
    X = [[x - m for x, m in zip(r, mean)] for r in X]
    S = [[sum(X[i][j] * X[i][k] for i in range(n)) / n for k in range(d)] for j in range(d)]
    trace = sum(S[k][k] for k in range(d))
    axes, ratios = [], []
    for c in range(2):
        v = [1 + k / d for k in range(d)]
        for _ in range(1000):
            nv = [sum(S[j][k] * v[k] for k in range(d)) for j in range(d)]
            nn = norm(nv) or 1.0
            v = [x / nn for x in nv]
        lam = sum(v[j] * sum(S[j][k] * v[k] for k in range(d)) for j in range(d))
        for j in range(d):
            for k in range(d):
                S[j][k] -= lam * v[j] * v[k]
        proj = [dot(r, v) for r in X]
        if orient and orient[c]:
            flip = proj[orient[c][0]] < proj[orient[c][1]]
        else:
            big = 0.0
            for p in proj:
                if abs(p) > abs(big):
                    big = p
            flip = big < 0
        if flip:
            v = [-x for x in v]
        axes.append(v)
        ratios.append(lam / trace)
    return [(dot(r, axes[0]), dot(r, axes[1])) for r in X], ratios


def main():
    print(f"단어 {len(VOCAB)}개, 문장 {len(SENTS)}개, 낱말 {sum(COUNT)}개")

    M = cooc(CONFIG["window"])
    row = lambda w: M[INDEX[w]]
    print("\n[동시 출현, 창 크기 2]")
    print(f"  '왕'과 '임금'이 이웃으로 나온 횟수: {M[INDEX['왕']][INDEX['임금']]}")
    print(f"  코사인 유사도  왕–임금 {cos(row('왕'), row('임금')):.2f}   왕–사과 {cos(row('왕'), row('사과')):.2f}")

    W = train(**CONFIG)
    print("\n[word2vec 스킵그램, 8차원] 가까운 단어 (명사만)")
    for w in ["왕", "한양", "배", "사과"]:
        print(f"  {w}: " + ", ".join(f"{x} {s:.2f}" for s, x in similar(W, w)))
    print("\n[유추] 조선 : 한양 = 고려 : ?  →  " + ", ".join(f"{x} {s:.2f}" for s, x in analogy(W, "조선", "한양", "고려")))
    print("       신라 : 서라벌 = 고려 : ?  →  " + ", ".join(f"{x} {s:.2f}" for s, x in analogy(W, "신라", "서라벌", "고려")))

    words = ["조선", "고려", "신라", "한양", "개경", "서라벌"]
    pts, ratios = pca2([W[INDEX[w]] for w in words])
    print(f"\n[2차원 지도(PCA), 두 축이 담은 분산 {ratios[0]:.0%} + {ratios[1]:.0%}]")
    for w, (x, y) in zip(words, pts):
        print(f"  {w:<4} {x:+.2f} {y:+.2f}")

    # 실제로는 gensim으로. 난수가 달라 숫자는 페이지와 조금 다르지만 같은 경향이 나와요.
    # 이렇게 작은 말뭉치에서는 sample=0이 꼭 필요해요. 기본값(0.001)은 자주 나오는 낱말을 덜어 내는데,
    # 문장이 52개뿐이면 거의 모든 낱말이 ‘자주 나오는’ 낱말이 되어 학습할 거리가 사라져요.
    try:
        from gensim.models import Word2Vec
    except ImportError:
        print("\n(gensim이 없어 건너뜀: pip install gensim)")
        return
    model = Word2Vec(SENTS, vector_size=8, window=2, min_count=1, sg=1, negative=5, epochs=200,
                     alpha=0.05, sample=0, shrink_windows=False, seed=7, workers=1)
    print("\n[gensim Word2Vec]")
    print("  왕과 가까운 단어: " + ", ".join(f"{w} {s:.2f}" for w, s in model.wv.most_similar("왕", topn=4)))
    w, s = model.wv.most_similar(positive=["한양", "고려"], negative=["조선"], topn=1)[0]
    print(f"  조선 : 한양 = 고려 : ?  →  {w} {s:.2f}")


if __name__ == "__main__":
    main()
