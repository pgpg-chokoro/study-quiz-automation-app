import assert from "node:assert/strict";
import test from "node:test";
import { applyQuizReview, validateQuizReview } from "../src/quiz-review.js";

const quizHistory = [
  {
    id: "set-1",
    title: "セキュリティ 基礎",
    questions: [
      {
        id: "q-1",
        prompt: "XSSの主なリスクはどれですか？",
        answer: "スクリプト実行"
      },
      {
        id: "q-2",
        prompt: "CSRF対策として使われるものはどれですか？",
        answer: "トークン"
      }
    ]
  },
  {
    id: "set-2",
    title: "セキュリティ 応用",
    questions: [
      {
        id: "q-3",
        prompt: "CSPの目的はどれですか？",
        answer: "実行元制御"
      }
    ]
  }
];

test("レビュー判定で公開対象の問題だけを残せる", () => {
  const review = {
    version: 1,
    decisions: [
      {
        id: "review-1",
        scope: "question",
        quizSetId: "set-1",
        questionId: "q-2",
        decision: "hide",
        reason: "似た問題の改善版を代表にする"
      }
    ]
  };

  assert.deepEqual(validateQuizReview(review, quizHistory), []);
  const result = applyQuizReview(quizHistory, review);

  assert.equal(result.hiddenQuestionCount, 1);
  assert.equal(result.quizHistory.length, 2);
  assert.deepEqual(
    result.quizHistory[0].questions.map((question) => question.id),
    ["q-1"]
  );
});

test("レビュー判定でクイズセット全体を非公開にできる", () => {
  const review = {
    version: 1,
    decisions: [
      {
        id: "review-2",
        scope: "quiz-set",
        quizSetId: "set-2",
        decision: "hide",
        reason: "改善版セットに置き換える"
      }
    ]
  };

  assert.deepEqual(validateQuizReview(review, quizHistory), []);
  const result = applyQuizReview(quizHistory, review);

  assert.equal(result.hiddenSetCount, 1);
  assert.deepEqual(
    result.quizHistory.map((set) => set.id),
    ["set-1"]
  );
});

test("存在しない問題を指すレビュー判定は検出される", () => {
  const review = {
    version: 1,
    decisions: [
      {
        id: "review-3",
        scope: "question",
        quizSetId: "set-1",
        questionId: "missing",
        decision: "hide",
        reason: "存在しない問題"
      }
    ]
  };

  const issues = validateQuizReview(review, quizHistory);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /questionId/);
});
