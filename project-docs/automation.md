# Codexオートメーション運用ルール

このアプリでは、ユーザーが大まかな学習対象だけを登録し、Codexが対象範囲・観点・難易度を広めに判断してクイズを生成します。

## 参照ファイル

- `data/study-topics.json`: 学習したい対象の一覧
- `data/quiz-history.json`: 生成済みクイズセットの履歴

どちらもJSON配列です。既存データは上書きせず、クイズ生成・改善の結果は `quiz-history.json` に追記します。Codex Cloudや自動化で作業する場合も、`study-topics.json` は入力元として読み取り、ユーザーから明示されない限り編集しません。

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

## 推奨される自動化プロンプト

```text
data/study-topics.json と data/quiz-history.json を確認してください。
activeな学習メモを対象に、targetを大分類として解釈し、細かい観点や出題範囲はCodex側で判断してください。
未出題の観点があればクイズセットを新規作成または追加してください。
新規ネタが少ない場合は、既存クイズを改善し、改善版をquiz-history.jsonへ追記してください。
難易度は beginner / intermediate / advanced / expert を使い、原則multiple-choiceにしてください。
テーマや難易度に応じて true-false / fill-blank / short-answer も使って構いません。
既存履歴は削除・上書きせず、必ず追記してください。
生成後は npm run validate:quiz を実行し、正答位置の偏り、解説不足、選択肢不備を確認してください。
npm run validate:append-only も実行し、quiz-history.json が既存履歴を変更せず末尾追記だけになっていることを確認してください。
```
