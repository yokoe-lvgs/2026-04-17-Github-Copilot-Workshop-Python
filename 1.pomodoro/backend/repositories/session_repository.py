import sqlite3
import backend.models.database as _db
import os


def _connect():
    db_path = os.path.normpath(_db.DB_PATH)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def save_session(kind, started_at, ended_at, duration_sec):
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO sessions (kind, started_at, ended_at, duration_sec)
            VALUES (?, ?, ?, ?)
            """,
            (kind, started_at, ended_at, duration_sec),
        )
        conn.commit()


def get_today_stats():
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS count,
                COALESCE(SUM(duration_sec), 0) AS total_sec
            FROM sessions
            WHERE kind = 'work'
              AND date(started_at) = date('now', 'localtime')
            """
        ).fetchone()
        return {"count": row["count"], "total_sec": row["total_sec"]}
