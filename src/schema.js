export const DIFFICULTIES = [
  { value: "beginner", label: "初級" },
  { value: "intermediate", label: "中級" },
  { value: "advanced", label: "上級" },
  { value: "expert", label: "超上級" }
];

export const QUESTION_TYPES = [
  { value: "multiple-choice", label: "選択式" },
  { value: "true-false", label: "○×式" },
  { value: "fill-blank", label: "穴埋め" },
  { value: "short-answer", label: "短答式" }
];

export const TOPIC_STATUSES = [
  { value: "active", label: "学習中" },
  { value: "paused", label: "保留" },
  { value: "archived", label: "完了" }
];

export const PRIORITIES = [
  { value: "high", label: "高" },
  { value: "normal", label: "中" },
  { value: "low", label: "低" }
];

export const QUIZ_ACTION_TYPES = [
  { value: "create", label: "初回セット" },
  { value: "expand", label: "新規観点" },
  { value: "improve", label: "改善版" }
];

export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

const MAX_TARGET_LENGTH = 160;
const MAX_NOTE_LENGTH = 4000;
const MAX_QUIZ_TITLE_LENGTH = 160;

function cleanText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function requireText(value, fieldName, maxLength) {
  const text = cleanText(value);
  if (!text) {
    throw new ValidationError(fieldName + "は必須です。");
  }

  if (text.length > maxLength) {
    throw new ValidationError(fieldName + "は" + maxLength + "文字以内で入力してください。");
  }

  return text;
}

function optionalText(value, fieldName, maxLength) {
  const text = cleanText(value);
  if (text.length > maxLength) {
    throw new ValidationError(fieldName + "は" + maxLength + "文字以内で入力してください。");
  }

  return text;
}

function enumValue(value, options, fallback) {
  const text = cleanText(value);
  return options.some((option) => option.value === text) ? text : fallback;
}

export function normalizeStudyTopic(input, existing = {}, context = {}) {
  const now = context.now ?? new Date().toISOString();

  return {
    id: existing.id ?? context.id,
    target: requireText(
      input.target ?? input.title ?? existing.target ?? existing.title,
      "学習対象",
      MAX_TARGET_LENGTH
    ),
    priority: enumValue(input.priority ?? existing.priority, PRIORITIES, "normal"),
    status: enumValue(input.status ?? existing.status, TOPIC_STATUSES, "active"),
    note: optionalText(input.note ?? input.detail ?? existing.note ?? existing.detail, "補足", MAX_NOTE_LENGTH),
    createdAt: existing.createdAt ?? now,
    updatedAt: now
  };
}

function normalizeStringArray(value, maxItems = 20) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(cleanText).filter(Boolean).slice(0, maxItems);
}

function normalizeQuestion(input, context = {}) {
  const type = enumValue(input.type, QUESTION_TYPES, "multiple-choice");
  const difficulty = enumValue(input.difficulty, DIFFICULTIES, "beginner");
  const prompt = requireText(input.prompt, "問題文", 1000);
  const choices = normalizeStringArray(input.choices, 8);
  const answer = cleanText(input.answer);
  const explanation = optionalText(input.explanation, "解説", 3000);

  if (type === "multiple-choice" && choices.length < 2) {
    throw new ValidationError("選択式の問題には2つ以上の選択肢が必要です。");
  }

  if (!answer) {
    throw new ValidationError("正解は必須です。");
  }

  return {
    id: input.id ?? context.id,
    difficulty,
    type,
    prompt,
    choices,
    answer,
    explanation,
    sourceTopicId: cleanText(input.sourceTopicId)
  };
}

export function normalizeQuizSet(input, existing = {}, context = {}) {
  const now = context.now ?? new Date().toISOString();
  const questions = Array.isArray(input.questions) ? input.questions : [];

  if (questions.length === 0) {
    throw new ValidationError("クイズには1問以上の問題が必要です。");
  }

  return {
    id: existing.id ?? context.id,
    title: requireText(input.title ?? existing.title, "タイトル", MAX_QUIZ_TITLE_LENGTH),
    actionType: enumValue(input.actionType ?? existing.actionType, QUIZ_ACTION_TYPES, "create"),
    sourceTopicIds: normalizeStringArray(input.sourceTopicIds ?? existing.sourceTopicIds, 50),
    improvedFromQuizSetId: cleanText(input.improvedFromQuizSetId ?? existing.improvedFromQuizSetId),
    generationReason: optionalText(input.generationReason ?? existing.generationReason, "生成理由", 1000),
    questions: questions.map((question, index) =>
      normalizeQuestion(question, {
        id: question.id ?? context.id + "-q" + (index + 1)
      })
    ),
    createdAt: existing.createdAt ?? now,
    updatedAt: now
  };
}
