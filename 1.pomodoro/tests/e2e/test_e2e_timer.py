"""E2E テスト: ポモドーロタイマーのハッピーパス"""
import re


class TestPageLoad:
    """ページが正しく表示されること"""

    def test_title(self, app_page):
        assert "ポモドーロタイマー" in app_page.title()

    def test_initial_timer_display(self, app_page):
        text = app_page.locator("#timer-display").inner_text()
        assert text == "25:00"

    def test_initial_phase_label(self, app_page):
        text = app_page.locator("#phase-label").inner_text()
        assert text == "作業中"

    def test_start_button_visible(self, app_page):
        btn = app_page.locator("#btn-start")
        assert btn.is_visible()
        assert btn.inner_text() == "開始"

    def test_reset_button_visible(self, app_page):
        btn = app_page.locator("#btn-reset")
        assert btn.is_visible()
        assert btn.inner_text() == "リセット"

    def test_stats_initial(self, app_page):
        assert app_page.locator("#stat-count").inner_text() == "0"
        assert app_page.locator("#stat-time").inner_text() == "0分"


class TestTimerInteraction:
    """タイマー操作のテスト"""

    def test_start_changes_button_to_pause(self, app_page):
        app_page.locator("#btn-start").click()
        text = app_page.locator("#btn-start").inner_text()
        assert text == "一時停止"

    def test_timer_counts_down(self, app_page):
        app_page.locator("#btn-start").click()
        # 2秒待って、タイマーが25:00から減っていることを確認
        app_page.wait_for_timeout(2000)
        text = app_page.locator("#timer-display").inner_text()
        assert text != "25:00"
        # MM:SS 形式であること
        assert re.match(r"\d{2}:\d{2}", text)

    def test_pause_and_resume(self, app_page):
        # 開始
        app_page.locator("#btn-start").click()
        app_page.wait_for_timeout(1000)

        # 一時停止
        app_page.locator("#btn-start").click()
        assert app_page.locator("#btn-start").inner_text() == "再開"
        paused_time = app_page.locator("#timer-display").inner_text()

        # 1秒待っても時間は変わらない
        app_page.wait_for_timeout(1000)
        assert app_page.locator("#timer-display").inner_text() == paused_time

        # 再開
        app_page.locator("#btn-start").click()
        assert app_page.locator("#btn-start").inner_text() == "一時停止"

    def test_reset(self, app_page):
        # 開始してからリセット
        app_page.locator("#btn-start").click()
        app_page.wait_for_timeout(1000)
        app_page.locator("#btn-reset").click()

        assert app_page.locator("#timer-display").inner_text() == "25:00"
        assert app_page.locator("#btn-start").inner_text() == "開始"
        assert app_page.locator("#phase-label").inner_text() == "作業中"

    def test_progress_ring_moves(self, app_page):
        # 開始前のリング offset を取得
        ring = app_page.locator("#progress-ring")
        initial_offset = ring.evaluate("el => el.style.strokeDashoffset")

        # 開始して少し待つ
        app_page.locator("#btn-start").click()
        app_page.wait_for_timeout(1500)

        new_offset = ring.evaluate("el => el.style.strokeDashoffset")
        # リングが動いている（offset が変わっている）
        assert new_offset != initial_offset
