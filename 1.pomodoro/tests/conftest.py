import os
import tempfile
import pytest

# テスト用の一時 DB ファイルに差し替え
@pytest.fixture(autouse=True)
def _test_db(tmp_path, monkeypatch):
    db_file = str(tmp_path / "test_pomodoro.db")
    import backend.models.database as db_mod
    monkeypatch.setattr(db_mod, "DB_PATH", db_file)

    db_mod.init_db()
    yield


@pytest.fixture
def client():
    from app import app
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c
