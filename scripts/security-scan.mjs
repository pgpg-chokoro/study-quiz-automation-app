import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", ".cache"]);
const textExtensions = new Set([
  ".js",
  ".mjs",
  ".json",
  ".html",
  ".css",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
  ""
]);

const secretPatterns = [
  { name: "OpenAI API key", pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: "GitHub classic token", pattern: /ghp_[A-Za-z0-9_]{20,}/g },
  { name: "GitHub fine-grained token", pattern: /github_pat_[A-Za-z0-9_]{20,}/g },
  { name: "Private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: "Bearer token literal", pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/g },
  { name: "Hardcoded password", pattern: /(?:password|passwd)\s*[:=]\s*["'][^"']{8,}["']/gi },
  { name: "Hardcoded secret", pattern: /(?:secret|client_secret)\s*[:=]\s*["'][^"']{8,}["']/gi },
  { name: "Hardcoded API key", pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][^"']{8,}["']/gi }
];

const personalInfoPatterns = [
  { name: "Email address", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { name: "Japanese phone-like number", pattern: /(?<![A-Za-z0-9-])0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}(?![A-Za-z0-9-])/g }
];

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function isTextFile(filePath) {
  return textExtensions.has(path.extname(filePath));
}

const issues = [];

const files = await listFiles(root);
for (const file of files) {
  if (!isTextFile(file)) {
    continue;
  }

  const fileStat = await stat(file);
  if (fileStat.size > 1_000_000) {
    continue;
  }

  const rel = relative(file);
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  const patterns = [...secretPatterns, ...personalInfoPatterns];

  for (const item of patterns) {
    item.pattern.lastIndex = 0;
    let match;
    while ((match = item.pattern.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split(/\r?\n/).length;
      const line = lines[lineNumber - 1] ?? "";
      issues.push(rel + ":" + lineNumber + ": " + item.name + ": " + line.trim());
    }
  }
}

const publishedFiles = files.map(relative).filter((file) => file.startsWith("docs/"));
if (publishedFiles.some((file) => file.includes("study-topics"))) {
  issues.push("docs/: 公開サイトにstudy-topicsが含まれています。");
}

if (publishedFiles.includes("docs/data/study-topics.json")) {
  issues.push("docs/data/study-topics.json: メモデータを公開サイトに含めないでください。");
}

if (issues.length > 0) {
  console.error("セキュリティスキャンに失敗しました。");
  for (const issue of issues) {
    console.error("- " + issue);
  }
  process.exit(1);
}

console.log("セキュリティスキャンに成功しました。検査ファイル数: " + files.length);
