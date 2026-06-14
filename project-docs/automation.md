# Codexオートメーション運用ルール

このアプリでは、ユーザーが大まかな学習対象だけを登録し、Codexが対象範囲・観点・難易度を広めに判断してクイズを生成します。

## 参照ファイル

- `data/study-topics.json`: 学習したい対象の一覧
- `data/quiz-history.json`: 生成済みクイズセットの履歴
- `data/quiz-review.json`: 公開可否や改善要否のレビュー判定

`study-topics.json` と `quiz-history.json` はJSON配列です。既存データは上書きせず、クイズ生成・改善の結果は `quiz-history.json` に追記します。Codex Cloudや自動化で作業する場合も、`study-topics.json` は入力元として読み取り、ユーザーから明示されない限り編集しません。`quiz-review.json` は履歴を消さずに公開対象を調整するための判定ファイルです。

## 学習メモの扱い

ユーザー入力欄は `学習対象 / 優先度 / 状態 / 補足` だけです。`target` には「HTML」「セキュリティ」「ネットワーク」「React」のような大まかな語を入れる想定です。Codexは `note` を補助情報として使い、細かい分野分けは自分で判断します。

```json
{
  "id": "topic-id",
  "target": "セキュリティ",
  "priority": "high",
  "status": "active",
  "note": "Webアプリの代表的な攻撃と対策を広めに扱いたい",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-07T00:00:00.000Z"
}
```

Codexは `status` が `active` のメモを主な対象にします。

## クイズ履歴の形式

```json
{
  "id": "quiz-set-id",
  "title": "セキュリティ 基礎確認",
  "actionType": "create",
  "sourceTopicIds": ["topic-id"],
  "improvedFromQuizSetId": "",
  "generationReason": "新規メモに対する初回生成",
  "questions": [
    {
      "id": "question-id",
      "difficulty": "beginner",
      "type": "multiple-choice",
      "prompt": "XSSの主なリスクはどれですか？",
      "choices": ["不正なスクリプト実行", "画像の高圧縮", "DNSの高速化", "CSSの自動整形"],
      "answer": "不正なスクリプト実行",
      "explanation": "XSSは入力や表示の不備を通じて、利用者のブラウザ上で意図しないスクリプトを実行させる攻撃です。",
      "sourceTopicId": "topic-id"
    }
  ],
  "createdAt": "2026-06-07T00:00:00.000Z",
  "updatedAt": "2026-06-07T00:00:00.000Z"
}
```

## 難易度

- `beginner`: 初級
- `intermediate`: 中級
- `advanced`: 上級
- `expert`: 超上級

初回生成では可能な範囲で4段階を含めます。テーマが狭い場合は、無理に超上級を作らず、解説の品質を優先します。

## 問題形式

原則は `multiple-choice` です。テーマや難易度に応じて、Codex判断で以下も使用できます。

- `true-false`: ○×式
- `fill-blank`: 穴埋め
- `short-answer`: 短答式

選択式の場合は `choices` を2件以上設定します。どの形式でも `answer` と `explanation` は必須です。

## 定期実行時の方針

1. `study-topics.json` を読み、`status` が `active` のメモを対象にする。
2. `target` を大分類として扱い、必要な小分類・観点・出題範囲はCodexが判断する。
3. `priority` が `high` のメモと、最近クイズが作られていないメモを優先する。
4. 新しい観点があれば、`actionType: "create"` または `"expand"` で追記する。
5. 新規ネタが少ない場合は、既存クイズを見直して `actionType: "improve"` で追記する。
6. 改善時は `improvedFromQuizSetId` に元クイズセットIDを入れる。
7. 既存の履歴は削除・上書きしない。

## 品質基準

- 問題文は単独で意味が分かるようにする。
- 選択肢は明らかに不自然なものを避ける。
- 正答位置が全問同じにならないよう、選択肢順を分散する。
- 正答は選択肢に一意に含める。
- 正解は一意に判断できるようにする。
- 解説には「なぜ正しいか」と「誤答しやすい点」を含める。
- 大まかな対象から、基礎用語、実務例、典型ミス、比較、例外ケースまで広げる。
- 超上級では単なる暗記ではなく、設計判断、攻撃シナリオ、トレードオフ、応用を問う。

