"""API エンドポイントの統合テスト"""
from datetime import datetime


class TestGetIndex:
    def test_returns_html(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert b"<!DOCTYPE html>" in resp.data


class TestGetConfig:
    def test_returns_config(self, client):
        resp = client.get("/api/config")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["workSec"] == 1500
        assert data["breakSec"] == 300
        assert data["longBreakSec"] == 900
        assert data["longBreakInterval"] == 4


class TestPostSession:
    def _post(self, client, **overrides):
        payload = {
            "kind": "work",
            "started_at": "2026-04-17T10:00:00",
            "ended_at": "2026-04-17T10:25:00",
            "duration_sec": 1500,
            **overrides,
        }
        return client.post("/api/sessions", json=payload)

    def test_success(self, client):
        resp = self._post(client)
        assert resp.status_code == 201
        assert resp.get_json()["status"] == "ok"

    def test_missing_fields(self, client):
        resp = client.post("/api/sessions", json={"kind": "work"})
        assert resp.status_code == 400
        assert "Missing" in resp.get_json()["error"]

    def test_invalid_json(self, client):
        resp = client.post(
            "/api/sessions",
            data="not json",
            content_type="application/json",
        )
        assert resp.status_code == 400

    def test_invalid_kind(self, client):
        resp = self._post(client, kind="invalid")
        assert resp.status_code == 400
        assert "Invalid input" in resp.get_json()["error"]

    def test_negative_duration(self, client):
        resp = self._post(client, duration_sec=-1)
        assert resp.status_code == 400
        assert "Invalid input" in resp.get_json()["error"]


class TestGetTodayStats:
    def test_empty(self, client):
        resp = client.get("/api/stats/today")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] == 0
        assert data["total_sec"] == 0

    def test_after_recording(self, client):
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        client.post("/api/sessions", json={
            "kind": "work",
            "started_at": now,
            "ended_at": now,
            "duration_sec": 1500,
        })
        client.post("/api/sessions", json={
            "kind": "work",
            "started_at": now,
            "ended_at": now,
            "duration_sec": 1500,
        })

        resp = client.get("/api/stats/today")
        data = resp.get_json()
        assert data["count"] == 2
        assert data["total_sec"] == 3000
        assert data["total_min"] == 50
