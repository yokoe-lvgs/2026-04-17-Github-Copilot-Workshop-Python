/**
 * TimerCore — 純粋な状態遷移と時間計算ロジック
 *
 * 外部依存なし。テスト時は clock を差し替え可能。
 */
const TimerCore = (() => {
  // --- 定数 ---
  const PHASES = { WORK: "work", BREAK: "break", LONG_BREAK: "long_break" };
  const STATES = { IDLE: "idle", RUNNING: "running", PAUSED: "paused", COMPLETED: "completed" };

  const DEFAULT_CONFIG = {
    workSec: 25 * 60,
    breakSec: 5 * 60,
    longBreakSec: 15 * 60,
    longBreakInterval: 4,
  };

  // --- 状態 ---
  let config = { ...DEFAULT_CONFIG };
  let state = STATES.IDLE;
  let phase = PHASES.WORK;
  let remainingSec = config.workSec;
  let endTimestamp = null;      // running 中のみ有効
  let pausedRemaining = null;   // paused 中のみ有効
  let completedCount = 0;       // 連続 work 完了数
  let clock = () => Date.now(); // 注入可能

  // --- ヘルパー ---
  function durationForPhase(p) {
    if (p === PHASES.WORK) return config.workSec;
    if (p === PHASES.LONG_BREAK) return config.longBreakSec;
    return config.breakSec;
  }

  function nextPhase() {
    if (phase !== PHASES.WORK) return PHASES.WORK;
    completedCount++;
    if (completedCount % config.longBreakInterval === 0) return PHASES.LONG_BREAK;
    return PHASES.BREAK;
  }

  // --- 操作 ---
  function start() {
    if (state === STATES.RUNNING) return;
    if (state === STATES.PAUSED) {
      endTimestamp = clock() + pausedRemaining * 1000;
      pausedRemaining = null;
    } else {
      remainingSec = durationForPhase(phase);
      endTimestamp = clock() + remainingSec * 1000;
    }
    state = STATES.RUNNING;
  }

  function pause() {
    if (state !== STATES.RUNNING) return;
    pausedRemaining = Math.max(0, Math.ceil((endTimestamp - clock()) / 1000));
    endTimestamp = null;
    state = STATES.PAUSED;
  }

  function reset() {
    state = STATES.IDLE;
    phase = PHASES.WORK;
    remainingSec = config.workSec;
    endTimestamp = null;
    pausedRemaining = null;
  }

  function tick() {
    if (state !== STATES.RUNNING) return;
    const now = clock();
    const diff = Math.ceil((endTimestamp - now) / 1000);
    if (diff <= 0) {
      remainingSec = 0;
      state = STATES.COMPLETED;
      return;
    }
    remainingSec = diff;
  }

  function advancePhase() {
    phase = nextPhase();
    remainingSec = durationForPhase(phase);
    state = STATES.IDLE;
    endTimestamp = null;
    pausedRemaining = null;
  }

  // --- アクセサ ---
  function getState()      { return state; }
  function getPhase()      { return phase; }
  function getRemaining()  { return state === STATES.PAUSED ? pausedRemaining : remainingSec; }
  function getTotalSec()   { return durationForPhase(phase); }
  function getProgress()   { return 1 - getRemaining() / getTotalSec(); }
  function getCompletedCount() { return completedCount; }

  function setClock(fn) { clock = fn; }
  function setConfig(c) {
    config = { ...DEFAULT_CONFIG, ...c };
    if (state === STATES.IDLE) remainingSec = durationForPhase(phase);
  }
  function resetStats() { completedCount = 0; }

  /**
   * 外部から内部状態を復元する（ブラウザ再読込時に使用）
   * @param {object} snapshot - { state, phase, remaining, completedCount }
   */
  function restore(snapshot) {
    if (snapshot.phase) phase = snapshot.phase;
    if (typeof snapshot.completedCount === "number") completedCount = snapshot.completedCount;
    if (typeof snapshot.remaining === "number") remainingSec = snapshot.remaining;

    // 状態に応じて内部変数を整合させる
    if (snapshot.state === STATES.PAUSED) {
      state = STATES.PAUSED;
      pausedRemaining = snapshot.remaining;
      endTimestamp = null;
    } else if (snapshot.state === STATES.RUNNING) {
      state = STATES.RUNNING;
      endTimestamp = clock() + snapshot.remaining * 1000;
      pausedRemaining = null;
    } else {
      state = STATES.IDLE;
      endTimestamp = null;
      pausedRemaining = null;
    }
  }

  return {
    PHASES, STATES,
    start, pause, reset, tick, advancePhase,
    getState, getPhase, getRemaining, getTotalSec, getProgress, getCompletedCount,
    setClock, setConfig, resetStats, restore,
  };
})();
