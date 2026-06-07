import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createQuizSet,
  createStudyTopic,
  deleteStudyTopic,
  getQuizHistory,
  getStudyTopics,
  projectRoot,
  updateStudyTopic
} from "../src/data-store.js";

const topicFile = path.join(projectRoot, "data", "study-topics.json");
const quizFile = path.join(projectRoot, "data", "quiz-history.json");

async function withRestoredDataFiles(run) {
  const originalTopics = await readFile(topicFile, "utf8");
  const originalQuizzes = await readFile(quizFile, "utf8");

  try {
    await writeFile(topicFile, "[]\n", "utf8");
    await writeFile(quizFile, "[]\n", "utf8");
    await run();
  } finally {
    await writeFile(topicFile, originalTopics, "utf8");
    await writeFile(quizFile, originalQuizzes, "utf8");
  }
}

test("学習メモを作成、更新、削除できる", async () => {
  await withRestoredDataFiles(async () => {
    const created = await createStudyTopic({
      target: "HTML",
      priority: "high",
      status: "active",
      note: "フォーム、セマンティックHTML、アクセシビリティをCodex判断で広く扱ってほしい"
    });

    assert.ok(created.id);
    assert.equal(created.target, "HTML");
    assert.equal(created.note, "フォーム、セマンティックHTML、アクセシビリティをCodex判断で広く扱ってほしい");

    const updated = await updateStudyTopic(created.id, {
      target: "HTMLとセキュリティ",
      priority: "normal",
      status: "paused",
      note: "XSSも含める"
    });

    assert.equal(updated.target, "HTMLとセキュリティ");
    assert.equal(updated.priority, "normal");
    assert.equal(updated.status, "paused");
    assert.equal(updated.note, "XSSも含める");

    const topics = await getStudyTopics();
    assert.equal(topics.length, 1);

    await deleteStudyTopic(created.id);
    assert.deepEqual(await getStudyTopics(), []);
  });
});

test("旧形式のtitle/detail入力も学習対象と補足へ正規化できる", async () => {
  await withRestoredDataFiles(async () => {
    const created = await createStudyTopic({
      title: "セキュリティ",
      detail: "Webアプリの代表的な攻撃と対策"
    });

    assert.equal(created.target, "セキュリティ");
    assert.equal(created.note, "Webアプリの代表的な攻撃と対策");
  });
});

test("クイズセットを履歴として追記できる", async () => {
  await withRestoredDataFiles(async () => {
    const topic = await createStudyTopic({
      target: "ネットワーク基礎",
      note: "基本情報技術者レベルから応用まで"
    });

    const quizSet = await createQuizSet({
      title: "ネットワーク基礎 初回クイズ",
      actionType: "create",
      sourceTopicIds: [topic.id],
      generationReason: "新規メモに対する初回生成",
      questions: [
        {
          difficulty: "beginner",
          type: "multiple-choice",
          prompt: "IPアドレスが主に識別するものはどれですか？",
          choices: ["ネットワーク上の機器", "HTMLタグ", "文字コード", "画像形式"],
          answer: "ネットワーク上の機器",
          explanation: "IPアドレスはネットワーク上の機器やインターフェースを識別するために使われます。",
          sourceTopicId: topic.id
        }
      ]
    });

    assert.ok(quizSet.id);
    assert.equal(quizSet.questions.length, 1);

    const history = await getQuizHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0].sourceTopicIds[0], topic.id);
  });
});

test("選択式クイズの選択肢不足を検出する", async () => {
  await withRestoredDataFiles(async () => {
    await assert.rejects(
      () =>
        createQuizSet({
          title: "不正なクイズ",
          actionType: "create",
          questions: [
            {
              difficulty: "beginner",
              type: "multiple-choice",
              prompt: "選択肢が足りない問題",
              choices: ["1つだけ"],
              answer: "1つだけ",
              explanation: "選択式には2つ以上の選択肢が必要です。"
            }
          ]
        }),
      /2つ以上の選択肢/
    );
  });
});
