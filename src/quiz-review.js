export const REVIEW_DECISIONS = new Set(["keep", "hide", "needs-improvement"]);
export const REVIEW_SCOPES = new Set(["quiz-set", "question"]);

export function createEmptyQuizReview() {
  return {
    version: 1,
    decisions: []
  };
}

export function getQuestionKey(quizSetId, questionId = "") {
  return quizSetId + ":" + questionId;
}

export function getQuestionIndex(quizHistory) {
  const quizSets = new Map();
  const questions = new Map();

  for (const quizSet of quizHistory) {
    quizSets.set(quizSet.id, quizSet);
    for (const question of quizSet.questions ?? []) {
      questions.set(getQuestionKey(quizSet.id, question.id), question);
    }
  }

  return { quizSets, questions };
}

function normalizeDecision(decision) {
  return String(decision ?? "").trim();
}

function normalizeScope(scope) {
  return String(scope ?? "").trim();
}

function hasText(value) {
  return String(value ?? "").trim().length > 0;
}

function targetLabel(decision) {
  return [decision.scope, decision.quizSetId, decision.questionId].filter(Boolean).join(":");
}

export function validateQuizReview(quizReview, quizHistory) {
  const issues = [];
  const { quizSets, questions } = getQuestionIndex(quizHistory);

  if (!quizReview || typeof quizReview !== "object" || Array.isArray(quizReview)) {
    return ["quiz-reviewはオブジェクトである必要があります。"];
  }

  if (quizReview.version !== 1) {
    issues.push("quiz-review.version は 1 である必要があります。");
  }

  if (!Array.isArray(quizReview.decisions)) {
    issues.push("quiz-review.decisions は配列である必要があります。");
    return issues;
  }

  const seenTargets = new Set();

  quizReview.decisions.forEach((entry, index) => {
    const prefix = "decisions[" + index + "]";
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push(prefix + ": オブジェクトである必要があります。");
      return;
    }

    const scope = normalizeScope(entry.scope);
    const decision = normalizeDecision(entry.decision);
    const quizSetId = String(entry.quizSetId ?? "").trim();
    const questionId = String(entry.questionId ?? "").trim();
    const targetKey = scope + ":" + quizSetId + ":" + questionId;

    if (!hasText(entry.id)) {
      issues.push(prefix + ": id が必要です。");
    }

    if (!REVIEW_SCOPES.has(scope)) {
      issues.push(prefix + ": scope は quiz-set または question である必要があります。");
    }

    if (!REVIEW_DECISIONS.has(decision)) {
      issues.push(prefix + ": decision は keep / hide / needs-improvement のいずれかである必要があります。");
    }

    if (!quizSetId) {
      issues.push(prefix + ": quizSetId が必要です。");
    } else if (!quizSets.has(quizSetId)) {
      issues.push(prefix + ": quizSetId が存在しません: " + quizSetId);
    }

    if (scope === "question") {
      if (!questionId) {
        issues.push(prefix + ": question scope では questionId が必要です。");
      } else if (!questions.has(getQuestionKey(quizSetId, questionId))) {
        issues.push(prefix + ": questionId が対象quizSetに存在しません: " + targetLabel(entry));
      }
    }

    if (scope === "quiz-set" && questionId) {
      issues.push(prefix + ": quiz-set scope では questionId を空にしてください。");
    }

    if ((decision === "hide" || decision === "needs-improvement") && !hasText(entry.reason)) {
      issues.push(prefix + ": hide / needs-improvement では reason が必要です。");
    }

    if (entry.preferred) {
      const preferredQuizSetId = String(entry.preferred.quizSetId ?? "").trim();
      const preferredQuestionId = String(entry.preferred.questionId ?? "").trim();
      if (!preferredQuizSetId) {
        issues.push(prefix + ": preferred.quizSetId が必要です。");
      } else if (!quizSets.has(preferredQuizSetId)) {
        issues.push(prefix + ": preferred.quizSetId が存在しません: " + preferredQuizSetId);
      }

      if (scope === "question") {
        if (!preferredQuestionId) {
          issues.push(prefix + ": question scope では preferred.questionId が必要です。");
        } else if (!questions.has(getQuestionKey(preferredQuizSetId, preferredQuestionId))) {
          issues.push(prefix + ": preferred.questionId が対象quizSetに存在しません。");
        }

        if (preferredQuizSetId === quizSetId && preferredQuestionId === questionId) {
          issues.push(prefix + ": preferred はレビュー対象とは別の問題を指定してください。");
        }
      }
    }

    if (seenTargets.has(targetKey)) {
      issues.push(prefix + ": 同じ対象へのレビュー判定が重複しています: " + targetKey);
    }
    seenTargets.add(targetKey);
  });

  return issues;
}

export function applyQuizReview(quizHistory, quizReview) {
  const decisions = Array.isArray(quizReview?.decisions) ? quizReview.decisions : [];
  const hiddenSetIds = new Set();
  const hiddenQuestionKeys = new Set();

  for (const entry of decisions) {
    if (entry?.decision !== "hide") {
      continue;
    }

    if (entry.scope === "quiz-set") {
      hiddenSetIds.add(entry.quizSetId);
    }

    if (entry.scope === "question") {
      hiddenQuestionKeys.add(getQuestionKey(entry.quizSetId, entry.questionId));
    }
  }

  const filteredQuizHistory = quizHistory
    .filter((quizSet) => !hiddenSetIds.has(quizSet.id))
    .map((quizSet) => ({
      ...quizSet,
      questions: (quizSet.questions ?? []).filter(
        (question) => !hiddenQuestionKeys.has(getQuestionKey(quizSet.id, question.id))
      )
    }))
    .filter((quizSet) => (quizSet.questions ?? []).length > 0);

  return {
    quizHistory: filteredQuizHistory,
    hiddenSetCount: hiddenSetIds.size,
    hiddenQuestionCount: hiddenQuestionKeys.size
  };
}
