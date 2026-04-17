from backend.repositories import session_repository


def record_session(kind, started_at, ended_at, duration_sec):
    if kind not in ("work", "break"):
        raise ValueError(f"Invalid kind: {kind}")
    if duration_sec < 0:
        raise ValueError("duration_sec must be non-negative")
    session_repository.save_session(kind, started_at, ended_at, duration_sec)


def today_stats():
    stats = session_repository.get_today_stats()
    total_sec = stats["total_sec"]
    total_min = total_sec // 60
    return {
        "count": stats["count"],
        "total_sec": total_sec,
        "total_min": total_min,
    }
