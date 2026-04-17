/**
 * UIBinder — DOM への描画とイベントバインド
 */
const UIBinder = (() => {
  // --- DOM refs ---
  const els = {};

  const PHASE_LABELS = {
    [TimerCore.PHASES.WORK]: "作業中",
    [TimerCore.PHASES.BREAK]: "休憩中",
    [TimerCore.PHASES.LONG_BREAK]: "長い休憩中",
  };

  const RING_CIRCUMFERENCE = 2 * Math.PI * 85; // r=85 の円周

  let intervalId = null;

  // --- 初期化 ---
  function init() {
    els.phaseLabel   = document.getElementById("phase-label");
    els.timerDisplay = document.getElementById("timer-display");
    els.ring         = document.getElementById("progress-ring");
    els.btnStart     = document.getElementById("btn-start");
    els.btnReset     = document.getElementById("btn-reset");
    els.statCount    = document.getElementById("stat-count");
    els.statTime     = document.getElementById("stat-time");

    els.btnStart.addEventListener("click", onStartPause);
    els.btnReset.addEventListener("click", onReset);

    // ブラウザ通知の許可をリクエスト
    requestNotificationPermission();

    // 前回の状態を復元
    restoreState();

    // API から今日の統計を取得
    refreshStats();

    render();
  }

  // --- 通知 ---
  function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  function showNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }

  // --- 状態の保存・復元 ---
  function saveState() {
    if (typeof Persistence !== "undefined") {
      Persistence.save();
    }
  }

  function restoreState() {
    if (typeof Persistence === "undefined") return;
    const data = Persistence.load();
    if (!data) return;

    // 同じ日のデータのみ復元
    const savedDate = new Date(data.savedAt).toDateString();
    const today = new Date().toDateString();
    if (savedDate !== today) {
      Persistence.clear();
      return;
    }

    // running だった場合は経過分を差し引く
    let remaining = data.remaining;
    let restoredState = data.state;
    if (data.state === TimerCore.STATES.RUNNING) {
      const elapsed = Math.floor((Date.now() - data.savedAt) / 1000);
      remaining = Math.max(0, data.remaining - elapsed);
      if (remaining <= 0) {
        // すでに完了していた場合は idle に戻す
        restoredState = TimerCore.STATES.IDLE;
        remaining = data.remaining; // 元の時間でリセット扱い
        Persistence.clear();
        return;
      }
    }

    // TimerCore の内部状態を完全復元
    TimerCore.restore({
      state: restoredState,
      phase: data.phase,
      remaining: remaining,
      completedCount: data.completedCount,
    });

    // running 状態の場合はティックを再開
    if (restoredState === TimerCore.STATES.RUNNING) {
      startTicking();
    }
  }

  // --- イベントハンドラ ---
  function onStartPause() {
    const s = TimerCore.getState();
    if (s === TimerCore.STATES.IDLE || s === TimerCore.STATES.PAUSED) {
      TimerCore.start();
      startTicking();
    } else if (s === TimerCore.STATES.RUNNING) {
      TimerCore.pause();
      stopTicking();
    }
    saveState();
    render();
  }

  function onReset() {
    TimerCore.reset();
    stopTicking();
    saveState();
    render();
  }

  // --- ティック制御 ---
  function startTicking() {
    stopTicking();
    intervalId = setInterval(() => {
      TimerCore.tick();
      if (TimerCore.getState() === TimerCore.STATES.COMPLETED) {
        onPhaseComplete();
      }
      render();
      // 5秒ごとに状態を保存（パフォーマンスのため毎ティックではない）
      saveState();
    }, 250);
  }

  function stopTicking() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function onPhaseComplete() {
    stopTicking();

    const completedPhase = TimerCore.getPhase();
    const durationSec = TimerCore.getTotalSec();
    const now = new Date().toISOString();
    const startedAt = new Date(Date.now() - durationSec * 1000).toISOString();

    TimerCore.advancePhase();

    // 通知
    if (completedPhase === TimerCore.PHASES.WORK) {
      showNotification("ポモドーロ完了", "お疲れさまでした！休憩しましょう。");
    } else {
      showNotification("休憩終了", "次の作業を始めましょう！");
    }

    // API にセッションを保存
    if (typeof ApiClient !== "undefined") {
      const kind = completedPhase === TimerCore.PHASES.WORK ? "work" : "break";
      ApiClient.postSession(kind, startedAt, now, durationSec).then(() => {
        refreshStats();
      });
    }

    saveState();
    render();
  }

  // --- 描画 ---
  function render() {
    const state     = TimerCore.getState();
    const phase     = TimerCore.getPhase();
    const remaining = TimerCore.getRemaining();
    const progress  = TimerCore.getProgress();

    // フェーズラベル
    els.phaseLabel.textContent = PHASE_LABELS[phase] || "作業中";

    // タイマー表示
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    els.timerDisplay.textContent =
      String(min).padStart(2, "0") + ":" + String(sec).padStart(2, "0");

    // リング
    const offset = RING_CIRCUMFERENCE * (1 - progress);
    els.ring.style.strokeDashoffset = offset;

    // ボタンラベル
    if (state === TimerCore.STATES.RUNNING) {
      els.btnStart.textContent = "一時停止";
    } else if (state === TimerCore.STATES.PAUSED) {
      els.btnStart.textContent = "再開";
    } else {
      els.btnStart.textContent = "開始";
    }

    // 統計は refreshStats() で更新。render 内では触らない
  }

  // 統計を API から取得して表示
  async function refreshStats() {
    if (typeof ApiClient === "undefined") return;
    const stats = await ApiClient.getTodayStats();
    if (!stats) return;
    els.statCount.textContent = stats.count;
    const totalMin = stats.total_min;
    if (totalMin >= 60) {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      els.statTime.textContent = m > 0 ? `${h}時間${m}分` : `${h}時間`;
    } else {
      els.statTime.textContent = `${totalMin}分`;
    }
  }

  // ページ離脱時に状態を保存
  window.addEventListener("beforeunload", saveState);

  return { init };
})();

// --- ページ読み込み時に開始 ---
document.addEventListener("DOMContentLoaded", () => {
  UIBinder.init();
});
