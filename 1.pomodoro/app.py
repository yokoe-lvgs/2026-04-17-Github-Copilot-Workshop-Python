from flask import Flask, render_template, request, jsonify
import logging

from backend.models.database import init_db
from backend.services import session_service

app = Flask(__name__)
logger = logging.getLogger(__name__)

with app.app_context():
    init_db()

# --- タイマー設定 ---
TIMER_CONFIG = {
    "workSec": 25 * 60,
    "breakSec": 5 * 60,
    "longBreakSec": 15 * 60,
    "longBreakInterval": 4,
}


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/config")
def get_config():
    return jsonify(TIMER_CONFIG)


@app.post("/api/sessions")
def post_session():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    kind = data.get("kind")
    started_at = data.get("started_at")
    ended_at = data.get("ended_at")
    duration_sec = data.get("duration_sec")

    if not all([kind, started_at, ended_at, duration_sec is not None]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        session_service.record_session(kind, started_at, ended_at, int(duration_sec))
    except ValueError:
        return jsonify({"error": "Invalid input"}), 400
    except Exception:
        logger.exception("Failed to record session")
        return jsonify({"error": "An internal error has occurred"}), 500

    return jsonify({"status": "ok"}), 201


@app.get("/api/stats/today")
def get_today_stats():
    stats = session_service.today_stats()
    return jsonify(stats)


if __name__ == "__main__":
    import os
    app.run(debug=os.environ.get("FLASK_DEBUG", "0") == "1")
