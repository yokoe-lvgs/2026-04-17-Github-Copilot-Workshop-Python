import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "pomodoro.db")

DDL = """
CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kind         TEXT    NOT NULL CHECK (kind IN ('work', 'break')),
    started_at   TEXT    NOT NULL,
    ended_at     TEXT    NOT NULL,
    duration_sec INTEGER NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
"""


def init_db():
    db_path = os.path.normpath(DB_PATH)
    with sqlite3.connect(db_path) as conn:
        conn.execute(DDL)
        conn.commit()
