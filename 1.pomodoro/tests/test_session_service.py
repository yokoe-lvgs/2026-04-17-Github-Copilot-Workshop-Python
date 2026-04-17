"""session_service のユニットテスト"""
import pytest
from backend.services import session_service


class TestRecordSession:
    """record_session のバリデーションテスト"""

    def test_valid_work_session(self):
        # 正常系: work セッション
        session_service.record_session(
            "work", "2026-04-17T10:00:00", "2026-04-17T10:25:00", 1500
        )

    def test_valid_break_session(self):
        # 正常系: break セッション
        session_service.record_session(
            "break", "2026-04-17T10:25:00", "2026-04-17T10:30:00", 300
        )

    def test_invalid_kind_raises(self):
        with pytest.raises(ValueError, match="Invalid kind"):
            session_service.record_session(
                "invalid", "2026-04-17T10:00:00", "2026-04-17T10:25:00", 1500
            )

    def test_negative_duration_raises(self):
        with pytest.raises(ValueError, match="non-negative"):
            session_service.record_session(
                "work", "2026-04-17T10:00:00", "2026-04-17T10:25:00", -1
            )

    def test_zero_duration_is_valid(self):
        session_service.record_session(
            "work", "2026-04-17T10:00:00", "2026-04-17T10:00:00", 0
        )


class TestTodayStats:
    """today_stats の集計テスト"""

    def test_empty_stats(self):
        stats = session_service.today_stats()
        assert stats["count"] == 0
        assert stats["total_sec"] == 0
        assert stats["total_min"] == 0

    def test_single_work_session(self):
        from datetime import datetime
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        session_service.record_session("work", now, now, 1500)

        stats = session_service.today_stats()
        assert stats["count"] == 1
        assert stats["total_sec"] == 1500
        assert stats["total_min"] == 25

    def test_break_not_counted(self):
        from datetime import datetime
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        session_service.record_session("break", now, now, 300)

        stats = session_service.today_stats()
        assert stats["count"] == 0
        assert stats["total_sec"] == 0

    def test_multiple_sessions(self):
        from datetime import datetime
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        session_service.record_session("work", now, now, 1500)
        session_service.record_session("work", now, now, 1500)
        session_service.record_session("break", now, now, 300)

        stats = session_service.today_stats()
        assert stats["count"] == 2
        assert stats["total_sec"] == 3000
        assert stats["total_min"] == 50
