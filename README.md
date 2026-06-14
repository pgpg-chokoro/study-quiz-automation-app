# Study Quiz Automation App

学習したいテーマをメモとして蓄積し、Codexオートメーションで定期的にクイズを生成・改善するためのアプリです。

## 特徴

- 複数の学習メモをファイル保存できます。
- クイズをジャンル別に表示し、ジャンル内の問題をまとめて回答できます。
- 追加日・追加理由などの履歴情報は、問題本文とは別に確認できます。
- データは `data/*.json` に保存されるため、Codexオートメーションが直接読み書きできます。
- 初期版は外部パッケージなしで動作します。

## 起動方法

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

ポートを変えたい場合は、環境変数 `PORT` を指定します。

```bash
PORT=3001 npm run dev
```

## データファイル

- `data/study-topics.json`: 学習メモ一覧
- `data/quiz-history.json`: クイズ生成・改善履歴
- `data/quiz-review.json`: クイズのレビュー判定。`qualityTags` で改善理由を分類できます。

JSONファイルはアプリとCodexオートメーションの共有データです。手動編集する場合は、各ファイルの形式を維持してください。

## 検証コマンド

```bash
npm run check
npm test
npm run validate:duplicates
npm run validate:review
npm run review:quiz
```

`review:quiz` はCIを落とすチェックではなく、類似問題、解説不足、正答位置偏り、改善元未判定、カバレッジ不足などをレビュー候補として出力します。

## Codexオートメーション

運用ルールは [project-docs/automation.md](project-docs/automation.md) を参照してください。

## GitHub Pages

公開用の静的クイズサイトは `docs/` に生成します。

```bash
npm run build:pages
```

公開前には以下を実行してください。

```bash
npm run prepublish:check
```

公開サイトにはクイズ回答ページと `docs/data/quiz-history.json` のみを含め、学習メモ `data/study-topics.json` は含めません。`docs/data/quiz-history.json` には、ジャンル表示に必要な学習対象名だけを `topicLabels` として含めます。`data/quiz-review.json` で `decision: "hide"` にしたクイズセットや問題は、履歴を残したまま公開データから除外されます。

## Codex Cloud

Codex Cloudでの生成・レビュー運用は [project-docs/codex-cloud-workflow.md](project-docs/codex-cloud-workflow.md) を参照してください。
