import { readFile } from "node:fs/promises";

const quizHistory = JSON.parse(await readFile("data/quiz-history.json", "utf8"));
const issues = [];

function label(set, question, index) {
  return set.title + " / Q" + (index + 1) + " / " + (question.prompt ?? "問題文なし");
}

function normalize(value) {
  return String(value ?? "").trim();
}

for (const set of quizHistory) {
  const multipleChoiceAnswerIndexes = [];

  if (!Array.isArray(set.questions) || set.questions.length === 0) {
    issues.push(set.title + ": questionsが空です。");
    continue;
  }

  set.questions.forEach((question, index) => {
    const questionLabel = label(set, question, index);
    const type = question.type ?? "multiple-choice";
    const prompt = normalize(question.prompt);
    const answer = normalize(question.answer);
    const explanation = normalize(question.explanation);

    if (!prompt) {
      issues.push(questionLabel + ": 問題文が空です。");
    }

    if (!answer) {
      issues.push(questionLabel + ": 正答が空です。");
    }

    if (!explanation) {
      issues.push(questionLabel + ": 解説が空です。");
    }

    if (type === "multiple-choice" || type === "true-false") {
      if (!Array.isArray(question.choices) || question.choices.length < 2) {
        issues.push(questionLabel + ": 選択肢が2件未満です。");
        return;
      }

      const choices = question.choices.map(normalize);
      const uniqueChoices = new Set(choices);
      if (uniqueChoices.size !== choices.length) {
        issues.push(questionLabel + ": 選択肢に重複があります。");
      }

      if (choices.some((choice) => !choice)) {
        issues.push(questionLabel + ": 空の選択肢があります。");
      }

      const answerMatches = choices.filter((choice) => choice === answer).length;
      if (answerMatches !== 1) {
        issues.push(questionLabel + ": 正答が選択肢に一意に含まれていません。");
      } else {
        multipleChoiceAnswerIndexes.push(choices.indexOf(answer));
      }
    }
  });

  if (multipleChoiceAnswerIndexes.length >= 3) {
    const distinctIndexes = new Set(multipleChoiceAnswerIndexes);
    if (distinctIndexes.size === 1) {
      issues.push(set.title + ": 選択式の正答位置が全問同じです。");
    }
  }
}

if (issues.length > 0) {
  console.error("クイズ品質チェックに失敗しました。");
  for (const issue of issues) {
    console.error("- " + issue);
  }
  process.exit(1);
}

console.log("クイズ品質チェックに成功しました。対象セット: " + quizHistory.length);
