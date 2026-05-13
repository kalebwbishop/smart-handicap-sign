"""Tests for inference endpoint security hardening.

Verifies:
- Threshold is server-side only (no user override)
- Debug graph is only generated when explicitly requested
- Device authentication is required for classify
- User authentication is required for history/graph endpoints
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.routes.inference import WAVE_THRESHOLD
from app.middleware.device_auth import AuthenticatedDevice, get_authenticated_device


# ── device auth helpers ──────────────────────────────────────────────


FAKE_DEVICE = AuthenticatedDevice(
    id="device-001",
    serial_number="SHS-TEST-S01-AAA-00001-X",
    organization_id="org-456",
)


def _override_device_auth():
    """FastAPI dependency override that always resolves to a fake device."""
    async def _fake():
        return FAKE_DEVICE
    return _fake


@pytest.fixture()
def client_device(app):
    """Test client authenticated as a device."""
    app.dependency_overrides[get_authenticated_device] = _override_device_auth()
    from fastapi.testclient import TestClient
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── threshold is not user-controllable ───────────────────────────────


class TestThresholdHardening:
    def test_threshold_is_constant(self):
        """WAVE_THRESHOLD must be a fixed server-side value."""
        assert WAVE_THRESHOLD == 0.5

    @patch("app.routes.inference._get_classifier")
    def test_classify_uses_server_threshold(self, mock_clf, client_device):
        """The classifier must be called with the server WAVE_THRESHOLD, not a user value."""
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.3}
        mock_clf.return_value = fake_clf

        resp = client_device.post("/api/v1/inference/classify", json={
            "serial_number": FAKE_DEVICE.serial_number,
            "samples": [100] * 512,
        })
        assert resp.status_code == 200

        fake_clf.classify.assert_called_once()
        _, kwargs = fake_clf.classify.call_args
        assert kwargs["threshold"] == WAVE_THRESHOLD

    @patch("app.routes.inference._get_classifier")
    def test_threshold_query_param_not_accepted(self, mock_clf, client_device):
        """Passing ?threshold=... as a query param must have no effect."""
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.1}
        mock_clf.return_value = fake_clf

        resp = client_device.post(
            "/api/v1/inference/classify?threshold=0.01",
            json={"serial_number": FAKE_DEVICE.serial_number, "samples": [100] * 512},
        )
        assert resp.status_code == 200

        _, kwargs = fake_clf.classify.call_args
        assert kwargs["threshold"] == WAVE_THRESHOLD  # still 0.5, not 0.01

    def test_classify_rejects_unauthenticated(self, client_anon):
        """Classify endpoint rejects requests without device auth."""
        resp = client_anon.post("/api/v1/inference/classify", json={
            "serial_number": "SHS-TEST",
            "samples": [100] * 512,
        })
        assert resp.status_code == 401

    @patch("app.routes.inference._get_classifier")
    def test_classify_rejects_wrong_serial(self, mock_clf, client_device):
        """Device cannot submit telemetry for a different serial number."""
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.3}
        mock_clf.return_value = fake_clf

        resp = client_device.post("/api/v1/inference/classify", json={
            "serial_number": "SHS-OTHER-SERIAL",
            "samples": [100] * 512,
        })
        assert resp.status_code == 403


# ── debug graph gating ──────────────────────────────────────────────


class TestDebugGraphGating:
    @patch("app.routes.inference._get_classifier")
    def test_no_debug_graph_by_default(self, mock_clf, client_device):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.2}
        mock_clf.return_value = fake_clf

        resp = client_device.post("/api/v1/inference/classify", json={
            "serial_number": FAKE_DEVICE.serial_number,
            "samples": [100] * 512,
        })
        assert resp.status_code == 200
        assert resp.json()["debug_graph"] is None

    @patch("app.routes.inference.plt")
    @patch("app.routes.inference._get_classifier")
    def test_debug_graph_returned_when_requested(self, mock_clf, mock_plt, client_device):
        fake_clf = MagicMock()
        fake_clf.classify.return_value = {"label": "non-wave", "confidence": 0.2}
        mock_clf.return_value = fake_clf

        import io
        fake_fig = MagicMock()
        fake_ax = MagicMock()
        mock_plt.subplots.return_value = (fake_fig, fake_ax)
        buf = io.BytesIO(b"fake-png-data")
        fake_fig.savefig = MagicMock(side_effect=lambda b, **kw: b.write(b"fake-png"))

        resp = client_device.post(
            "/api/v1/inference/classify?debug=true",
            json={"serial_number": FAKE_DEVICE.serial_number, "samples": [100] * 512},
        )
        assert resp.status_code == 200
        mock_plt.subplots.assert_called_once()


# ── history/graph auth gating ────────────────────────────────────────


class TestInferenceEndpointAuth:
    def test_history_rejects_unauthenticated(self, client_anon):
        """History endpoint requires user auth."""
        resp = client_anon.get("/api/v1/inference/history")
        assert resp.status_code in (401, 403)

    def test_latest_graph_rejects_unauthenticated(self, client_anon):
        """Latest graph endpoint requires user auth."""
        resp = client_anon.get("/api/v1/inference/latest-graph")
        assert resp.status_code in (401, 403)

    def test_history_accessible_to_authenticated_user(self, client_alice):
        """History endpoint works for authenticated users."""
        resp = client_alice.get("/api/v1/inference/history")
        assert resp.status_code == 200

    def test_latest_graph_accessible_to_authenticated_user(self, client_alice):
        """Latest graph endpoint works for authenticated users."""
        resp = client_alice.get("/api/v1/inference/latest-graph")
        # 200 if there's history, 204 if empty
        assert resp.status_code in (200, 204)
