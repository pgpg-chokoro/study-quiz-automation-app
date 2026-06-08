import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const quizHistoryPath = "data/quiz-history.json";

async function git(args) {
  const { stdout } = await execFileAsync("git", args, {
    maxBuffer: 10 * 1024 * 1024
  });
  return stdout.trimEnd();
}

async function refExists(ref) {
  try {
    await git(["rev-parse", "--verify", "--quiet", ref]);
    return true;
  } catch {
    return false;
  }
}

async function chooseBaseRef() {
  if (process.env.QUIZ_HISTORY_APPEND_BASE) {
    return process.env.QUIZ_HISTORY_APPEND_BASE;
  }

  const githubBaseRef = process.env.GITHUB_BASE_REF;
  if (githubBaseRef && await refExists(`origin/${githubBaseRef}`)) {
    return await git(["merge-base", "HEAD", `origin/${githubBaseRef}`]);
  }

  if (await refExists("HEAD")) {
    return "HEAD";
  }

  return "";
}

async function readBaseQuizHistory(baseRef) {
  if (!baseRef) {
    return null;
  }

  try {
    const text = await git(["show", `${baseRef}:${quizHistoryPath}`]);
    return JSON.parse(text || "[]");
  } catch (error) {
    console.warn(`追記専用チェックをスキップします: ${baseRef} の ${quizHistoryPath} を読めません。`);
    console.warn(error.message);
    return null;
  }
}

function stableJson(value) {
  return JSON.stringify(value);
}

function labelQuizSet(set, index) {
  return `${index + 1}件目 ${set?.title ?? "タイトルなし"} (${set?.id ?? "idなし"})`;
}

const currentQuizHistory = JSON.parse(await readFile(quizHistoryPath, "utf8"));
if (!Array.isArray(currentQuizHistory)) {
  console.error(`${quizHistoryPath} はJSON配列である必要があります。`);
  process.exit(1);
}

const baseRef = await chooseBaseRef();
const baseQuizHistory = await readBaseQuizHistory(baseRef);

if (baseQuizHistory === null) {
  process.exit(0);
}

if (!Array.isArray(baseQuizHistory)) {
  console.error(`${baseRef} の ${quizHistoryPath} はJSON配列である必要があります。`);
  process.exit(1);
}

const issues = [];

if (currentQuizHistory.length < baseQuizHistory.length) {
  issues.push(
    `${quizHistoryPath} の件数が減っています。既存履歴は削除せず、配列末尾へ追記してください。` +
      ` base=${baseQuizHistory.length}, current=${currentQuizHistory.length}`
  );
}

const prefixLength = Math.min(baseQuizHistory.length, currentQuizHistory.length);
for (let index = 0; index < prefixLength; index += 1) {
  if (stableJson(currentQuizHistory[index]) !== stableJson(baseQuizHistory[index])) {
    issues.push(
      `${quizHistoryPath} の既存履歴が変更されています: ${labelQuizSet(baseQuizHistory[index], index)}。` +
        "既存クイズセットは削除・上書き・並べ替えせず、改善版や追加分を末尾に追記してください。"
    );
  }
}

const existingIds = new Set(baseQuizHistory.map((set) => set?.id).filter(Boolean));
const seenIds = new Set(currentQuizHistory.map((set) => set?.id).filter(Boolean));
const addedQuizSets = currentQuizHistory.slice(baseQuizHistory.length);

for (const [offset, quizSet] of addedQuizSets.entries()) {
  const index = baseQuizHistory.length + offset;
  if (!quizSet?.id) {
    issues.push(`${quizHistoryPath} の追加分にidがありません: ${labelQuizSet(quizSet, index)}`);
    continue;
  }

  if (existingIds.has(quizSet.id)) {
    issues.push(`${quizHistoryPath} の追加分が既存idを再利用しています: ${labelQuizSet(quizSet, index)}`);
  }
}

if (seenIds.size !== currentQuizHistory.filter((set) => set?.id).length) {
  issues.push(`${quizHistoryPath} 内でクイズセットidが重複しています。`);
}

if (issues.length > 0) {
  console.error("クイズ履歴の追記専用チェックに失敗しました。");
  for (const issue of issues) {
    console.error("- " + issue);
  }
  process.exit(1);
}

console.log(
  "クイズ履歴の追記専用チェックに成功しました。" +
    ` base=${baseQuizHistory.length}, added=${addedQuizSets.length}, current=${currentQuizHistory.length}`
);
