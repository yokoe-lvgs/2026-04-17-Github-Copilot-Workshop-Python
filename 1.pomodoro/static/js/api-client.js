/**
 * ApiClient — Flask API との通信（失敗時リトライ付き）
 */
const ApiClient = (() => {
  const RETRY_KEY = "pomodoro_failed_sessions";
  const MAX_RETRIES = 3;

  // --- 失敗キュー管理 ---
  function loadFailedQueue() {
    try {
      return JSON.parse(localStorage.getItem(RETRY_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveFailedQueue(queue) {
    localStorage.setItem(RETRY_KEY, JSON.stringify(queue));
  }

  function enqueue(payload) {
    const queue = loadFailedQueue();
    queue.push({ ...payload, retries: 0 });
    saveFailedQueue(queue);
  }

  async function flushQueue() {
    const queue = loadFailedQueue();
    if (queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      const ok = await _doPost(item);
      if (!ok && item.retries < MAX_RETRIES) {
        remaining.push({ ...item, retries: item.retries + 1 });
      }
      // MAX_RETRIES 超過は破棄
    }
    saveFailedQueue(remaining);
  }

  // --- 実送信 ---
  async function _doPost(payload) {
    try {
      const resp = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: payload.kind,
          started_at: payload.started_at,
          ended_at: payload.ended_at,
          duration_sec: payload.duration_sec,
        }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  // --- 公開 API ---
  async function postSession(kind, startedAt, endedAt, durationSec) {
    // まず失敗キューを先にフラッシュ
    await flushQueue();

    const payload = {
      kind,
      started_at: startedAt,
      ended_at: endedAt,
      duration_sec: durationSec,
    };
    const ok = await _doPost(payload);
    if (!ok) {
      enqueue(payload);
    }
    return ok;
  }

  async function getTodayStats() {
    try {
      const resp = await fetch("/api/stats/today");
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  async function getConfig() {
    try {
      const resp = await fetch("/api/config");
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  return { postSession, getTodayStats, getConfig, flushQueue };
})();
