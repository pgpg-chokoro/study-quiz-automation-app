import { readFile } from "node:fs/promises";

const quizHistory = JSON.parse(await readFile("data/quiz-history.json", "utf8"));
const issues = [];
const exactPrompts = new Map();
const questions = [];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s、。,.，．！？!?「」『』（）()［］\[\]【】:：;；・/\\-]/g, "")
    .trim();
}

function label(item) {
  return item.setTitle + " / " + item.questionId + " / " + item.prompt;
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

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) {
      intersection += 1;
    }
  }

  return intersection / (a.size + b.size - intersection);
}

for (const quizSet of quizHistory) {
  for (const question of quizSet.questions ?? []) {
    const prompt = String(question.prompt ?? "").trim();
    const normalizedPrompt = normalize(prompt);
    const item = {
      setId: quizSet.id,
      setTitle: quizSet.title,
      questionId: question.id,
      topicKey: (quizSet.sourceTopicIds ?? []).join("|") || "unknown",
      prompt,
      answer: String(question.answer ?? "").trim(),
      normalizedPrompt,
      promptNgrams: ngrams(prompt)
    };

    if (!normalizedPrompt) {
      continue;
    }

    if (exactPrompts.has(normalizedPrompt)) {
      issues.push("問題文が完全に重複しています: " + label(exactPrompts.get(normalizedPrompt)) + " / " + label(item));
    } else {
      exactPrompts.set(normalizedPrompt, item);
    }

    questions.push(item);
  }
}

for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
    const left = questions[leftIndex];
    const right = questions[rightIndex];

    if (left.topicKey !== right.topicKey || left.setId === right.setId || left.answer !== right.answer) {
      continue;
    }

    const similarity = jaccard(left.promptNgrams, right.promptNgrams);
    if (similarity >= 0.92) {
      issues.push(
        "同一ジャンル内で問題文と正答がかなり似ています: " +
          label(left) +
          " / " +
          label(right) +
          " / 類似度=" +
          similarity.toFixed(2)
      );
    }
  }
}

if (issues.length > 0) {
  console.error("クイズ重複チェックに失敗しました。");
  for (const issue of issues) {
    console.error("- " + issue);
  }
  process.exit(1);
}

console.log("クイズ重複チェックに成功しました。対象問題数: " + questions.length);
