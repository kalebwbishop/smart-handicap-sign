"""Tests for device lifecycle operations: revoke, transfer, release, regenerate.

All database access is mocked — no real asyncpg connection required.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── helpers ──────────────────────────────────────────────────────────


class FakeRecord(dict):
    """A plain dict subclass that behaves like an asyncpg Record."""


def _valid_serial() -> str:
    from app.utils.serial import generate_serial_number
    return generate_serial_number(26, 5, "S01", "A7K", 482)


def _device_row(
    *,
    lifecycle_status: str = "active",
    parking_space_id: str | None = "ps-old",
    site_id: str | None = "site-old",
    organization_id: str | None = "org-456",
) -> FakeRecord:
    """Minimal device FakeRecord matching what the service reads from asyncpg."""
    return FakeRecord(
        id=uuid.uuid4(),
        serial_number=_valid_serial(),
        model_code="S01",
        hardware_revision="1.0",
        firmware_version="2.0.0",
        manufacture_batch="A7K",
        lifecycle_status=lifecycle_status,
        claim_status="used",
        claim_expires_at=None,
        claimed_by_user_id="user-111",
        claimed_at=datetime.now(timezone.utc),
        organization_id=organization_id,
        current_site_id=site_id,
        current_parking_space_id=parking_space_id,
        name="Test Device",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def mock_pool():
    """Async mock for the asyncpg pool and connection."""
    pool = AsyncMock()
    conn = AsyncMock()

    acquire_cm = MagicMock()
    acquire_cm.__aenter__ = AsyncMock(return_value=conn)
    acquire_cm.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=acquire_cm)

    tx_cm = MagicMock()
    tx_cm.__aenter__ = AsyncMock(return_value=None)
    tx_cm.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=tx_cm)

    return pool, conn


# ── revoke_device ────────────────────────────────────────────────────


class TestRevokeDevice:
    """Tests for revoke_device()."""

    @pytest.mark.asyncio
    async def test_revoke_device_success(self, mock_pool):
        """Revoking an existing device returns updated dict with status 'revoked'."""
        pool, conn = mock_pool
        device = _device_row()
        revoked = FakeRecord(**{**device, "lifecycle_status": "revoked", "claim_status": "revoked",
                   "current_site_id": None, "current_parking_space_id": None})

        conn.fetchrow = AsyncMock(side_effect=[device, revoked])
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import revoke_device
            result = await revoke_device(_valid_serial(), "admin-1", "policy violation")

        assert result is not None
        assert result["lifecycle_status"] == "revoked"

    @pytest.mark.asyncio
    async def test_revoke_clears_parking_space(self, mock_pool):
        """When a revoked device has a parking space, it is cleared to NULL."""
        pool, conn = mock_pool
        device = _device_row(parking_space_id="ps-abc")
        revoked = FakeRecord(**{**device, "lifecycle_status": "revoked", "claim_status": "revoked",
                   "current_site_id": None, "current_parking_space_id": None})

        conn.fetchrow = AsyncMock(side_effect=[device, revoked])
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import revoke_device
            await revoke_device(_valid_serial(), "admin-1", "testing")

        ps_calls = [c for c in conn.execute.call_args_list
                     if "parking_spaces" in c.args[0]]
        assert len(ps_calls) >= 1

    @pytest.mark.asyncio
    async def test_revoke_device_not_found(self, mock_pool):
        """Revoking a non-existent device returns None."""
        pool, conn = mock_pool
        conn.fetchrow = AsyncMock(return_value=None)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import revoke_device
            result = await revoke_device(_valid_serial(), "admin-1", "testing")

        assert result is None


# ── transfer_device ──────────────────────────────────────────────────


class TestTransferDevice:
    """Tests for transfer_device()."""

    @pytest.mark.asyncio
    async def test_transfer_device_success(self, mock_pool):
        """Transferring an active device updates site and parking space."""
        pool, conn = mock_pool
        device = _device_row(lifecycle_status="active")
        transferred = FakeRecord(**{**device, "current_site_id": "site-new",
                       "current_parking_space_id": "ps-new"})

        site_row = FakeRecord(id="site-new", organization_id="org-456")
        space_row = FakeRecord(id="ps-new", site_id="site-new", current_device_id=None)

        conn.fetchrow = AsyncMock(side_effect=[
            device,
            site_row,
            space_row,
            transferred,
            FakeRecord(id=uuid.uuid4()),
        ])
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import transfer_device
            result = await transfer_device(
                _valid_serial(), "site-new", "ps-new", "van", "user-1", notes="moved",
            )

        assert result is not None
        assert result["current_site_id"] == "site-new"

    @pytest.mark.asyncio
    async def test_transfer_only_active_devices(self, mock_pool):
        """Transferring a non-active device returns None."""
        pool, conn = mock_pool
        device = _device_row(lifecycle_status="revoked")

        conn.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import transfer_device
            result = await transfer_device(
                _valid_serial(), "site-new", "ps-new", "van", "user-1",
            )

        assert result is None

    @pytest.mark.asyncio
    async def test_transfer_device_not_found(self, mock_pool):
        """Transferring a non-existent device returns None."""
        pool, conn = mock_pool
        conn.fetchrow = AsyncMock(return_value=None)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import transfer_device
            result = await transfer_device(
                _valid_serial(), "site-new", "ps-new", "van", "user-1",
            )

        assert result is None


# ── release_device ───────────────────────────────────────────────────


class TestReleaseDevice:
    """Tests for release_device()."""

    @pytest.mark.asyncio
    async def test_release_device_success(self, mock_pool):
        """Releasing an active device transitions it to 'unclaimed'."""
        pool, conn = mock_pool
        device = _device_row(lifecycle_status="active")
        released = FakeRecord(**{**device, "lifecycle_status": "unclaimed", "claim_status": "revoked",
                    "organization_id": None, "current_site_id": None,
                    "current_parking_space_id": None, "claimed_by_user_id": None,
                    "claimed_at": None})

        conn.fetchrow = AsyncMock(side_effect=[device, released])
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import release_device
            result = await release_device(_valid_serial(), "admin-1")

        assert result is not None
        assert result["lifecycle_status"] == "unclaimed"
        assert result["organization_id"] is None

    @pytest.mark.asyncio
    async def test_release_resets_assignments(self, mock_pool):
        """Release clears org, site, parking space, and user assignments."""
        pool, conn = mock_pool
        device = _device_row(lifecycle_status="active", parking_space_id="ps-old")
        released = FakeRecord(**{**device, "lifecycle_status": "unclaimed", "claim_status": "revoked",
                    "organization_id": None, "current_site_id": None,
                    "current_parking_space_id": None, "claimed_by_user_id": None,
                    "claimed_at": None})

        conn.fetchrow = AsyncMock(side_effect=[device, released])
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import release_device
            result = await release_device(_valid_serial(), "admin-1")

        assert result["current_parking_space_id"] is None
        assert result["current_site_id"] is None
        assert result["claimed_by_user_id"] is None

    @pytest.mark.asyncio
    async def test_release_non_active_returns_none(self, mock_pool):
        """Releasing a non-active device returns None."""
        pool, conn = mock_pool
        device = _device_row(lifecycle_status="manufactured")

        conn.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import release_device
            result = await release_device(_valid_serial(), "admin-1")

        assert result is None


# ── regenerate_claim_id ──────────────────────────────────────────────


class TestRegenerateClaimId:
    """Tests for regenerate_claim_id()."""

    @pytest.mark.asyncio
    async def test_regenerate_claim_id_success(self, mock_pool):
        """Regenerating returns a new plain-text claim ID for an unclaimed device."""
        pool, conn = mock_pool
        device = _device_row(lifecycle_status="unclaimed")

        conn.fetchrow = AsyncMock(return_value=device)
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import regenerate_claim_id
            new_cid = await regenerate_claim_id(_valid_serial(), "admin-1")

        assert new_cid is not None
        assert len(new_cid) == 9
        assert new_cid[4] == "-"

    @pytest.mark.asyncio
    async def test_regenerate_only_unclaimed_devices(self, mock_pool):
        """Regeneration is rejected for active devices."""
        pool, conn = mock_pool
        device = _device_row(lifecycle_status="active")

        conn.fetchrow = AsyncMock(return_value=device)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import regenerate_claim_id
            result = await regenerate_claim_id(_valid_serial(), "admin-1")

        assert result is None

    @pytest.mark.asyncio
    async def test_regenerate_not_found(self, mock_pool):
        """Regeneration for a non-existent device returns None."""
        pool, conn = mock_pool
        conn.fetchrow = AsyncMock(return_value=None)

        with patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool):
            from app.services.device_service import regenerate_claim_id
            result = await regenerate_claim_id(_valid_serial(), "admin-1")

        assert result is None

    @pytest.mark.asyncio
    async def test_regenerate_manufactured_device_allowed(self, mock_pool):
        """Regeneration is allowed for 'manufactured' lifecycle status."""
        pool, conn = mock_pool
        device = _device_row(lifecycle_status="manufactured")

        conn.fetchrow = AsyncMock(return_value=device)
        conn.execute = AsyncMock()

        with (
            patch("app.services.device_service.get_pool", new_callable=AsyncMock, return_value=pool),
            patch("app.services.device_service.log_action", new_callable=AsyncMock),
        ):
            from app.services.device_service import regenerate_claim_id
            new_cid = await regenerate_claim_id(_valid_serial(), "admin-1")

        assert new_cid is not None
