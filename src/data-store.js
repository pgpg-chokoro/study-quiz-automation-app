import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  NotFoundError,
  normalizeQuizSet,
  normalizeStudyTopic
} from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..");
export const dataDir = path.join(projectRoot, "data");

const topicFile = path.join(dataDir, "study-topics.json");
const quizFile = path.join(dataDir, "quiz-history.json");

async function ensureDataFiles() {
  await mkdir(dataDir, { recursive: true });
  await ensureArrayFile(topicFile);
  await ensureArrayFile(quizFile);
}

async function ensureArrayFile(filePath) {
  try {
    await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    await writeFile(filePath, "[]\n", "utf8");
  }
}

async function readJsonArray(filePath) {
  await ensureDataFiles();
  const text = await readFile(filePath, "utf8");
  const parsed = JSON.parse(text || "[]");

  if (!Array.isArray(parsed)) {
    throw new Error(`${path.basename(filePath)} must contain a JSON array.`);
  }

  return parsed;
}

async function writeJsonArray(filePath, rows) {
  await mkdir(dataDir, { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function getStudyTopics() {
  return readJsonArray(topicFile);
}

export async function createStudyTopic(input) {
  const topics = await getStudyTopics();
  const topic = normalizeStudyTopic(input, {}, { id: randomUUID() });
  topics.push(topic);
  await writeJsonArray(topicFile, topics);
  return topic;
}

export async function updateStudyTopic(id, input) {
  const topics = await getStudyTopics();
  const index = topics.findIndex((topic) => topic.id === id);

  if (index === -1) {
    throw new NotFoundError("指定された学習メモが見つかりません。");
  }

  const updated = normalizeStudyTopic(input, topics[index]);
  topics[index] = updated;
  await writeJsonArray(topicFile, topics);
  return updated;
}

export async function deleteStudyTopic(id) {
  const topics = await getStudyTopics();
  const nextTopics = topics.filter((topic) => topic.id !== id);

  if (topics.length === nextTopics.length) {
    throw new NotFoundError("指定された学習メモが見つかりません。");
  }

  await writeJsonArray(topicFile, nextTopics);
}

export async function getQuizHistory() {
  return readJsonArray(quizFile);
}

export async function createQuizSet(input) {
  const quizHistory = await getQuizHistory();
  const id = randomUUID();
  const quizSet = normalizeQuizSet(input, {}, { id });

  quizHistory.push(quizSet);
  await writeJsonArray(quizFile, quizHistory);
  return quizSet;
}
