import { readFile } from "node:fs/promises";

const quizHistory = JSON.parse(await readFile("data/quiz-history.json", "utf8"));
const quizReview = JSON.parse(await readFile("data/quiz-review.json", "utf8"));
const studyTopics = JSON.parse(await readFile("data/study-topics.json", "utf8"));

const hiddenQuestionKeys = new Set(
  (quizReview.decisions ?? [])
    .filter((entry) => entry.decision === "hide" && entry.scope === "question")
    .map((entry) => entry.quizSetId + ":" + entry.questionId)
);
const hiddenSetIds = new Set(
  (quizReview.decisions ?? [])
    .filter((entry) => entry.decision === "hide" && entry.scope === "quiz-set")
    .map((entry) => entry.quizSetId)
);
const trackedQuestionKeys = new Set(
  (quizReview.decisions ?? [])
    .filter((entry) => entry.scope === "question" && entry.decision !== "hide")
    .map((entry) => entry.quizSetId + ":" + entry.questionId)
);
const reviewDecisionsBySet = new Map();
for (const entry of quizReview.decisions ?? []) {
  if (!entry?.quizSetId) {
    continue;
  }
  const entries = reviewDecisionsBySet.get(entry.quizSetId) ?? [];
  entries.push(entry);
  reviewDecisionsBySet.set(entry.quizSetId, entries);
}

const topicLabels = new Map(studyTopics.map((topic) => [topic.id, topic.target]));
const difficulties = new Set(["beginner", "intermediate", "advanced", "expert"]);
const coverageAxes = [
  {
    key: "foundation",
    label: "基礎用語・基本概念",
    patterns: ["基本", "基礎", "主な", "目的", "役割", "とは", "どれ"]
  },
  {
    key: "comparison",
    label: "比較・区別",
    patterns: ["違い", "比較", "区別", "どちら", "一方", "に対して", "ではなく"]
  },
  {
    key: "common-mistake",
    label: "典型ミス・誤解",
    patterns: ["誤", "間違", "混同", "注意", "落とし穴", "防ぐ", "避ける"]
  },
  {
    key: "practical-judgment",
    label: "実務判断・運用",
    patterns: ["実務", "運用", "設計", "対応", "判断", "管理", "監視", "調査", "実装"]
  },
  {
    key: "edge-limitation",
    label: "例外・限界",
    patterns: ["例外", "限界", "成立", "できない", "不十分", "弱点", "リスク", "条件"]
  },
  {
    key: "applied-design",
    label: "応用設計・トレードオフ",
    patterns: ["トレードオフ", "複数", "組み合わせ", "シナリオ", "応用", "高度", "攻撃", "設計判断"]
  }
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s、。,.，．！？!?「」『』（）()［］\[\]【】:：;；・/\\-]/g, "")
    .trim();
}

function ngrams(value, size = 3) {
  const normalized = normalize(value);
  if (normalized.length <= size) {
    return new Set(normalized ? [normalized] : []);
  }

  const result = new Set();
  for (let index = 0; index <= normalized.length - size; index += 1) {
    result.add(normalized.slice(index, index + size));
  }
  return result;
}

function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) {
      intersection += 1;
    }
  }
  return intersection / (left.size + right.size - intersection);
}

function label(item) {
  return item.setTitle + " / " + item.questionId + " / " + item.prompt;
}

function topicLabel(topicKey) {
  const labels = topicKey.split("|").map((topicId) => topicLabels.get(topicId) ?? topicId);
  return labels.join(" + ") || "unknown";
}

function createFinding(type, severity, qualityTags, message) {
  return { type, severity, qualityTags, message };
}

function scoreCoverage(text) {
  const matched = new Set();
  for (const axis of coverageAxes) {
    if (axis.patterns.some((pattern) => text.includes(pattern))) {
      matched.add(axis.key);
    }
  }
  return matched;
}

function formatAnswerPositionCounts(counts) {
  const choiceLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([key, count]) => (choiceLabels[key] ?? String(key)) + "=" + count)
    .join(", ");
}

const questions = [];
const exactPrompts = new Map();
const findings = [];
const topicGroups = new Map();
const corpusAnswerPositionCounts = new Map();
const improvedFromIds = new Set();

