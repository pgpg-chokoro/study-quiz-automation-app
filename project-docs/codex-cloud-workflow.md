# Codex Cloud運用手順

このプロジェクトは、ローカルPCを起動し続けずにクイズ生成・改善を進めるため、GitHub上のリポジトリをCodex Cloudで扱う運用を想定します。

## 公開範囲

- GitHubリポジトリはpublicです。
- GitHub Pagesで公開するのは `docs/` 配下のクイズ回答ページだけです。
- 公開サイトには `docs/data/quiz-history.json` だけを含めます。
- `data/study-topics.json` は公開サイトには含めません。
- ただしpublicリポジトリなので、GitHub上のソースファイルとしては `data/study-topics.json` も閲覧可能です。個人情報や秘密情報は書かないでください。

## ローカルでの公開前チェック

push前に必ず以下を実行します。

```bash
npm run prepublish:check
```

このコマンドは以下をまとめて実行します。

- `npm run build:pages`: GitHub Pages用の静的サイトを生成
- `npm run check`: JavaScript構文チェック
- `npm test`: データ保存テストとクイズ品質チェック
- `npm run security:scan`: 秘密情報・個人情報らしき文字列と公開サイト混入を確認

## Codex Cloudでクイズ生成・改善する手順

1. Codex CloudでこのGitHubリポジトリを開く。
2. 以下の生成プロンプトを使って作業を依頼する。
3. Codex Cloudの差分を確認する。
4. `npm run prepublish:check` が通っていることを確認する。
5. PRとして作成し、必要に応じてレビュー後にmergeする。

## 生成プロンプト

```text
data/study-topics.json と data/quiz-history.json を確認してください。
activeな学習メモを対象に、targetを大分類として解釈し、細かい観点や出題範囲はCodex側で判断してください。
未出題の観点があればクイズセットを新規作成または追加してください。
新規ネタが少ない場合は、既存クイズを改善し、改善版をquiz-history.jsonへ追記してください。
既存履歴は削除・上書きせず、必ず追記してください。
難易度は beginner / intermediate / advanced / expert を使ってください。
原則multiple-choiceにしてください。テーマや難易度に応じて true-false / fill-blank / short-answer も使って構いません。
選択式では、正答位置が全問同じにならないように選択肢順を分散してください。
正答は選択肢に一意に含め、解説は必ず入れてください。
npm run prepublish:check を実行し、失敗した場合は修正してください。
変更内容、追加したクイズ、検証結果を日本語で報告してください。
```

## レビュープロンプト

生成後、別スレッドまたはサブエージェントに以下を依頼します。

```text
data/quiz-history.json の直近追加分をレビューしてください。
コード変更はせず、内容の自然さ、難易度の妥当性、選択肢の紛らわしさ、解説の品質を確認してください。
問題があれば、クイズセット名、Q番号、問題点、改善案を短く箇条書きで報告してください。
問題がなければ、その旨を明記してください。
```

## GitHub Pages

GitHub PagesのSourceを `main` ブランチの `/docs` に設定します。`npm run build:pages` が `docs/` に公開用ファイルを生成します。
