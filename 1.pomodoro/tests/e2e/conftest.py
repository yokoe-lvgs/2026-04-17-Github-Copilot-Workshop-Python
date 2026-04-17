"""Playwright E2E テスト用フィクスチャ"""
import pytest
import threading
import time
import os
import backend.models.database as db_mod


@pytest.fixture(scope="session")
def _e2e_db(tmp_path_factory):
    """E2E テスト用の一時 DB を作成"""
    db_file = str(tmp_path_factory.mktemp("e2e") / "e2e_pomodoro.db")
    db_mod.DB_PATH = db_file
    db_mod.init_db()
    return db_file


@pytest.fixture(scope="session")
def live_server(_e2e_db):
    """Flask を別スレッドで起動し、テスト終了時に停止"""
    from app import app
    app.config["TESTING"] = True

    server = threading.Thread(
        target=lambda: app.run(port=5555, use_reloader=False),
        daemon=True,
    )
    server.start()
    # サーバーが起動するまで少し待つ
    time.sleep(1)
    yield "http://127.0.0.1:5555"


@pytest.fixture
def app_page(page, live_server):
    """ブラウザでアプリページを開いた状態を返す"""
    page.goto(live_server)
    page.wait_for_selector("#timer-display")
    return page
