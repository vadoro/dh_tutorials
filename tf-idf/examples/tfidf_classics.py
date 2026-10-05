"""TF-IDF 튜토리얼의 숫자를 파이썬으로 다시 계산합니다.

    pip install scikit-learn
    python examples/tfidf_classics.py

classics.tsv의 nouns 칸은 줄거리에서 명사만 골라 띄어쓰기로 이어 붙인 것입니다.
(실제 연구에서는 Kiwi, Okt 같은 형태소 분석기로 명사를 고릅니다.)

1) 교과서 공식  tf × ln(N/df)  — 영상과 같은 값
2) scikit-learn TfidfVectorizer 기본값  tf × (ln((1+N)/(1+df)) + 1)  — 놀이터에서 'scikit-learn 기본'을 고른 값
둘 다 마지막에 벡터 길이를 1로 맞춥니다(L2 정규화).
"""
import csv
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity, euclidean_distances

rows = list(csv.DictReader(open(Path(__file__).with_name("classics.tsv"), encoding="utf-8"), delimiter="\t"))
titles = [r["title"] for r in rows]
docs = [r["nouns"] for r in rows]


def show_top(X, vocab, k=3):
    # 점수가 같으면 그 문서에서 먼저 나온 단어가 앞 (페이지와 같은 순서)
    col = {w: i for i, w in enumerate(vocab)}
    for title, doc, row in zip(titles, docs, np.asarray(X)):
        words = list(dict.fromkeys(doc.split()))
        words.sort(key=lambda w: -row[col[w]])
        print(f"  {title:6}", " · ".join(f"{w} {row[col[w]]:.3f}" for w in words[:k]))


def show_matrix(name, A):
    print(f"\n{name}")
    print("        " + " ".join(f"{t[:3]:>6}" for t in titles))
    for t, row in zip(titles, A):
        print(f"  {t[:3]:6}" + " ".join(f"{x:6.3f}" for x in row))


# 이미 명사로 나눴으므로 띄어쓰기로만 자릅니다.
# 기본 토큰 규칙(token_pattern)은 두 글자 이상만 남겨서 '옥', '눈', '박' 같은 한 글자 명사를 버립니다.
counter = CountVectorizer(analyzer=str.split)
tf = counter.fit_transform(docs).toarray().astype(float)
vocab = counter.get_feature_names_out()
N = len(docs)
df = (tf > 0).sum(axis=0)

# 1) 교과서 공식: 모든 문서에 나오는 '이야기'는 IDF가 0
idf = np.log(N / df)
W = tf * idf                                         # 정규화 전 TF-IDF
U = W / np.linalg.norm(W, axis=1, keepdims=True)     # 길이 1로 맞춘 벡터
print("교과서 공식 tf × ln(N/df) — 문서마다 TF-IDF가 가장 큰 단어 (정규화 전 점수)")
show_top(W, vocab)
show_matrix("코사인 유사도", cosine_similarity(W))
show_matrix("유클리드 거리 (정규화 전) — 짧은 문서끼리 가까워 보임", euclidean_distances(W))
show_matrix("유클리드 거리 (길이 1로 맞춘 뒤) = √(2 − 2 × 코사인)", euclidean_distances(U))

# 길이만 세 배인 문서: 학습한 IDF로 벡터화 (scikit-learn의 transform과 같은 생각)
long3 = counter.transform([" ".join([docs[0]] * 3)]).toarray() * idf
print(f"\n춘향전을 세 번 이어 붙인 문서 ↔ 춘향전: 코사인 {cosine_similarity(long3, W[:1])[0, 0]:.3f}, "
      f"유클리드 거리 {euclidean_distances(long3, W[:1])[0, 0]:.3f} (다른 어느 소설보다 멂)")

# 2) scikit-learn 기본값: smooth_idf=True, norm="l2"
vec = TfidfVectorizer(analyzer=str.split)
X = vec.fit_transform(docs)
print("\nscikit-learn TfidfVectorizer 기본값 — 길이 1로 맞춘 점수")
show_top(X.toarray(), vec.get_feature_names_out())
show_matrix("코사인 유사도 (scikit-learn 기본값)", cosine_similarity(X))
