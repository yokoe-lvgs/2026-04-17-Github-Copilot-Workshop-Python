/**
 * Persistence — localStorage を使った状態の保存・復元
 */
const Persistence = (() => {
  const KEY = "pomodoro_state";

  function save() {
    const data = {
      state: TimerCore.getState(),
      phase: TimerCore.getPhase(),
      remaining: TimerCore.getRemaining(),
      completedCount: TimerCore.getCompletedCount(),
      savedAt: Date.now(),
    };
    // running 中は endTimestamp から残りを逆算して保存
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  return { save, load, clear };
})();