for (const quizSet of quizHistory) {
  if (hiddenSetIds.has(quizSet.id)) {
    continue;
  }

  if (quizSet.improvedFromQuizSetId) {
    improvedFromIds.add(quizSet.improvedFromQuizSetId);
  }

  const topicKey = (quizSet.sourceTopicIds ?? []).join("|") || "unknown";
  const difficultyCounts = new Map([...difficulties].map((difficulty) => [difficulty, 0]));
  let hiddenQuestionCountInSet = 0;
  const topicGroup = topicGroups.get(topicKey) ?? {
    topicKey,
    questionCount: 0,
    difficultyCounts: new Map([...difficulties].map((difficulty) => [difficulty, 0])),
    coverage: new Set(),
    answerPositionCounts: new Map()
  };

  for (const question of quizSet.questions ?? []) {
    const questionKey = quizSet.id + ":" + question.id;
    if (hiddenQuestionKeys.has(questionKey)) {
      hiddenQuestionCountInSet += 1;
      continue;
    }

    difficultyCounts.set(question.difficulty, (difficultyCounts.get(question.difficulty) ?? 0) + 1);
    topicGroup.difficultyCounts.set(question.difficulty, (topicGroup.difficultyCounts.get(question.difficulty) ?? 0) + 1);
    topicGroup.questionCount += 1;

    const prompt = String(question.prompt ?? "").trim();
    const answer = String(question.answer ?? "").trim();
    const explanation = String(question.explanation ?? "").trim();
    const item = {
      setId: quizSet.id,
      setTitle: quizSet.title,
      questionId: question.id,
      topicKey,
      prompt,
      answer,
      explanation,
      difficulty: question.difficulty,
      normalizedPrompt: normalize(prompt),
      promptNgrams: ngrams(prompt)
    };

    for (const axisKey of scoreCoverage(prompt + "\n" + explanation)) {
      topicGroup.coverage.add(axisKey);
    }

    if (Array.isArray(question.choices)) {
      const answerIndex = question.choices.map((choice) => String(choice ?? "").trim()).indexOf(answer);
      if (answerIndex >= 0) {
        corpusAnswerPositionCounts.set(answerIndex, (corpusAnswerPositionCounts.get(answerIndex) ?? 0) + 1);
        topicGroup.answerPositionCounts.set(answerIndex, (topicGroup.answerPositionCounts.get(answerIndex) ?? 0) + 1);
      }
    }

    if (!item.normalizedPrompt) {
      continue;
    }

    const exact = exactPrompts.get(item.normalizedPrompt);
    if (exact) {
      findings.push(
        createFinding(
          "exact-duplicate",
          "high",
          ["duplicate-better-exists"],
          "問題文が完全に重複しています。代表問題をkeepし、片方をhide候補にしてください: " + label(exact) + " / " + label(item)
        )
      );
    } else {
      exactPrompts.set(item.normalizedPrompt, item);
    }

    if (!trackedQuestionKeys.has(questionKey) && explanation.length < 55) {
      findings.push(
        createFinding(
          "thin-explanation",
          "medium",
          ["weak-explanation"],
          "解説が短く、誤答しやすい点まで説明できていない可能性があります: " + label(item)
        )
      );
    }

    questions.push(item);
  }

  topicGroups.set(topicKey, topicGroup);

  const missingDifficulties = [...difficultyCounts.entries()]
    .filter(([, count]) => count === 0)
    .map(([difficulty]) => difficulty);
  if (hiddenQuestionCountInSet === 0 && missingDifficulties.length >= 2) {
    findings.push(
      createFinding(
        "difficulty-gap",
        "low",
        ["coverage-gap"],
        quizSet.title + ": 未出題の難易度が多いです: " + missingDifficulties.join(", ")
      )
    );
  }
}

for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
    const left = questions[leftIndex];
    const right = questions[rightIndex];

    if (left.topicKey !== right.topicKey || left.setId === right.setId) {
      continue;
    }

    const similarity = jaccard(left.promptNgrams, right.promptNgrams);
    if (similarity >= 0.86 && (left.answer === right.answer || similarity >= 0.92)) {
      findings.push(
        createFinding(
          "similar-question",
          similarity >= 0.92 ? "high" : "medium",
          ["duplicate-better-exists"],
          "同一ジャンル内で似た問題があります。代表問題をkeepし、片方をhide候補にしてください: " +
            label(left) +
            " / " +
            label(right) +
            " / 類似度=" +
            similarity.toFixed(2)
        )
      );
    }
  }
}

if (questions.length >= 24 && corpusAnswerPositionCounts.size >= 2) {
  const total = [...corpusAnswerPositionCounts.values()].reduce((sum, count) => sum + count, 0);
  const lowPositions = [...corpusAnswerPositionCounts.entries()].filter(([, count]) => count / total < 0.12);
  const highPositions = [...corpusAnswerPositionCounts.entries()].filter(([, count]) => count / total > 0.38);
  if (lowPositions.length > 0 || highPositions.length > 0) {
    findings.push(
      createFinding(
        "answer-position-skew",
        "low",
        ["answer-position-skew"],
        "選択式の正答位置に偏りがあります。正答位置だけで推測されにくいか確認してください: " +
          formatAnswerPositionCounts(corpusAnswerPositionCounts)
      )
    );
  }
}

for (const group of topicGroups.values()) {
  if (group.questionCount < 8) {
    continue;
  }

  const missingCoverage = coverageAxes.filter((axis) => !group.coverage.has(axis.key));
  if (missingCoverage.length >= 3) {
    findings.push(
      createFinding(
        "coverage-gap",
        "low",
        ["coverage-gap"],
        topicLabel(group.topicKey) +
          ": 出題観点が偏っている可能性があります。未検出の観点: " +
          missingCoverage.map((axis) => axis.label).join("、")
      )
    );
  }
}

for (const sourceSetId of improvedFromIds) {
  if (hiddenSetIds.has(sourceSetId)) {
    continue;
  }

  const decisions = reviewDecisionsBySet.get(sourceSetId) ?? [];
  const hasHideDecision = decisions.some((entry) => entry.decision === "hide");
  const hasKeepDecision = decisions.some((entry) => entry.decision === "keep");
  if (!hasHideDecision && !hasKeepDecision) {
    const sourceSet = quizHistory.find((quizSet) => quizSet.id === sourceSetId);
    findings.push(
      createFinding(
        "unresolved-improved-source",
        "low",
        ["duplicate-better-exists"],
        "改善版の元セットがレビュー未判定です。旧版を残す価値があるか、keep/hide/needs-improvementを検討してください: " +
          (sourceSet?.title ?? sourceSetId)
      )
    );
  }
}

console.log("クイズレビュー候補レポート");
console.log("対象セット: " + quizHistory.length + " / 対象問題: " + questions.length);

if (findings.length === 0) {
  console.log("レビュー候補は見つかりませんでした。");
} else {
  const severityOrder = { high: 0, medium: 1, low: 2 };
  findings.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]);
  for (const finding of findings) {
    const tags = finding.qualityTags.length > 0 ? " / tags=" + finding.qualityTags.join(",") : "";
    console.log("- [" + finding.severity + "] " + finding.type + tags + ": " + finding.message);
  }
}

