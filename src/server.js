import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createQuizSet,
  createStudyTopic,
  deleteStudyTopic,
  getQuizHistory,
  getStudyTopics,
  projectRoot,
  updateStudyTopic
} from "./data-store.js";
import { NotFoundError, ValidationError } from "./schema.js";

const publicDir = path.join(projectRoot, "public");
const staticFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/quizzes.html", "quizzes.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
  ["/quizzes.js", "quizzes.js"]
]);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

function attachTopicLabels(quizHistory, studyTopics) {
  const topicLabels = new Map(studyTopics.map((topic) => [topic.id, topic.target]));

  return quizHistory.map((quizSet) => ({
    ...quizSet,
    topicLabels: (quizSet.sourceTopicIds ?? []).map((topicId) => topicLabels.get(topicId) ?? topicId)
  }));
}


function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendNoContent(response) {
  response.writeHead(204, {
    "cache-control": "no-store"
  });
  response.end();
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new ValidationError("リクエスト本文が大きすぎます。");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ValidationError("JSONの形式が正しくありません。");
  }
}

async function serveStatic(requestPath, response) {
  const filename = staticFiles.get(requestPath);

  if (!filename) {
    return false;
  }

  const filePath = path.join(publicDir, filename);
  const extension = path.extname(filePath);
  const body = await readFile(filePath);

  response.writeHead(200, {
    "content-type": contentTypes[extension] ?? "application/octet-stream"
  });
  response.end(body);
  return true;
}

async function handleApi(request, response, requestPath) {
  const topicMatch = requestPath.match(/^\/api\/topics\/([^/]+)$/);

  if (request.method === "GET" && requestPath === "/api/topics") {
    sendJson(response, 200, { topics: await getStudyTopics() });
    return;
  }

  if (request.method === "POST" && requestPath === "/api/topics") {
    const topic = await createStudyTopic(await readJsonBody(request));
    sendJson(response, 201, { topic });
    return;
  }

  if (topicMatch && request.method === "PUT") {
    const topic = await updateStudyTopic(decodeURIComponent(topicMatch[1]), await readJsonBody(request));
    sendJson(response, 200, { topic });
    return;
  }

  if (topicMatch && request.method === "DELETE") {
    await deleteStudyTopic(decodeURIComponent(topicMatch[1]));
    sendNoContent(response);
    return;
  }

  if (request.method === "GET" && requestPath === "/api/quizzes") {
    const [quizHistory, studyTopics] = await Promise.all([getQuizHistory(), getStudyTopics()]);
    sendJson(response, 200, { quizHistory: attachTopicLabels(quizHistory, studyTopics) });
    return;
  }

  if (request.method === "POST" && requestPath === "/api/quizzes") {
    const quizSet = await createQuizSet(await readJsonBody(request));
    sendJson(response, 201, { quizSet });
    return;
  }

  sendJson(response, 404, { error: "APIエンドポイントが見つかりません。" });
}

async function requestListener(request, response) {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url.pathname);
      return;
    }

    if (await serveStatic(url.pathname, response)) {
      return;
    }

    sendJson(response, 404, { error: "ページが見つかりません。" });
  } catch (error) {
    if (error instanceof ValidationError) {
      sendJson(response, 400, { error: error.message, details: error.details });
      return;
    }

    if (error instanceof NotFoundError) {
      sendJson(response, 404, { error: error.message });
      return;
    }

    console.error(error);
    sendJson(response, 500, { error: "サーバーで問題が発生しました。" });
  }
}

export function createApp() {
  return http.createServer(requestListener);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  createApp().listen(port, () => {
    console.log(`Study Quiz Automation App: http://localhost:${port}`);
  });
}