## クイズレビュー判定

似た問題や品質に不安がある問題は、`data/quiz-history.json` から削除せず、`data/quiz-review.json` に判定を記録します。

判定の `decision` は以下を使います。

- `keep`: 類似クラスタの代表として公開を継続する。
- `hide`: 履歴には残すが、GitHub Pages向けの公開データから除外する。
- `needs-improvement`: 公開は継続するが、次回以降の改善候補として記録する。

`scope` は `quiz-set` または `question` を使います。`question` の場合は `quizSetId` と `questionId` の両方が必要です。`hide` と `needs-improvement` には、必ず `reason` を書きます。`qualityTags` は任意ですが、改善理由を機械的に拾いやすくするため、該当するものを付けます。

推奨する `qualityTags` は以下です。

- `ambiguous-answer`: 正答が一意に決まりにくい。
- `weak-explanation`: 解説が薄い、誤答しやすい点が不足している。
- `unnatural-distractors`: 誤答選択肢が不自然、または正答だけが浮いている。
- `difficulty-mismatch`: 難易度ラベルと実際の要求水準が合っていない。
- `duplicate-better-exists`: 似た良問があり、代表問題へ寄せるべき。
- `coverage-gap`: ジャンル内の出題観点が偏っている。
- `factual-risk`: 事実誤り、または根拠が不安定な可能性がある。
- `cognitive-load-high`: 条件が多すぎる、読み取り負荷が高すぎる。
- `answer-position-skew`: 正答位置の偏りが目立つ。

公開サイト生成時は、`hide` 判定のクイズセットや問題だけを除外します。`quiz-history.json` の既存履歴は変更しません。

## レビューの4層構造

1. 必須チェック: JSON構造、必須項目、正答の一意性、選択肢重複、空欄、append-only、公開データ混入をCIで確認する。
2. レビュー候補レポート: 類似問題、短い解説、難易度不足、正答位置偏り、改善元未判定、カバレッジ不足を `npm run review:quiz` で出す。
3. サブエージェント品質レビュー: 新規追加セットを対象に、自然さ、難易度、選択肢、解説、重複、カバレッジを確認する。
4. 判定確定: 担当Codexまたは人間が `keep` / `hide` / `needs-improvement` を確定し、次回自動化の入力にする。

## keep / hide / needs-improvement の判断基準

- `keep`: 内容が正確、問題文だけで理解できる、正答が一意、誤答に教育的意味がある、難易度が妥当、類似していても別観点・別難易度として価値がある。
- `needs-improvement`: 核となる内容は正しいが、表現、選択肢、解説、難易度、カバレッジのいずれかに改善余地がある。
- `hide`: 事実誤り、正答曖昧、問題文だけでは意味が分からない、誤解を強める、完全重複または既存の良問に劣る、改善版に置き換え済み。

## 推奨される自動化プロンプト

```text
data/study-topics.json と data/quiz-history.json を確認してください。
activeな学習メモを対象に、targetを大分類として解釈し、細かい観点や出題範囲はCodex側で判断してください。
未出題の観点があればクイズセットを新規作成または追加してください。
新規ネタが少ない場合は、既存クイズを改善し、改善版をquiz-history.jsonへ追記してください。
難易度は beginner / intermediate / advanced / expert を使い、原則multiple-choiceにしてください。
テーマや難易度に応じて true-false / fill-blank / short-answer も使って構いません。
既存履歴は削除・上書きせず、必ず追記してください。
生成後は npm run prepublish:check を実行し、構造チェック、追記専用チェック、レビュー判定チェック、レビュー候補レポート、セキュリティスキャンを確認してください。
npm run review:quiz の候補が出た場合は、必要に応じて data/quiz-review.json に keep / hide / needs-improvement と qualityTags を記録してください。
needs-improvement がある場合は、次回以降の improve / expand で優先的に解消してください。
```
