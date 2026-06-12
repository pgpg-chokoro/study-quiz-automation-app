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
- `npm run validate:append-only`: `data/quiz-history.json` が既存履歴を変更せず末尾追記だけになっているか確認
- `npm run validate:review`: `data/quiz-review.json` の参照先と形式を確認
- `npm run review:quiz`: 類似問題、解説不足、難易度の偏りなどのレビュー候補を出力
- `npm run security:scan`: 秘密情報・個人情報らしき文字列と公開サイト混入を確認

## Codex Cloudでクイズ生成・改善する手順

1. Codex CloudでこのGitHubリポジトリを開く。
2. 以下の生成プロンプトを使って作業を依頼する。
3. Codex Cloudの差分を確認し、`data/quiz-history.json` が配列末尾への追記だけになっていることを確認する。
4. `npm run prepublish:check` が通っていることを確認する。
5. PRとして作成し、必要に応じてレビュー後にmergeする。

## Codex Cloud作業時の固定ルール

- ルートの `AGENTS.md` にあるリポジトリ指示を必ず守ります。
- `data/study-topics.json` は入力元として扱い、ユーザーから明示されない限り編集しません。
- `data/quiz-history.json` の既存クイズセットは削除・上書き・並べ替えせず、必ず末尾へ追記します。
- 改善版を作る場合は `actionType: "improve"` とし、`improvedFromQuizSetId` に元クイズセットIDを入れます。
- 類似問題や品質不安の扱いは `data/quiz-review.json` に記録し、既存の `data/quiz-history.json` から削除しません。
- 公開対象から外す場合は `decision: "hide"` を使います。履歴は残り、GitHub Pages向けデータからだけ除外されます。
- PRではCIの `prepublish-check` が通っていることを確認します。

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
data/study-topics.json は編集せず、data/quiz-history.json は既存履歴を削除・上書き・並べ替えせず末尾追記だけにしてください。
変更内容、追加したクイズ、検証結果を日本語で報告してください。
```

## レビュープロンプト

生成後、別スレッドまたはサブエージェントに以下を依頼します。

```text
このPRで data/quiz-history.json に追加されたクイズセットだけをレビューしてください。PR差分を見られない場合は、配列末尾の新規追加分を対象にしてください。
コード変更はせず、内容の自然さ、難易度の妥当性、選択肢の紛らわしさ、解説の品質、既存履歴が変更されていないことを確認してください。
問題があれば、クイズセット名、Q番号、問題点、改善案を短く箇条書きで報告してください。
似た問題がある場合は、どちらを `keep` として残し、どちらを `hide` 候補にするかも提案してください。
問題がなければ、その旨を明記してください。
```

## GitHub Pages

GitHub PagesのSourceを `main` ブランチの `/docs` に設定します。`npm run build:pages` が `docs/` に公開用ファイルを生成します。
