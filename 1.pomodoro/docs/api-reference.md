# API リファレンス

ポモドーロタイマーの REST API エンドポイント仕様です。

---

## エンドポイント一覧

| メソッド | パス               | 概要                           |
|----------|--------------------|--------------------------------|
| GET      | `/`                | フロントエンド HTML を返す     |
| GET      | `/api/config`      | タイマー設定値を返す           |
| POST     | `/api/sessions`    | 完了セッションを記録する       |
| GET      | `/api/stats/today` | 当日の作業統計を返す           |

---

## GET `/`

HTML ページを返します。

**レスポンス**

- ステータスコード: `200 OK`
- Content-Type: `text/html`

---

## GET `/api/config`

タイマーの設定値を JSON 形式で返します。

**レスポンス**

- ステータスコード: `200 OK`
- Content-Type: `application/json`

```json
{
  "workSec": 1500,
  "breakSec": 300,
  "longBreakSec": 900,
  "longBreakInterval": 4
}
```

| フィールド          | 型      | 説明                                     |
|---------------------|---------|------------------------------------------|
| `workSec`           | integer | 作業フェーズの秒数（デフォルト: 1500）   |
| `breakSec`          | integer | 休憩フェーズの秒数（デフォルト: 300）    |
| `longBreakSec`      | integer | 長休憩フェーズの秒数（デフォルト: 900）  |
| `longBreakInterval` | integer | 長休憩を挟む作業回数（デフォルト: 4）    |

---

## POST `/api/sessions`

完了したセッション（作業または休憩）をデータベースに記録します。

**リクエスト**

- Content-Type: `application/json`

```json
{
  "kind": "work",
  "started_at": "2026-04-17T10:00:00",
  "ended_at": "2026-04-17T10:25:00",
  "duration_sec": 1500
}
```

| フィールド     | 型      | 必須 | 説明                                      |
|----------------|---------|------|-------------------------------------------|
| `kind`         | string  | ✓   | セッション種別。`"work"` または `"break"` |
| `started_at`   | string  | ✓   | 開始日時（ISO 8601 形式）                 |
| `ended_at`     | string  | ✓   | 終了日時（ISO 8601 形式）                 |
| `duration_sec` | integer | ✓   | セッションの秒数（0 以上）                |

**レスポンス（成功）**

- ステータスコード: `201 Created`

```json
{ "status": "ok" }
```

**レスポンス（エラー）**

| ステータスコード | 条件                                          | レスポンス例                            |
|------------------|-----------------------------------------------|-----------------------------------------|
| `400`            | リクエストボディが JSON でない                | `{"error": "Invalid JSON"}`             |
| `400`            | 必須フィールドが欠けている                    | `{"error": "Missing required fields"}`  |
| `400`            | `kind` が無効、または `duration_sec` が負の値 | `{"error": "Invalid input"}`            |
| `500`            | サーバー内部エラー                            | `{"error": "An internal error has occurred"}` |

---

## GET `/api/stats/today`

当日（ローカル時刻基準）の作業セッション統計を返します。

> 集計対象は `kind = 'work'` のセッションのみです。休憩セッションは集計に含まれません。

**レスポンス**

- ステータスコード: `200 OK`
- Content-Type: `application/json`

```json
{
  "count": 3,
  "total_sec": 4500,
  "total_min": 75
}
```

| フィールド   | 型      | 説明                                 |
|--------------|---------|--------------------------------------|
| `count`      | integer | 当日完了した作業セッション数         |
| `total_sec`  | integer | 当日の作業時間合計（秒）             |
| `total_min`  | integer | 当日の作業時間合計（分、切り捨て）   |
