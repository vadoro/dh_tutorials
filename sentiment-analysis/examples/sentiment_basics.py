"""감정분석 튜토리얼의 숫자를 파이썬으로 다시 계산합니다.

    pip install scikit-learn
    python examples/sentiment_basics.py

1) 감성 사전 + 규칙 (lexicon.tsv): 어절 앞부분이 사전 단어와 맞으면 점수를 쓰고,
   부정어(×−1), 강조어(×1.5, 약화어 ×0.5), 대조(‘하지만’, ‘~지만’ 앞 ×0.5, 뒤 ×1.5) 규칙을 적용
2) 나이브 베이즈 (reviews.tsv): scikit-learn MultinomialNB(alpha=1)로 학습하고 시험 서평 8개로 평가
   lemmas 칸은 어절 앞부분으로 고른 낱말 원형입니다(형태소 분석기 흉내).
3) 감정 곡선 (heungbu.txt): 문장마다 1)의 점수를 매기고 창 크기 3의 이동 평균

사전과 자료는 설명을 위해 만든 작은 예시입니다. 실제 연구에는 KNU 한국어 감성사전처럼
공개된 사전과 형태소 분석기(Kiwi, Okt 등), 더 큰 학습 데이터를 쓰세요.
"""
import csv
import math
import re
from pathlib import Path

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.naive_bayes import MultinomialNB

HERE = Path(__file__).parent

# ---------- 1. 감성 사전 + 규칙 ----------
LEXICON = {r["stem"]: float(r["score"]) for r in csv.DictReader(open(HERE / "lexicon.tsv", encoding="utf-8"), delimiter="\t")}
NEG_BEFORE = {"안", "못"}
NEG_AFTER = ("않", "못하", "못했", "못한", "못해", "아니", "없")
BOOST = {"정말": 1.5, "너무": 1.5, "아주": 1.5, "매우": 1.5, "진짜": 1.5, "엄청": 1.5, "무척": 1.5, "참": 1.5,
         "조금": 0.5, "약간": 0.5, "좀": 0.5, "다소": 0.5}
CONTRAST = {"하지만", "그러나", "그런데", "근데"}


def clean(word):
    return re.sub(r"^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9]+$", "", word)


def match(word, lex=LEXICON):
    """어절 앞부분과 가장 길게 맞는 사전 단어"""
    keys = [k for k in lex if word.startswith(k)]
    return max(keys, key=len) if keys else None


def score(text, neg=True, boost=True, contrast=True, lex=LEXICON):
    toks = [t for t in (clean(w) for w in text.split()) if t]
    ci, ci_word = -1, False                       # 마지막 대조 표시의 위치
    for i, t in enumerate(toks):
        if t in CONTRAST:
            ci, ci_word = i, True
        elif len(t) > 2 and t.endswith("지만"):
            ci, ci_word = i, False
    total = 0.0
    for i, t in enumerate(toks):
        key = match(t, lex)
        if not key:
            continue
        m = 1.0
        for j in range(i - 1, max(0, i - 2) - 1, -1):     # 앞의 두 어절까지
            p = toks[j]
            if neg and p in NEG_BEFORE:
                m *= -1
            elif boost and p in BOOST:
                m *= BOOST[p]
            elif match(p, lex):
                break
        nxt = toks[i + 1] if i + 1 < len(toks) else None
        if neg and nxt and nxt.startswith(NEG_AFTER):
            m *= -1
        if contrast and ci >= 0:
            if i < ci or (i == ci and not ci_word):
                m *= 0.5
            elif i > ci:
                m *= 1.5
        total += lex[key] * m
    return round(total, 6)


def label(x):
    return "pos" if x > 0 else "neg" if x < 0 else "neu"


def moving_average(xs, k=3):
    h = k // 2
    return [sum(xs[max(0, i - h): i + h + 1]) / len(xs[max(0, i - h): i + h + 1]) for i in range(len(xs))]


def main():
    for s in ["문장이 아름답고 결말이 감동적이다", "추천하지 않는다", "정말 재미있다", "문장은 아름답지만 이야기는 지루하다"]:
        print(f"{score(s):+.2f}  {s}")

    # ---------- 2. 나이브 베이즈 ----------
    rows = list(csv.DictReader(open(HERE / "reviews.tsv", encoding="utf-8"), delimiter="\t"))
    train = [r for r in rows if r["split"] == "train"]
    test = [r for r in rows if r["split"] == "test"]

    vec = CountVectorizer(analyzer=str.split)          # 이미 고른 낱말 원형을 띄어쓰기로 나눔
    X_train = vec.fit_transform([r["lemmas"] for r in train])
    nb = MultinomialNB(alpha=1.0).fit(X_train, [r["label"] for r in train])

    # 낱말의 무게 = ln P(낱말|긍정) − ln P(낱말|부정)
    pos, neg = list(nb.classes_).index("pos"), list(nb.classes_).index("neg")
    weights = nb.feature_log_prob_[pos] - nb.feature_log_prob_[neg]
    order = weights.argsort()
    words = vec.get_feature_names_out()
    print("\n긍정 쪽 무게가 큰 낱말:", ", ".join(f"{words[i]} {weights[i]:+.2f}" for i in order[::-1][:6]))
    print("부정 쪽 무게가 큰 낱말:", ", ".join(f"{words[i]} {weights[i]:+.2f}" for i in order[:6]))

    y_true = [r["label"] for r in test]
    nb_pred = nb.predict(vec.transform([r["lemmas"] for r in test]))
    nb_prob = nb.predict_proba(vec.transform([r["lemmas"] for r in test]))[:, pos]
    lex_pred = [label(score(r["text"])) for r in test]
    print("\n시험 서평              실제  사전   나이브 베이즈 (긍정 확률)")
    for r, lp, npred, p in zip(test, lex_pred, nb_pred, nb_prob):
        print(f"{r['text']:<22} {r['label']}  {lp} {'O' if lp == r['label'] else 'X'}   {npred} {'O' if npred == r['label'] else 'X'} ({p:.3f})")
    print(f"정확도: 사전 {accuracy_score(y_true, lex_pred):.3f}, 나이브 베이즈 {accuracy_score(y_true, nb_pred):.3f}")
    print("나이브 베이즈 혼동 행렬 (줄 = 실제 pos/neg, 칸 = 예측 pos/neg):")
    print(confusion_matrix(y_true, nb_pred, labels=["pos", "neg"]))

    # ---------- 3. 감정 곡선 ----------
    story = [l.strip() for l in open(HERE / "heungbu.txt", encoding="utf-8") if l.strip()]
    scores = [score(s) for s in story]

    print("\n흥부전 감정 곡선 (문장 점수 / 이동 평균)")
    for i, (s, x, m) in enumerate(zip(story, scores, moving_average(scores)), 1):
        print(f"{i:2d} {x:+.1f} {m:+.2f}  {s}")


if __name__ == "__main__":
    main()
