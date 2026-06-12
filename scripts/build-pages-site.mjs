import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyQuizReview, createEmptyQuizReview, validateQuizReview } from "../src/quiz-review.js";

const siteDir = "docs";
const siteDataDir = path.join(siteDir, "data");

function attachTopicLabels(quizHistory, studyTopics) {
  const topicLabels = new Map(studyTopics.map((topic) => [topic.id, topic.target]));

  return quizHistory.map((quizSet) => ({
    ...quizSet,
    topicLabels: (quizSet.sourceTopicIds ?? []).map((topicId) => topicLabels.get(topicId) ?? topicId)
  }));
}

function countGenres(quizHistory) {
  return new Set(quizHistory.map((quizSet) => quizSet.sourceTopicIds?.[0] ?? "unknown")).size;
}

async function readQuizReview() {
  try {
    return JSON.parse(await readFile("data/quiz-review.json", "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return createEmptyQuizReview();
    }
    throw error;
  }
}

async function build() {
  await mkdir(siteDataDir, { recursive: true });

  await copyFile("public/styles.css", path.join(siteDir, "styles.css"));
  await copyFile("public/quizzes.js", path.join(siteDir, "quizzes.js"));
  await writeFile(path.join(siteDir, ".nojekyll"), "", "utf8");

  const quizHistory = JSON.parse(await readFile("data/quiz-history.json", "utf8"));
  const studyTopics = JSON.parse(await readFile("data/study-topics.json", "utf8"));
  const quizReview = await readQuizReview();
  const reviewIssues = validateQuizReview(quizReview, quizHistory);
  if (reviewIssues.length > 0) {
    throw new Error("quiz-review.json is invalid:\n- " + reviewIssues.join("\n- "));
  }

  const reviewResult = applyQuizReview(quizHistory, quizReview);
  const reviewedQuizHistory = reviewResult.quizHistory;
  const publicQuizHistory = attachTopicLabels(reviewedQuizHistory, studyTopics);
  await writeFile(path.join(siteDataDir, "quiz-history.json"), JSON.stringify(publicQuizHistory, null, 2) + "\n", "utf8");

  const genreCount = countGenres(reviewedQuizHistory);
  const quizCount = reviewedQuizHistory.length;
  const questionCount = reviewedQuizHistory.reduce((sum, quizSet) => sum + (quizSet.questions?.length ?? 0), 0);

  const html = [
    "<!doctype html>",
    "<html lang=\"ja\">",
    "  <head>",
    "    <meta charset=\"utf-8\">",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "    <title>クイズ回答 | Study Quiz Automation</title>",
    "    <link rel=\"stylesheet\" href=\"styles.css\">",
    "  </head>",
    "  <body>",
    "    <header class=\"app-header\">",
    "      <div>",
    "        <p class=\"eyebrow\">Study Quiz Automation</p>",
    "        <h1>クイズ回答</h1>",
    "      </div>",
    "      <div class=\"header-actions\">",
    "        <button class=\"icon-button\" id=\"refresh-button\" type=\"button\" aria-label=\"再読み込み\" title=\"再読み込み\">",
    "          ↻",
    "        </button>",
    "      </div>",
    "    </header>",
    "",
    "    <main class=\"quiz-workspace\">",
    "      <section class=\"quiz-browser\" aria-labelledby=\"quiz-heading\">",
    "        <div class=\"section-heading toolbar-heading\">",
    "          <div>",
    "            <h2 id=\"quiz-heading\">ジャンル</h2>",
    "            <p id=\"quiz-count\">" + genreCount + "ジャンル / " + quizCount + "セット / " + questionCount + "問</p>",
    "          </div>",
    "          <div class=\"filters\" aria-label=\"クイズフィルター\">",
    "            <select id=\"difficulty-filter\" aria-label=\"難易度\">",
    "              <option value=\"all\">全難易度</option>",
    "              <option value=\"beginner\">初級</option>",
    "              <option value=\"intermediate\">中級</option>",
    "              <option value=\"advanced\">上級</option>",
    "              <option value=\"expert\">超上級</option>",
    "            </select>",
    "            <select id=\"action-filter\" aria-label=\"作成目的\">",
    "              <option value=\"all\">全セット</option>",
    "              <option value=\"create\">初回セット</option>",
    "              <option value=\"expand\">新規観点</option>",
    "              <option value=\"improve\">改善版</option>",
    "            </select>",
    "            <button id=\"reset-filters-button\" class=\"secondary-button filter-reset\" type=\"button\" disabled>リセット</button>",
    "          </div>",
    "        </div>",
    "",
    "        <div id=\"quiz-error\" class=\"message error\" hidden></div>",
    "        <div id=\"quiz-content\" class=\"quiz-content\"></div>",
    "      </section>",
    "    </main>",
    "",
    "    <script>",
    "      window.QUIZ_HISTORY_URL = \"data/quiz-history.json\";",
    "    </script>",
    "    <script src=\"quizzes.js\" type=\"module\"></script>",
    "  </body>",
    "</html>",
    ""
  ].join("\n");

  await writeFile(path.join(siteDir, "index.html"), html, "utf8");
  await writeFile(path.join(siteDir, "quizzes.html"), html, "utf8");

  console.log("Built " + siteDir + " with " + genreCount + " genres, " + quizCount + " quiz sets and " + questionCount + " questions. Hidden by review: " + reviewResult.hiddenSetCount + " sets, " + reviewResult.hiddenQuestionCount + " questions.");
}

await build();
