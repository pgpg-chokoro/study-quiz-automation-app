import { readFile } from "node:fs/promises";

const quizHistory = JSON.parse(await readFile("data/quiz-history.json", "utf8"));
const quizReview = JSON.parse(await readFile("data/quiz-review.json", "utf8"));
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

const questions = [];
const exactPrompts = new Map();
const findings = [];
const difficulties = new Set(["beginner", "intermediate", "advanced", "expert"]);

for (const quizSet of quizHistory) {
  if (hiddenSetIds.has(quizSet.id)) {
    continue;
  }

  const topicKey = (quizSet.sourceTopicIds ?? []).join("|") || "unknown";
  const difficultyCounts = new Map([...difficulties].map((difficulty) => [difficulty, 0]));
  let hiddenQuestionCountInSet = 0;

  for (const question of quizSet.questions ?? []) {
    const questionKey = quizSet.id + ":" + question.id;
    if (hiddenQuestionKeys.has(questionKey)) {
      hiddenQuestionCountInSet += 1;
      continue;
    }

    difficultyCounts.set(question.difficulty, (difficultyCounts.get(question.difficulty) ?? 0) + 1);
    const prompt = String(question.prompt ?? "").trim();
    const answer = String(question.answer ?? "").trim();
    const item = {
      setId: quizSet.id,
      setTitle: quizSet.title,
      questionId: question.id,
      topicKey,
      prompt,
      answer,
      normalizedPrompt: normalize(prompt),
      promptNgrams: ngrams(prompt)
    };

    if (!item.normalizedPrompt) {
      continue;
    }

    const exact = exactPrompts.get(item.normalizedPrompt);
    if (exact) {
      findings.push({
        type: "exact-duplicate",
        severity: "high",
        message: "問題文が完全に重複しています: " + label(exact) + " / " + label(item)
      });
    } else {
      exactPrompts.set(item.normalizedPrompt, item);
    }

    if (!trackedQuestionKeys.has(questionKey) && String(question.explanation ?? "").trim().length < 45) {
      findings.push({
        type: "thin-explanation",
        severity: "medium",
        message: "解説が短く、誤答しやすい点まで説明できていない可能性があります: " + label(item)
      });
    }

    questions.push(item);
  }

  const missingDifficulties = [...difficultyCounts.entries()]
    .filter(([, count]) => count === 0)
    .map(([difficulty]) => difficulty);
  if (hiddenQuestionCountInSet === 0 && missingDifficulties.length >= 2) {
    findings.push({
      type: "difficulty-gap",
      severity: "low",
      message: quizSet.title + ": 未出題の難易度が多いです: " + missingDifficulties.join(", ")
    });
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
      findings.push({
        type: "similar-question",
        severity: similarity >= 0.92 ? "high" : "medium",
        message:
          "同一ジャンル内で似た問題があります。代表問題をkeepし、片方をhide候補にしてください: " +
          label(left) +
          " / " +
          label(right) +
          " / 類似度=" +
          similarity.toFixed(2)
      });
    }
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
    console.log("- [" + finding.severity + "] " + finding.message);
  }
}
