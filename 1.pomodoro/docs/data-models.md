# データモデル仕様

ポモドーロタイマーが使用するデータモデルを説明します。

---

## データベース

- **種別**: SQLite
- **ファイルパス**: `1.pomodoro/pomodoro.db`（アプリ起動時に自動生成）
- **初期化**: `backend/models/database.py` の `init_db()` で `CREATE TABLE IF NOT EXISTS` を実行

---

## テーブル: `sessions`

完了したタイマーセッション（作業・休憩）を記録するテーブルです。

### スキーマ

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kind         TEXT    NOT NULL CHECK (kind IN ('work', 'break')),
    started_at   TEXT    NOT NULL,
    ended_at     TEXT    NOT NULL,
    duration_sec INTEGER NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

### カラム定義

| カラム名       | 型      | 制約                              | 説明                              |
|----------------|---------|-----------------------------------|-----------------------------------|
| `id`           | INTEGER | PRIMARY KEY AUTOINCREMENT         | 自動採番の主キー                  |
| `kind`         | TEXT    | NOT NULL, CHECK IN ('work','break') | セッション種別                  |
| `started_at`   | TEXT    | NOT NULL                          | 開始日時（ISO 8601 文字列）       |
| `ended_at`     | TEXT    | NOT NULL                          | 終了日時（ISO 8601 文字列）       |
| `duration_sec` | INTEGER | NOT NULL                          | セッション時間（秒）              |
| `created_at`   | TEXT    | NOT NULL, DEFAULT datetime('now','localtime') | レコード作成日時  |

### `kind` の値

| 値      | 意味         |
|---------|--------------|
| `work`  | 作業セッション |
| `break` | 休憩セッション（短時間・長時間いずれも同値） |

---

## 集計クエリ

### 当日の作業統計（`get_today_stats`）

```sql
SELECT
    COUNT(*) AS count,
    COALESCE(SUM(duration_sec), 0) AS total_sec
FROM sessions
WHERE kind = 'work'
  AND date(started_at) = date('now', 'localtime')
```

- 休憩セッション（`kind = 'break'`）は集計対象外
- 日付比較はサーバーのローカルタイムを基準とする

---

## バリデーションルール

バリデーションはサービス層（`session_service.py`）で実施します。

| フィールド     | ルール                                                  |
|----------------|---------------------------------------------------------|
| `kind`         | `"work"` または `"break"` のみ許可。それ以外は `ValueError` |
| `duration_sec` | 0 以上の整数。負の値は `ValueError`                     |
| `started_at`   | 必須。形式はフロントエンド側が ISO 8601 を保証          |
| `ended_at`     | 必須。形式はフロントエンド側が ISO 8601 を保証          |

---

## localStorage スキーマ

フロントエンドは `localStorage` にタイマー状態を保存します。

### キー: `pomodoro_state`

```json
{
  "state": "running",
  "phase": "work",
  "remaining": 1350,
  "completedCount": 2,
  "savedAt": 1713340800000
}
```

| フィールド       | 型      | 説明                                                       |
|------------------|---------|------------------------------------------------------------|
| `state`          | string  | タイマー状態。`idle` / `running` / `paused` / `completed`  |
| `phase`          | string  | 現在のフェーズ。`work` / `break` / `long_break`            |
| `remaining`      | integer | 残り秒数                                                   |
| `completedCount` | integer | 連続完了した作業セッション数（長休憩周期の計算に使用）     |
| `savedAt`        | integer | 保存時の UNIX ミリ秒タイムスタンプ                         |

### キー: `pomodoro_failed_sessions`

API 送信に失敗したセッションの再送キューです。

```json
[
  {
    "kind": "work",
    "started_at": "2026-04-17T10:00:00.000Z",
    "ended_at": "2026-04-17T10:25:00.000Z",
    "duration_sec": 1500,
    "retries": 1
  }
]
```

| フィールド     | 型      | 説明                               |
|----------------|---------|------------------------------------|
| `kind`         | string  | セッション種別                     |
| `started_at`   | string  | 開始日時（ISO 8601）               |
| `ended_at`     | string  | 終了日時（ISO 8601）               |
| `duration_sec` | integer | セッション時間（秒）               |
| `retries`      | integer | 再試行回数（最大 3 回で破棄）      |
