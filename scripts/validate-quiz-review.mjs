import { readFile } from "node:fs/promises";
import { validateQuizReview } from "../src/quiz-review.js";

const quizHistory = JSON.parse(await readFile("data/quiz-history.json", "utf8"));
const quizReview = JSON.parse(await readFile("data/quiz-review.json", "utf8"));
const issues = validateQuizReview(quizReview, quizHistory);

if (issues.length > 0) {
  console.error("クイズレビュー判定チェックに失敗しました。");
  for (const issue of issues) {
    console.error("- " + issue);
  }
  process.exit(1);
}

console.log("クイズレビュー判定チェックに成功しました。判定数: " + quizReview.decisions.length);
