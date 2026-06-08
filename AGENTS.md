# Repository Instructions for Codex

このリポジトリは、学習メモからクイズを生成・改善し、GitHub Pagesで回答用サイトを公開するためのNode.jsアプリです。

## 基本方針

- 作業前に `project-docs/automation.md` と `project-docs/codex-cloud-workflow.md` を確認してください。
- `data/study-topics.json` は学習メモの入力元です。クイズ生成・改善タスクでは原則として読むだけにし、ユーザーから明示された場合以外は編集しないでください。
- `data/quiz-history.json` は履歴です。既存のクイズセットや問題は削除・上書き・並べ替えせず、必ず配列末尾へ追記してください。
- 改善版を作る場合は `actionType: "improve"` とし、`improvedFromQuizSetId` に元のクイズセットIDを入れてください。
- 新規観点の追加は `actionType: "create"` または `"expand"` を使ってください。
- クイズ本文、選択肢、解説は日本語で書いてください。

## クイズ品質

- 難易度は `beginner` / `intermediate` / `advanced` / `expert` を使ってください。
- 原則 `multiple-choice` にしてください。必要に応じて `true-false` / `fill-blank` / `short-answer` も使えます。
- 選択式では、正答を選択肢に一意に含め、正答位置が全問同じにならないようにしてください。
- 解説は必須です。「なぜ正しいか」と「誤答しやすい点」を含めてください。
- 問題文は単独で意味が分かるようにしてください。

## 公開・安全性

- GitHub Pagesへ公開するのは `docs/` 配下だけです。
- `docs/` には `docs/data/quiz-history.json` のみを含め、`study-topics.json` を含めないでください。
- publicリポジトリなので、`data/study-topics.json` に個人情報、秘密情報、非公開の業務情報を書かないでください。

## 検証

- push前またはPR作成前に `npm run prepublish:check` を実行してください。
- クイズ履歴を変更する場合は、既存履歴を変更せず末尾追記だけになっていることを確認してください。
- 検証に失敗した場合は、原因を修正してから再実行してください。
