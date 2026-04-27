"""Tests for inference endpoint security hardening.

Verifies:
- Threshold is server-side only (no user override)
- Debug graph is only generated when explicitly requested
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.routes.inference import WAVE_THRESHOLD


# ── threshold is not user-controllable ───────────────────────────────


class TestThresholdHardening:
    def test_threshold_is_constant(self):
        """WAVE_THRESHOLD must be a fixed server-side value."""
        assert WAVE_THRESHOLD == 0.5

    @patch("app.routes.inference.sign_service.update_sign", new_callable=AsyncMock)
    @patch("app.routes.inference.event_service.create_event", new_callable=AsyncMock)
    @patch("app.routes.inference._get_classifier")
    def test_classify_uses_server_threshold(self, mock_clf, mock_evt, mock_sign, client_anon):
        """The classifier must be called with the server WAVE_THRESHOLD, not a user value."""
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.3}
        mock_clf.return_value = fake_clf

        resp = client_anon.post("/api/v1/inference/classify", json={
            "sign_id": "s1",
            "samples": [100] * 512,
        })
        assert resp.status_code == 200

        fake_clf.classify.assert_called_once()
        _, kwargs = fake_clf.classify.call_args
        assert kwargs["threshold"] == WAVE_THRESHOLD

    @patch("app.routes.inference.sign_service.update_sign", new_callable=AsyncMock)
    @patch("app.routes.inference.event_service.create_event", new_callable=AsyncMock)
    @patch("app.routes.inference._get_classifier")
    def test_threshold_query_param_not_accepted(self, mock_clf, mock_evt, mock_sign, client_anon):
        """Passing ?threshold=... as a query param must have no effect."""
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.1}
        mock_clf.return_value = fake_clf

        # Even if an attacker sends threshold=0.01, the server should ignore it
        resp = client_anon.post(
            "/api/v1/inference/classify?threshold=0.01",
            json={"sign_id": "s1", "samples": [100] * 512},
        )
        assert resp.status_code == 200

        _, kwargs = fake_clf.classify.call_args
        assert kwargs["threshold"] == WAVE_THRESHOLD  # still 0.5, not 0.01


# ── debug graph gating ──────────────────────────────────────────────


class TestDebugGraphGating:
    @patch("app.routes.inference.sign_service.update_sign", new_callable=AsyncMock)
    @patch("app.routes.inference.event_service.create_event", new_callable=AsyncMock)
    @patch("app.routes.inference._get_classifier")
    def test_no_debug_graph_by_default(self, mock_clf, mock_evt, mock_sign, client_anon):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.2}
        mock_clf.return_value = fake_clf

        resp = client_anon.post("/api/v1/inference/classify", json={
            "sign_id": "s1",
            "samples": [100] * 512,
        })
        assert resp.status_code == 200
        assert resp.json()["debug_graph"] is None

    @patch("app.routes.inference.plt")
    @patch("app.routes.inference.sign_service.update_sign", new_callable=AsyncMock)
    @patch("app.routes.inference.event_service.create_event", new_callable=AsyncMock)
    @patch("app.routes.inference._get_classifier")
    def test_debug_graph_returned_when_requested(self, mock_clf, mock_evt, mock_sign, mock_plt, client_anon):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.2}
        mock_clf.return_value = fake_clf

        # Mock matplotlib to avoid actual rendering
        import io
        fake_fig = MagicMock()
        fake_ax = MagicMock()
        mock_plt.subplots.return_value = (fake_fig, fake_ax)
        buf = io.BytesIO(b"fake-png-data")
        fake_fig.savefig = MagicMock(side_effect=lambda b, **kw: b.write(b"fake-png"))

        resp = client_anon.post(
            "/api/v1/inference/classify?debug=true",
            json={"sign_id": "s1", "samples": [100] * 512},
        )
        assert resp.status_code == 200
        # When debug=true, the graph should be generated (subplots called)
        mock_plt.subplots.assert_called_once()
