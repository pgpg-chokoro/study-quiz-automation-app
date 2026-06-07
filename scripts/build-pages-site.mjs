import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const siteDir = "docs";
const siteDataDir = path.join(siteDir, "data");

async function build() {
  await mkdir(siteDataDir, { recursive: true });

  await copyFile("public/styles.css", path.join(siteDir, "styles.css"));
  await copyFile("public/quizzes.js", path.join(siteDir, "quizzes.js"));
  await copyFile("data/quiz-history.json", path.join(siteDataDir, "quiz-history.json"));
  await writeFile(path.join(siteDir, ".nojekyll"), "", "utf8");

  const quizHistory = JSON.parse(await readFile("data/quiz-history.json", "utf8"));
  const quizCount = quizHistory.length;
  const questionCount = quizHistory.reduce((sum, quizSet) => sum + (quizSet.questions?.length ?? 0), 0);

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
    "        <div class=\"section-heading\">",
    "          <div>",
    "            <h2 id=\"quiz-heading\">クイズセット</h2>",
    `            <p id="quiz-count">${quizCount}セット / ${questionCount}問</p>`,
    "          </div>",
    "          <div class=\"filters\" aria-label=\"クイズフィルター\">",
    "            <select id=\"difficulty-filter\" aria-label=\"難易度\">",
    "              <option value=\"all\">全難易度</option>",
    "              <option value=\"beginner\">初級</option>",
    "              <option value=\"intermediate\">中級</option>",
    "              <option value=\"advanced\">上級</option>",
    "              <option value=\"expert\">超上級</option>",
    "            </select>",
    "            <select id=\"action-filter\" aria-label=\"生成種別\">",
    "              <option value=\"all\">全種別</option>",
    "              <option value=\"create\">新規作成</option>",
    "              <option value=\"expand\">追加</option>",
    "              <option value=\"improve\">改善</option>",
    "            </select>",
    "          </div>",
    "        </div>",
    "",
    "        <div id=\"quiz-error\" class=\"message error\" hidden></div>",
    "        <div id=\"quiz-content\" class=\"quiz-content\" aria-live=\"polite\"></div>",
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

  console.log(`Built ${siteDir} with ${quizCount} quiz sets and ${questionCount} questions.`);
}

await build();
