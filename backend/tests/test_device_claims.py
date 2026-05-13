"""Integration tests for device claim validation and execution.

All database access is mocked — no real asyncpg connection required.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.utils.claim import generate_claim_id, generate_salt, hash_claim_id


# ── helpers ──────────────────────────────────────────────────────────


class FakeRecord(dict):
    """A plain dict subclass that behaves like an asyncpg Record.

    Supports ``record["key"]``, ``record.get("key")``, ``dict(record)``,
    and iteration over keys — everything the device_service uses.
    """


def _valid_serial() -> str:
    """Return a valid serial (with correct check char) for tests."""
    from app.utils.serial import generate_serial_number
    return generate_serial_number(26, 5, "S01", "A7K", 482)


def _make_device_row(
    *,
    lifecycle_status: str = "manufactured",
    claim_status: str = "unused",
    claim_id: str | None = None,
    salt: str | None = None,
    claim_expires_at: datetime | None = None,
):
    """Build a FakeRecord that mimics an asyncpg Record for the devices table."""
    if claim_id is None:
        claim_id = generate_claim_id()
    if salt is None:
        salt = generate_salt()
    claim_hash = hash_claim_id(claim_id, salt)

    device_id = uuid.uuid4()
    row = FakeRecord(
        id=device_id,
        serial_number=_valid_serial(),
        model_code="S01",
        lifecycle_status=lifecycle_status,
        claim_status=claim_status,
        claim_id_hash=claim_hash,
        claim_id_salt=salt,
        claim_expires_at=claim_expires_at,
        name="Test Device",
        hardware_revision="1.0",
        firmware_version="2.0.0",
        manufacture_batch="A7K",
        claimed_by_user_id=None,
        claimed_at=None,
        organization_id=None,
        current_site_id=None,
        current_parking_space_id=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    return claim_id, salt, row


# ── fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def mock_pool():
    """Create a mock asyncpg pool + connection with async context managers.

    ``pool.acquire()`` returns a sync object whose ``__aenter__`` yields *conn*.
    ``conn.transaction()`` returns a sync object whose ``__aenter__`` yields None.
    ``pool.fetchrow`` / ``conn.fetchrow`` etc. are AsyncMocks.
    """
    pool = AsyncMock()
    conn = AsyncMock()

    # pool.acquire() must be a SYNC call returning an async context manager
    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=acquire_cm)

    # conn.transaction() must be a SYNC call returning an async context manager
    tx_cm = MagicMock()
    tx_cm.__aenter__ = AsyncMock(return_value=None)
    tx_cm.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=tx_cm)

    return pool, conn


# ── validate_claim ───────────────────────────────────────────────────


class TestValidateClaim:
    """Tests for validate_claim()."""

    @pytest.mark.asyncio
    async def test_validate_claim_success(self, mock_pool):
        """Happy path: device exists, unclaimed, claim ID matches."""
        pool, _ = mock_pool
        claim_id, salt, device = _make_device_row()
        pool.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import validate_claim
            result = await validate_claim(_valid_serial(), claim_id)

        assert result.valid is True
        assert result.device is not None
        assert result.error is None
        # Verify all fields required by the route's DeviceSummary are present
        assert "lifecycle_status" in result.device
        assert "hardware_revision" in result.device
        assert "serial_number" in result.device
        assert "model_code" in result.device

    @pytest.mark.asyncio
    async def test_validate_claim_device_not_found(self, mock_pool):
        """Device not in the database returns DEVICE_NOT_FOUND."""
        pool, _ = mock_pool
        pool.fetchrow = AsyncMock(return_value=None)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import validate_claim
            result = await validate_claim(_valid_serial(), "AAAA-BBBB")

        assert result.valid is False
        assert result.error_code == "device_not_found"

    @pytest.mark.asyncio
    async def test_validate_claim_invalid_serial_format(self):
        """A malformed serial fails before any DB lookup."""
        mock_gp = AsyncMock()
        with patch("app.services.device_service.get_pool", mock_gp):
            from app.services.device_service import validate_claim
            result = await validate_claim("BAD-SERIAL", "AAAA-BBBB")

        assert result.valid is False
        assert result.error_code == "invalid_serial"
        mock_gp.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_validate_claim_wrong_claim_id(self, mock_pool):
        """A valid device with a mismatched claim ID returns CLAIM_MISMATCH."""
        pool, _ = mock_pool
        claim_id, salt, device = _make_device_row()
        pool.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import validate_claim
            result = await validate_claim(_valid_serial(), "ZZZZ-ZZZZ")

        assert result.valid is False
        assert result.error_code == "invalid_claim_id"

    @pytest.mark.asyncio
    async def test_validate_claim_already_used(self, mock_pool):
        """A device whose claim_status is 'used' returns CLAIM_NOT_UNUSED."""
        pool, _ = mock_pool
        claim_id, salt, device = _make_device_row(claim_status="used")
        pool.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import validate_claim
            result = await validate_claim(_valid_serial(), claim_id)

        assert result.valid is False
        assert result.error_code == "claim_already_used"

    @pytest.mark.asyncio
    async def test_validate_claim_expired(self, mock_pool):
        """An expired claim returns CLAIM_EXPIRED."""
        pool, _ = mock_pool
        expired = datetime.now(timezone.utc) - timedelta(days=1)
        claim_id, salt, device = _make_device_row(claim_expires_at=expired)
        pool.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import validate_claim
            result = await validate_claim(_valid_serial(), claim_id)

        assert result.valid is False
        assert result.error_code == "claim_expired"

    @pytest.mark.asyncio
    async def test_validate_claim_device_already_active(self, mock_pool):
        """An active device is not claimable — returns device_already_active."""
        pool, _ = mock_pool
        claim_id, salt, device = _make_device_row(lifecycle_status="active")
        pool.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import validate_claim
            result = await validate_claim(_valid_serial(), claim_id)

        assert result.valid is False
        assert result.error_code == "device_already_active"

    @pytest.mark.asyncio
    async def test_validate_claim_device_revoked(self, mock_pool):
        """A revoked device is not claimable — returns device_revoked."""
        pool, _ = mock_pool
        claim_id, salt, device = _make_device_row(lifecycle_status="revoked")
        pool.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import validate_claim
            result = await validate_claim(_valid_serial(), claim_id)

        assert result.valid is False
        assert result.error_code == "device_revoked"


# ── execute_claim ────────────────────────────────────────────────────


class TestExecuteClaim:
    """Tests for execute_claim()."""

    def _claim_kwargs(self, serial: str, claim_id: str) -> dict:
        return {
            "serial_number": serial,
            "claim_id": claim_id,
            "user_id": "user-123",
            "organization_id": "org-456",
            "site_id": "site-789",
            "parking_space_id": "ps-012",
            "accessible_type": "van",
            "installation_photos": ["photo1.jpg"],
            "install_notes": "Installed at entrance",
        }

    def _site_row(self, org_id="org-456"):
        return FakeRecord(id="site-789", organization_id=org_id)

    def _space_row(self, site_id="site-789", current_device_id=None):
        return FakeRecord(id="ps-012", site_id=site_id, current_device_id=current_device_id)

    @pytest.mark.asyncio
    async def test_execute_claim_success(self, mock_pool):
        """Happy path: transaction commits, device returned with 'active' status."""
        pool, conn = mock_pool
        claim_id, salt, device = _make_device_row()
        serial = _valid_serial()

        updated = FakeRecord(**{**device, "lifecycle_status": "active", "claim_status": "used"})
        install_row = FakeRecord(id=uuid.uuid4())

        conn.fetchrow = AsyncMock(side_effect=[device, self._site_row(), self._space_row(), updated, install_row])
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import execute_claim
            result = await execute_claim(**self._claim_kwargs(serial, claim_id))

        assert result.success is True
        assert result.device is not None

    @pytest.mark.asyncio
    async def test_execute_claim_race_condition(self, mock_pool):
        """If the device status changed between validate and execute, claim fails."""
        pool, conn = mock_pool
        _, _, device = _make_device_row(claim_status="used")
        serial = _valid_serial()

        conn.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import execute_claim
            result = await execute_claim(**self._claim_kwargs(serial, "AAAA-BBBB"))

        assert result.success is False
        assert result.error_code == "claim_already_used"

    @pytest.mark.asyncio
    async def test_execute_claim_creates_installation_record(self, mock_pool):
        """execute_claim inserts into the installations table."""
        pool, conn = mock_pool
        claim_id, salt, device = _make_device_row()
        serial = _valid_serial()

        updated = FakeRecord(**{**device, "lifecycle_status": "active", "claim_status": "used"})
        install_row = FakeRecord(id=uuid.uuid4())

        conn.fetchrow = AsyncMock(side_effect=[device, self._site_row(), self._space_row(), updated, install_row])
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import execute_claim
            await execute_claim(**self._claim_kwargs(serial, claim_id))

        # The fifth fetchrow call is the installations INSERT … RETURNING
        calls = conn.fetchrow.call_args_list
        install_call = calls[4]
        assert "installations" in install_call.args[0]

    @pytest.mark.asyncio
    async def test_execute_claim_creates_device_event(self, mock_pool):
        """execute_claim inserts a 'claimed' device_event."""
        pool, conn = mock_pool
        claim_id, salt, device = _make_device_row()
        serial = _valid_serial()

        updated = FakeRecord(**{**device, "lifecycle_status": "active", "claim_status": "used"})
        install_row = FakeRecord(id=uuid.uuid4())

        conn.fetchrow = AsyncMock(side_effect=[device, self._site_row(), self._space_row(), updated, install_row])
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import execute_claim
            await execute_claim(**self._claim_kwargs(serial, claim_id))

        event_calls = [
            c for c in conn.execute.call_args_list
            if "device_events" in c.args[0]
        ]
        assert len(event_calls) == 1
        assert "'claimed'" in event_calls[0].args[0]

    @pytest.mark.asyncio
    async def test_execute_claim_creates_audit_log(self, mock_pool):
        """execute_claim calls log_action after transaction commits."""
        pool, conn = mock_pool
        claim_id, salt, device = _make_device_row()
        serial = _valid_serial()

        updated = FakeRecord(**{**device, "lifecycle_status": "active", "claim_status": "used"})
        install_row = FakeRecord(id=uuid.uuid4())

        conn.fetchrow = AsyncMock(side_effect=[device, self._site_row(), self._space_row(), updated, install_row])
        conn.execute = AsyncMock()

        mock_log = AsyncMock()
        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", mock_log),
        ):
            from app.services.device_service import execute_claim
            await execute_claim(**self._claim_kwargs(serial, claim_id))

        mock_log.assert_awaited_once()
        assert mock_log.call_args.kwargs["action"] == "device.claimed"

    @pytest.mark.asyncio
    async def test_execute_claim_rejects_cross_org_site(self, mock_pool):
        """Claim fails when site belongs to a different organization."""
        pool, conn = mock_pool
        claim_id, salt, device = _make_device_row()
        serial = _valid_serial()

        wrong_org_site = FakeRecord(id="site-789", organization_id="other-org")
        conn.fetchrow = AsyncMock(side_effect=[device, wrong_org_site])

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import execute_claim
            result = await execute_claim(**self._claim_kwargs(serial, claim_id))

        assert result.success is False
        assert result.error_code == "site_org_mismatch"

    @pytest.mark.asyncio
    async def test_execute_claim_rejects_mismatched_space_site(self, mock_pool):
        """Claim fails when parking space belongs to a different site."""
        pool, conn = mock_pool
        claim_id, salt, device = _make_device_row()
        serial = _valid_serial()

        wrong_site_space = FakeRecord(id="ps-012", site_id="other-site", current_device_id=None)
        conn.fetchrow = AsyncMock(side_effect=[device, self._site_row(), wrong_site_space])

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import execute_claim
            result = await execute_claim(**self._claim_kwargs(serial, claim_id))

        assert result.success is False
        assert result.error_code == "space_site_mismatch"

    @pytest.mark.asyncio
    async def test_execute_claim_rejects_occupied_space(self, mock_pool):
        """Claim fails when parking space is occupied by another device."""
        pool, conn = mock_pool
        claim_id, salt, device = _make_device_row()
        serial = _valid_serial()

        occupied_space = FakeRecord(id="ps-012", site_id="site-789", current_device_id=uuid.uuid4())
        conn.fetchrow = AsyncMock(side_effect=[device, self._site_row(), occupied_space])

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import execute_claim
            result = await execute_claim(**self._claim_kwargs(serial, claim_id))

        assert result.success is False
        assert result.error_code == "space_occupied"

    @pytest.mark.asyncio
    async def test_execute_claim_rejects_missing_site(self, mock_pool):
        """Claim fails when the specified site does not exist."""
        pool, conn = mock_pool
        claim_id, salt, device = _make_device_row()
        serial = _valid_serial()

        conn.fetchrow = AsyncMock(side_effect=[device, None])

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import execute_claim
            result = await execute_claim(**self._claim_kwargs(serial, claim_id))

        assert result.success is False
        assert result.error_code == "site_not_found"


# ── Route-level validate tests ───────────────────────────────────────


class TestValidateClaimRoute:
    """Route-level tests for POST /api/v1/device-claims/validate.

    These exercise the full route handler (Pydantic models, status codes)
    with mocked service calls, catching contract mismatches between the
    service return value and the route's DeviceSummary model.
    """

    VALIDATE_URL = "/api/v1/device-claims/validate"

    def test_validate_success_returns_device_summary(self, client_alice):
        """A valid claim returns 200 with all DeviceSummary fields."""
        from app.services.device_service import ValidationResult

        mock_result = ValidationResult(
            valid=True,
            device={
                "id": str(uuid.uuid4()),
                "serial_number": _valid_serial(),
                "model_code": "S01",
                "hardware_revision": "1.0",
                "lifecycle_status": "manufactured",
                "name": "Test Device",
            },
        )

        with patch(
            "app.routes.device_claims.device_service.validate_claim",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            resp = client_alice.post(
                self.VALIDATE_URL,
                json={"serial_number": "SHS-XXXXX", "claim_id": "abc123"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert body["device"]["serial_number"] == mock_result.device["serial_number"]
        assert body["device"]["lifecycle_status"] == "manufactured"
        assert body["device"]["hardware_revision"] == "1.0"
        assert body["device"]["model_code"] == "S01"

    def test_validate_invalid_claim_returns_error(self, client_alice):
        """An invalid claim returns 200 with valid=false and error info."""
        from app.services.device_service import ValidationResult

        mock_result = ValidationResult(
            valid=False,
            error="Device not found",
            error_code="device_not_found",
        )

        with patch(
            "app.routes.device_claims.device_service.validate_claim",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            resp = client_alice.post(
                self.VALIDATE_URL,
                json={"serial_number": "SHS-XXXXX", "claim_id": "bad123"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is False
        assert body["error_code"] == "device_not_found"
        assert body["device"] is None

    def test_validate_unauthenticated_returns_401(self, client_anon):
        """Unauthenticated requests are rejected."""
        resp = client_anon.post(
            self.VALIDATE_URL,
            json={"serial_number": "SHS-XXXXX", "claim_id": "abc123"},
        )
        # The auth middleware should reject before reaching the handler
        assert resp.status_code in (401, 403)
