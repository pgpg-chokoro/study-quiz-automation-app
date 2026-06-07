# Study Quiz Automation App

学習したいテーマをメモとして蓄積し、Codexオートメーションで定期的にクイズを生成・改善するためのアプリです。

## 特徴

- 複数の学習メモをファイル保存できます。
- クイズ履歴を難易度別に確認できます。
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

JSONファイルはアプリとCodexオートメーションの共有データです。手動編集する場合は、配列形式を維持してください。

## 検証コマンド

```bash
npm run check
npm test
```

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

公開サイトにはクイズ回答ページと `docs/data/quiz-history.json` のみを含め、学習メモ `data/study-topics.json` は含めません。

## Codex Cloud

Codex Cloudでの生成・レビュー運用は [project-docs/codex-cloud-workflow.md](project-docs/codex-cloud-workflow.md) を参照してください。
