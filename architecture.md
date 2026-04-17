# Webアプリケーションアーキテクチャ案（Pomodoro Timer）

## 1. 目的と前提

本ドキュメントは、Flask + HTML/CSS/JavaScript（Tailwind CSS）で構築するポモドーロタイマーWebアプリの設計方針をまとめたものです。

- 対象UI: 添付モック（タイマー円環、開始/リセット、当日進捗カード）
- 実装方針: フロント主導のタイマー制御 + Flask API + SQLite
- 重点: 実装のしやすさ、拡張性、ユニットテスト容易性

---

## 2. 全体アーキテクチャ

### 2.1 レイヤー構成

1. Presentation（フロントエンド）
- HTML/Tailwind CSS/JavaScript
- 円形プログレス、残り時間表示、操作ボタン、進捗カードを描画

2. Application/API（バックエンド）
- Flask
- 設定値返却、セッション記録、当日統計返却

3. Data（永続化）
- SQLite（初期構成）
- セッション履歴の保存と集計

### 2.2 責務分離の要点

- タイマーの1秒更新はブラウザ側で実行（UXと応答性を優先）
- Flaskは「記録と集計」に集中
- DB書き込みは「セッション完了時」を基本とする

---

## 3. フロントエンド設計

### 3.1 状態機械（State Machine）

状態は以下の4つに統一します。

- `idle`
- `running`
- `paused`
- `completed`

基本遷移:

- 開始: `idle -> running`
- 一時停止: `running -> paused`
- 再開: `paused -> running`
- 完了: `running -> completed`
- リセット: `any -> idle`

### 3.2 時間計算

`setInterval` の単純減算ではなく、次の方式を採用します。

- 残り時間 = `endTimestamp - now`

これにより、タブ非アクティブ時や復帰時のズレを抑制します。

### 3.3 モジュール分割（推奨）

1. `TimerCore`
- 状態遷移と時間計算のみを扱う純粋ロジック

2. `TimerOrchestrator`
- Clock、Storage、ApiClientなど副作用を調停

3. `UIBinder`
- DOM描画（時間表示、リング、ボタン状態、進捗表示）

4. `ApiClient`
- Flask API通信

5. `Persistence`
- `localStorage` への保存/復元

---

## 4. Flask API設計

### 4.1 エンドポイント（最小構成）

1. `GET /`
- 画面返却

2. `GET /api/config`
- タイマー設定値を返却
- 例: 作業25分、休憩5分、長休憩15分、長休憩周期4

3. `POST /api/sessions`
- 完了セッションを記録
- 例: `kind`, `started_at`, `ended_at`, `duration_sec`

4. `GET /api/stats/today`
- 当日の完了回数と集中時間を返却

### 4.2 実装責務

- Flaskルートは薄く保つ（入力検証 + サービス呼び出し + 返却）
- ビジネスロジックは `SessionService` へ集約
- DBアクセスは `SessionRepository` へ隔離

---

## 5. データモデル

### 5.1 `sessions` テーブル

- `id` (PK)
- `kind` (`work` / `break`)
- `started_at` (datetime)
- `ended_at` (datetime)
- `duration_sec` (int)
- `created_at` (datetime)

### 5.2 集計指標

- 当日完了回数: `kind='work'` の件数
- 当日集中時間: `kind='work'` の `duration_sec` 合計

---

## 6. Tailwind CSS設計方針

### 6.1 カラーは役割ベースで絞る

使用色は役割単位で限定し、全体でおおむね10色前後を上限とします。

- `brand`（リング、主要ボタン）
- `bg`（画面背景）
- `surface`（カード背景）
- `text`（主要/補助文字）
- `state`（success, warning）

### 6.2 設定ファイル方針

- `tailwind.config.js` の `theme.extend.colors` にプロジェクト専用トークンを定義
- 既定パレットの色名直指定（例: `blue-500`）は原則禁止
- クラス利用は役割トークン経由に統一

### 6.3 運用ルール

- 色だけでなく角丸・余白・影もトークン化
- コンポーネント間で見た目の一貫性を維持
- 画面サイズ差分（PC/モバイル）を初期から考慮

---

## 7. テスト容易性を高める改善点

### 7.1 設計上の改善

1. タイマーコアを純粋関数化
- 副作用を持たないため境界値テストが容易

2. 副作用をポート化
- API保存、localStorage、通知を抽象化し、モック差し替え可能

3. Clock注入
- `Date.now()` 直呼びを避け、テスト時刻を固定可能にする

4. 状態遷移テーブル化
- 不正遷移の網羅テストがしやすい

5. サービス層/リポジトリ層の導入
- ルート、業務ロジック、DBアクセスを分離しテスト対象を明確化

6. API契約（DTO）明確化
- 入出力スキーマを固定し、契約破壊を早期検知

### 7.2 テスト戦略

- ユニットテスト（主軸）
  - 状態遷移、時間計算、サービス集計、DTO検証
  - フレームワーク: `pytest`（実装フェーズで詳細を決定）
- 統合テスト
  - APIとDBの接続フロー
  - フレームワーク: `pytest`（実装フェーズで詳細を決定）
- E2E（最小）
  - 開始 -> 完了 -> 統計反映のハッピーパス中心
  - フレームワーク: **Playwright**（決定済み）

> **注意**: テストケースの詳細設計（対象範囲、命名規則、カバレッジ方針など）は、  
> 各実装フェーズ開始時に確認しながら進める。

---

## 8. 推奨ディレクトリ構成（案）

```text
1.pomodoro/
  app.py
  templates/
    index.html
  static/
    css/
      input.css
      output.css
    js/
      timer-core.js
      timer-orchestrator.js
      ui-binder.js
      api-client.js
      persistence.js
  backend/
    services/
      session_service.py
    repositories/
      session_repository.py
    models/
      dto.py
  tailwind.config.js
  postcss.config.js
```

※ 実際の命名は実装フェーズで最終決定。

---

## 9. 実装フェーズの進め方（推奨）

1. Flaskで `GET /` と静的配信を準備
2. Tailwind設定（色トークン制限）を先に確定
3. TimerCore + UIBinderで単体動作を完成
4. localStorage復元を追加
5. セッション保存APIと当日統計APIを実装
6. 進捗カードをAPI連携
7. ユニット/統合テストを整備

---

## 10. 意思決定まとめ

- タイマー制御はフロント主導
- Flaskは記録/集計APIに集中
- Tailwindは役割トークン中心で色数を制限
- テスト容易性のため、純粋ロジックと副作用層を明確分離
