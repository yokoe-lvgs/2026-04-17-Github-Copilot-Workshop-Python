# フロントエンド仕様

ポモドーロタイマーのフロントエンドは、4 つの JavaScript モジュールと 1 つの HTML テンプレートで構成されています。

---

## モジュール一覧

| ファイル            | モジュール名  | 役割                              |
|---------------------|---------------|-----------------------------------|
| `timer-core.js`     | `TimerCore`   | タイマー状態管理（純粋ロジック）  |
| `persistence.js`    | `Persistence` | localStorage への保存/復元        |
| `api-client.js`     | `ApiClient`   | Flask API 通信                    |
| `ui-binder.js`      | `UIBinder`    | DOM 描画・イベントバインド        |

スクリプトの読み込み順は `index.html` で次の通り定義されています。

```html
<script src="timer-core.js"></script>
<script src="persistence.js"></script>
<script src="api-client.js"></script>
<script src="ui-binder.js"></script>
```

---

## TimerCore (`timer-core.js`)

タイマーの状態遷移と時間計算のみを担う純粋ロジックモジュールです。DOM や API への依存はありません。

### 状態 (`STATES`)

| 値          | 説明                   |
|-------------|------------------------|
| `idle`      | 待機中                 |
| `running`   | カウントダウン実行中   |
| `paused`    | 一時停止中             |
| `completed` | タイマー完了           |

### フェーズ (`PHASES`)

| 値           | 説明       |
|--------------|------------|
| `work`       | 作業フェーズ（デフォルト 25 分） |
| `break`      | 短休憩フェーズ（デフォルト 5 分） |
| `long_break` | 長休憩フェーズ（デフォルト 15 分） |

長休憩は `longBreakInterval`（デフォルト 4）回の作業セッション完了ごとに挿入されます。

### 時間計算方式

残り時間は `setInterval` による単純減算ではなく、`endTimestamp - Date.now()` から算出します。タブ非アクティブ時や復帰時の時刻ズレを防ぎます。

### 状態遷移

```
idle ──start()──► running ──tick()完了──► completed
         ▲              │
         │         pause()
      start()           ▼
         └──────── paused
any ──reset()──► idle
```

### 公開 API

| メソッド/プロパティ       | 説明                                          |
|---------------------------|-----------------------------------------------|
| `start()`                 | タイマー開始（idle/paused → running）         |
| `pause()`                 | 一時停止（running → paused）                  |
| `reset()`                 | リセット（any → idle、フェーズも work に戻す） |
| `tick()`                  | 残り時間を更新。完了時に state を completed に変更 |
| `advancePhase()`          | 次フェーズへ遷移し state を idle にする        |
| `getState()`              | 現在の state を返す                           |
| `getPhase()`              | 現在のフェーズを返す                          |
| `getRemaining()`          | 残り秒数を返す                                |
| `getTotalSec()`           | 現在フェーズの総秒数を返す                    |
| `getProgress()`           | 経過率を返す（0.0 ～ 1.0）                    |
| `getCompletedCount()`     | 連続完了した作業セッション数を返す            |
| `setConfig(config)`       | タイマー設定を上書きする                      |
| `setClock(fn)`            | テスト用クロック関数を注入する                |
| `resetStats()`            | `completedCount` を 0 にリセット              |
| `restore(snapshot)`       | ブラウザ再読込時に内部状態を復元する          |

---

## Persistence (`persistence.js`)

`localStorage` を使ってタイマー状態を保存・復元します。`TimerCore` に依存します。

### localStorage キー

- `pomodoro_state` — タイマー状態のスナップショット

### 公開 API

| メソッド  | 説明                                           |
|-----------|------------------------------------------------|
| `save()`  | TimerCore の現在状態を localStorage に保存する |
| `load()`  | localStorage から状態を読み込み、オブジェクトを返す（失敗時は `null`） |
| `clear()` | localStorage の保存データを削除する            |

---

## ApiClient (`api-client.js`)

Flask API との通信を担います。送信失敗時はローカルキューに蓄積し、次回送信時に再試行します。

### localStorage キー

- `pomodoro_failed_sessions` — 送信失敗セッションの再送キュー（最大 3 回まで再試行）

### 公開 API

| メソッド                                                    | 説明                                      |
|-------------------------------------------------------------|-------------------------------------------|
| `postSession(kind, startedAt, endedAt, durationSec)`        | セッションを `POST /api/sessions` に送信  |
| `getTodayStats()`                                           | `GET /api/stats/today` から統計を取得     |
| `getConfig()`                                               | `GET /api/config` からタイマー設定を取得  |
| `flushQueue()`                                              | 失敗キューの再送を試みる                  |

`postSession()` は送信前に失敗キューのフラッシュを自動実行します。

---

## UIBinder (`ui-binder.js`)

DOM 要素への描画とユーザーイベントのバインドを担います。`TimerCore`・`Persistence`・`ApiClient` に依存します。

### 対象 DOM 要素

| 要素 ID           | 役割                         |
|-------------------|------------------------------|
| `phase-label`     | 現在フェーズ名の表示         |
| `timer-display`   | 残り時間（`MM:SS`）の表示    |
| `progress-ring`   | SVG 円形プログレスリング     |
| `btn-start`       | 開始/一時停止/再開ボタン     |
| `btn-reset`       | リセットボタン               |
| `stat-count`      | 当日完了セッション数         |
| `stat-time`       | 当日の集中時間               |

### 初期化フロー (`init()`)

1. DOM 要素の参照を取得
2. ボタンのイベントリスナーを登録
3. ブラウザ通知の許可をリクエスト
4. `Persistence` から前回の状態を復元
5. `ApiClient` から今日の統計を取得
6. 初回描画を実行

### セッション完了時の処理 (`onPhaseComplete`)

1. タイマーを停止
2. `TimerCore.advancePhase()` で次フェーズへ遷移
3. ブラウザ通知を送信
4. `ApiClient.postSession()` でセッションをサーバーに記録
5. `refreshStats()` で統計表示を更新

### 状態復元のルール

- `savedAt` の日付が当日と異なる場合は復元せずクリア
- `running` 状態で復元する際は、経過時間を差し引いて残り秒数を補正
- 補正後に残り秒数が 0 以下になった場合は復元せずクリア

### プログレスリング

```
stroke-dashoffset = 円周 × (1 - progress)
円周 = 2π × r = 2π × 85 ≈ 534.07
```

---

## HTML テンプレート (`templates/index.html`)

Tailwind CSS（CDN 版）を使用したシングルページ構成です。

### カラートークン

| トークン         | 値          | 用途                         |
|------------------|-------------|------------------------------|
| `brand`          | `#6C63FF`   | リング・主要ボタン           |
| `brand-light`    | `#9B94FF`   | ホバー                       |
| `brand-dark`     | `#4B44CC`   | ボタンホバー                 |
| `bg`             | `#7B6FD1`   | 画面背景                     |
| `surface`        | `#FFFFFF`   | カード背景                   |
| `surface-muted`  | `#F3F2FF`   | ボタン背景（セカンダリ）     |
| `text`           | `#1A1A2E`   | 主要テキスト                 |
| `text-muted`     | `#7B7B9E`   | 補助テキスト                 |
| `state-success`  | `#4CAF50`   | 成功状態                     |
| `state-warning`  | `#FF9800`   | 警告状態                     |

### フェーズラベル

| フェーズ      | 表示テキスト   |
|---------------|----------------|
| `work`        | 作業中         |
| `break`       | 休憩中         |
| `long_break`  | 長い休憩中     |
