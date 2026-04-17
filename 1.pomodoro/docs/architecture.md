# アーキテクチャ概要

ポモドーロタイマーアプリの現在の実装アーキテクチャを説明します。

---

## 全体構成

Flask（バックエンド）と純粋な JavaScript（フロントエンド）で構成された Web アプリです。永続化には SQLite を使用します。

```
ブラウザ
  └── HTML (templates/index.html)
        ├── TimerCore    (timer-core.js)   — タイマー状態管理
        ├── Persistence  (persistence.js)  — localStorage 保存/復元
        ├── ApiClient    (api-client.js)   — Flask API 通信
        └── UIBinder     (ui-binder.js)    — DOM 描画・イベント処理

Flask (app.py)
  └── Routes
        ├── SessionService   (backend/services/session_service.py)
        │     └── SessionRepository  (backend/repositories/session_repository.py)
        │           └── SQLite DB (pomodoro.db)
        └── Static / Template 配信
```

---

## レイヤー構成

### 1. フロントエンド（Presentation）

ブラウザ上で動作する JavaScript モジュール群が、タイマーの状態管理と UI 描画を担います。

- タイマーのカウントダウンはブラウザ側で実行（`setInterval` + `endTimestamp` 方式）
- セッション完了時のみ Flask API を呼び出す（都度送信なし）

### 2. バックエンド API（Application/API）

Flask アプリ（`app.py`）がルートを定義します。各ルートは薄く保ち、ビジネスロジックは `SessionService` へ委譲します。

### 3. サービス層（Service）

`backend/services/session_service.py` がビジネスロジックを担います。

- 入力バリデーション（`kind` の値チェック、`duration_sec` の非負検証）
- `today_stats()` での分換算処理

### 4. リポジトリ層（Repository）

`backend/repositories/session_repository.py` が SQLite へのアクセスを担います。

- セッションの保存（`save_session`）
- 当日統計の集計クエリ（`get_today_stats`）

### 5. データ層（Data）

`backend/models/database.py` が SQLite の初期化（テーブル DDL の実行）を管理します。DB ファイルは `pomodoro.db` として `1.pomodoro/` 直下に生成されます。

---

## ディレクトリ構成

```
1.pomodoro/
├── app.py                          # Flask アプリ本体・ルート定義
├── requirements.txt
├── pomodoro.db                     # SQLite データベース（実行時に生成）
├── backend/
│   ├── models/
│   │   └── database.py             # DB 初期化・DDL
│   ├── repositories/
│   │   └── session_repository.py   # DB アクセス層
│   └── services/
│       └── session_service.py      # ビジネスロジック層
├── static/
│   └── js/
│       ├── timer-core.js           # タイマー状態管理（純粋ロジック）
│       ├── persistence.js          # localStorage 保存/復元
│       ├── api-client.js           # Flask API クライアント
│       └── ui-binder.js            # DOM 描画・イベントバインド
├── templates/
│   └── index.html                  # メイン HTML（Tailwind CSS 使用）
├── tests/
│   ├── conftest.py
│   ├── test_api.py                 # API 統合テスト
│   ├── test_session_service.py     # サービス層ユニットテスト
│   └── e2e/                        # E2E テスト（Playwright）
└── docs/                           # ドキュメント
```

---

## 設計上の要点

| 関心事               | 担当                      |
|----------------------|---------------------------|
| タイマーカウントダウン | フロントエンド（TimerCore） |
| セッション記録        | Flask API + SessionService |
| DB アクセス           | SessionRepository          |
| 状態の永続化          | Persistence (localStorage) |
| API 通信障害対応      | ApiClient（失敗キュー）    |
| ブラウザ再読込対応    | Persistence + UIBinder     |

---

## 起動方法

```bash
cd 1.pomodoro
pip install -r requirements.txt
python app.py
```

デバッグモードを有効にするには `FLASK_DEBUG=1` を設定します。
