"""Device service — claim validation, execution, lifecycle, and device events."""

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from app.config.database import get_pool
from app.services.audit_service import log_action
from app.utils.claim import generate_claim_id, generate_salt, hash_claim_id, verify_claim_id
from app.utils.logger import logger
from app.utils.serial import validate_serial_number


# ── result types ─────────────────────────────────────────────────────


@dataclass
class ValidationResult:
    valid: bool
    device: Optional[dict] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


@dataclass
class ClaimResult:
    success: bool
    device: Optional[dict] = None
    error: Optional[str] = None
    error_code: Optional[str] = None


# ── row helpers ──────────────────────────────────────────────────────

_UUID_FIELDS = (
    "id",
    "organization_id",
    "current_site_id",
    "current_parking_space_id",
    "claimed_by_user_id",
)


def _row_to_dict(row) -> dict:
    """Convert asyncpg Record to dict with string UUIDs."""
    d = dict(row)
    for key in _UUID_FIELDS:
        if d.get(key):
            d[key] = str(d[key])
    return d


# ── read operations ──────────────────────────────────────────────────


async def get_device_by_serial(serial_number: str) -> Optional[dict]:
    """Fetch a device by serial number. Returns None if not found."""
    pool = await get_pool()

    row = await pool.fetchrow(
        """
        SELECT id, serial_number, model_code, hardware_revision,
               firmware_version, manufacture_batch, lifecycle_status,
               operational_status, claim_status, claim_expires_at,
               claimed_by_user_id, claimed_at, organization_id,
               current_site_id, current_parking_space_id, name,
               created_at, updated_at
        FROM devices
        WHERE serial_number = $1
        """,
        serial_number,
    )

    if not row:
        return None

    return _row_to_dict(row)


async def list_devices(
    *,
    organization_id: Optional[str] = None,
    lifecycle_status: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> list[dict]:
    """List devices, optionally filtered. If user_id is provided, scoped to user's orgs."""
    pool = await get_pool()

    conditions: list[str] = []
    params: list[Any] = []
    idx = 1

    if user_id:
        conditions.append(
            f"""d.organization_id IN (
                SELECT organization_id FROM organization_members WHERE user_id = ${idx}
            )"""
        )
        params.append(user_id)
        idx += 1

    if organization_id:
        conditions.append(f"d.organization_id = ${idx}")
        params.append(organization_id)
        idx += 1

    if lifecycle_status:
        conditions.append(f"d.lifecycle_status = ${idx}")
        params.append(lifecycle_status)
        idx += 1

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    params.extend([limit, skip])
    query = f"""
        SELECT d.id, d.serial_number, d.model_code, d.hardware_revision,
               d.firmware_version, d.manufacture_batch, d.lifecycle_status,
               d.operational_status, d.claim_status, d.claim_expires_at,
               d.claimed_by_user_id, d.claimed_at, d.organization_id,
               d.current_site_id, d.current_parking_space_id, d.name,
               d.created_at, d.updated_at
        FROM devices d
        {where}
        ORDER BY d.created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
    """

    rows = await pool.fetch(query, *params)
    return [_row_to_dict(r) for r in rows]


# ── claim validation ─────────────────────────────────────────────────


async def validate_claim(serial_number: str, claim_id: str) -> ValidationResult:
    """
    Validate a claim attempt without mutating state.

    Checks:
    1. Serial number format
    2. Device exists
    3. lifecycle_status in ('manufactured', 'unclaimed')
    4. claim_status is 'unused'
    5. Claim not expired
    6. Claim ID hash matches
    """
    # 1 — serial format
    if not validate_serial_number(serial_number):
        return ValidationResult(
            valid=False,
            error="Invalid serial number format",
            error_code="invalid_serial",
        )

    # 2 — device exists
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, serial_number, model_code, hardware_revision,
               lifecycle_status, claim_status, claim_id_hash,
               claim_id_salt, claim_expires_at, name
        FROM devices
        WHERE serial_number = $1
        """,
        serial_number,
    )

    if not row:
        return ValidationResult(
            valid=False,
            error="Device not found",
            error_code="device_not_found",
        )

    device = dict(row)

    # 3 — lifecycle status
    if device["lifecycle_status"] not in ("manufactured", "unclaimed"):
        status = device["lifecycle_status"]
        error_code_map = {
            "active": "device_already_active",
            "revoked": "device_revoked",
            "retired": "device_retired",
        }
        return ValidationResult(
            valid=False,
            error=f"Device is not claimable (status: {status})",
            error_code=error_code_map.get(status, "device_not_claimable"),
        )

    # 4 — claim status
    if device["claim_status"] != "unused":
        return ValidationResult(
            valid=False,
            error=f"Claim code already {device['claim_status']}",
            error_code="claim_already_used",
        )

    # 5 — expiry
    if device["claim_expires_at"] is not None:
        now = datetime.now(timezone.utc)
        if device["claim_expires_at"] < now:
            return ValidationResult(
                valid=False,
                error="Claim code has expired",
                error_code="claim_expired",
            )

    # 6 — hash match
    stored_hash = device.get("claim_id_hash")
    stored_salt = device.get("claim_id_salt")

    if not stored_hash or not stored_salt:
        return ValidationResult(
            valid=False,
            error="Device has no claim code configured",
            error_code="no_claim_configured",
        )

    if not verify_claim_id(claim_id, stored_hash, stored_salt):
        return ValidationResult(
            valid=False,
            error="Invalid claim code",
            error_code="invalid_claim_id",
        )

    # Build a safe summary for the caller
    summary = {
        "id": str(device["id"]),
        "serial_number": device["serial_number"],
        "model_code": device["model_code"],
        "hardware_revision": device.get("hardware_revision"),
        "lifecycle_status": device["lifecycle_status"],
        "name": device["name"],
    }

    return ValidationResult(valid=True, device=summary)


# ── claim execution ──────────────────────────────────────────────────


async def execute_claim(
    *,
    serial_number: str,
    claim_id: str,
    user_id: str,
    organization_id: str,
    site_id: str,
    parking_space_id: str,
    accessible_type: str,
    installation_photos: list[str],
    install_notes: Optional[str] = None,
) -> ClaimResult:
    """
    Execute the full device claim atomically within a single transaction.

    Re-validates inside the transaction with SELECT … FOR UPDATE to
    prevent race conditions, then updates device, parking space, and
    creates installation + device_event records.

    Audit log is written *after* the transaction commits (audit_service
    uses its own pool connection).
    """
    pool = await get_pool()
    now = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        async with conn.transaction():

            # ── 1. Lock and re-validate ──────────────────────────
            device = await conn.fetchrow(
                """
                SELECT id, serial_number, model_code, lifecycle_status,
                       claim_status, claim_id_hash, claim_id_salt,
                       claim_expires_at, name
                FROM devices
                WHERE serial_number = $1
                FOR UPDATE
                """,
                serial_number,
            )

            if not device:
                return ClaimResult(
                    success=False,
                    error="Device not found",
                    error_code="device_not_found",
                )

            if device["lifecycle_status"] not in ("manufactured", "unclaimed"):
                status = device["lifecycle_status"]
                error_code_map = {
                    "active": "device_already_active",
                    "revoked": "device_revoked",
                    "retired": "device_retired",
                }
                return ClaimResult(
                    success=False,
                    error=f"Device is not claimable (status: {status})",
                    error_code=error_code_map.get(status, "device_not_claimable"),
                )

            if device["claim_status"] != "unused":
                return ClaimResult(
                    success=False,
                    error=f"Claim code already {device['claim_status']}",
                    error_code="claim_already_used",
                )

            if device["claim_expires_at"] is not None and device["claim_expires_at"] < now:
                return ClaimResult(
                    success=False,
                    error="Claim code has expired",
                    error_code="claim_expired",
                )

            stored_hash = device.get("claim_id_hash")
            stored_salt = device.get("claim_id_salt")
            if not stored_hash or not stored_salt:
                return ClaimResult(
                    success=False,
                    error="Device has no claim code configured",
                    error_code="no_claim_configured",
                )

            if not verify_claim_id(claim_id, stored_hash, stored_salt):
                return ClaimResult(
                    success=False,
                    error="Invalid claim code",
                    error_code="invalid_claim_id",
                )

            device_id = device["id"]

            # ── 1b. Validate location ownership ──────────────────
            # Verify site belongs to the target organization
            site_row = await conn.fetchrow(
                """
                SELECT id, organization_id
                FROM sites
                WHERE id = $1
                """,
                site_id,
            )
            if not site_row:
                return ClaimResult(
                    success=False,
                    error="Site not found",
                    error_code="site_not_found",
                )
            if str(site_row["organization_id"]) != str(organization_id):
                return ClaimResult(
                    success=False,
                    error="Site does not belong to the specified organization",
                    error_code="site_org_mismatch",
                )

            # Verify parking space belongs to the target site
            space_row = await conn.fetchrow(
                """
                SELECT id, site_id, current_device_id
                FROM parking_spaces
                WHERE id = $1
                """,
                parking_space_id,
            )
            if not space_row:
                return ClaimResult(
                    success=False,
                    error="Parking space not found",
                    error_code="space_not_found",
                )
            if str(space_row["site_id"]) != str(site_id):
                return ClaimResult(
                    success=False,
                    error="Parking space does not belong to the specified site",
                    error_code="space_site_mismatch",
                )

            # Check occupancy — reject if another device already occupies this space
            if space_row["current_device_id"] is not None and str(space_row["current_device_id"]) != str(device_id):
                return ClaimResult(
                    success=False,
                    error="Parking space is already occupied by another device",
                    error_code="space_occupied",
                )
            updated_device = await conn.fetchrow(
                """
                UPDATE devices
                SET lifecycle_status         = 'active',
                    claim_status             = 'used',
                    claimed_by_user_id       = $2,
                    claimed_at               = $3,
                    organization_id          = $4,
                    current_site_id          = $5,
                    current_parking_space_id = $6
                WHERE id = $1
                RETURNING id, serial_number, model_code, hardware_revision,
                          firmware_version, manufacture_batch, lifecycle_status,
                          claim_status, claim_expires_at, claimed_by_user_id,
                          claimed_at, organization_id, current_site_id,
                          current_parking_space_id, name, created_at, updated_at
                """,
                device_id,
                user_id,
                now,
                organization_id,
                site_id,
                parking_space_id,
            )

            # ── 3. Update parking space ──────────────────────────
            await conn.execute(
                """
                UPDATE parking_spaces
                SET current_device_id = $1,
                    accessible_type   = $2
                WHERE id = $3
                """,
                device_id,
                accessible_type,
                parking_space_id,
            )

            # ── 4. Create installation record ────────────────────
            await conn.fetchrow(
                """
                INSERT INTO installations (
                    device_id, organization_id, site_id, parking_space_id,
                    installer_user_id, installation_photos, install_notes,
                    installed_at, activation_status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
                RETURNING id
                """,
                device_id,
                organization_id,
                site_id,
                parking_space_id,
                user_id,
                json.dumps(installation_photos),
                install_notes,
                now,
            )

            # ── 5. Create device event ───────────────────────────
            await conn.execute(
                """
                INSERT INTO device_events (device_id, event_type, payload)
                VALUES ($1, 'claimed', $2)
                """,
                device_id,
                json.dumps({
                    "user_id": user_id,
                    "organization_id": organization_id,
                    "site_id": site_id,
                    "parking_space_id": parking_space_id,
                }),
            )

    # ── 6. Audit log (after commit — uses own pool connection) ───
    device_dict = _row_to_dict(updated_device)

    await log_action(
        actor_user_id=user_id,
        action="device.claimed",
        entity_type="device",
        entity_id=device_dict["id"],
        metadata={
            "serial_number": serial_number,
            "organization_id": organization_id,
            "site_id": site_id,
            "parking_space_id": parking_space_id,
        },
    )

    logger.info("🔗 Device %s claimed by user %s", serial_number, user_id)
    return ClaimResult(success=True, device=device_dict)


# ── lifecycle operations ─────────────────────────────────────────────


async def revoke_device(
    serial_number: str,
    actor_user_id: str,
    reason: str,
) -> Optional[dict]:
    """
    Revoke a device — mark lifecycle_status='revoked', claim_status='revoked'.
    Clears parking_space.current_device_id if set.
    """
    pool = await get_pool()

    async with pool.acquire() as conn:
        async with conn.transaction():

            device = await conn.fetchrow(
                """
                SELECT id, current_parking_space_id
                FROM devices
                WHERE serial_number = $1
                FOR UPDATE
                """,
                serial_number,
            )

            if not device:
                return None

            device_id = device["id"]

            # Clear parking space link
            if device["current_parking_space_id"]:
                await conn.execute(
                    "UPDATE parking_spaces SET current_device_id = NULL WHERE id = $1",
                    device["current_parking_space_id"],
                )

            # Deactivate any active installation
            await conn.execute(
                """
                UPDATE installations
                SET activation_status = 'decommissioned'
                WHERE device_id = $1 AND activation_status = 'active'
                """,
                device_id,
            )

            updated = await conn.fetchrow(
                """
                UPDATE devices
                SET lifecycle_status         = 'revoked',
                    claim_status             = 'revoked',
                    current_site_id          = NULL,
                    current_parking_space_id = NULL
                WHERE id = $1
                RETURNING id, serial_number, model_code, hardware_revision,
                          firmware_version, manufacture_batch, lifecycle_status,
                          claim_status, claim_expires_at, claimed_by_user_id,
                          claimed_at, organization_id, current_site_id,
                          current_parking_space_id, name, created_at, updated_at
                """,
                device_id,
            )

            await conn.execute(
                """
                INSERT INTO device_events (device_id, event_type, payload)
                VALUES ($1, 'revoked', $2)
                """,
                device_id,
                json.dumps({"actor_user_id": actor_user_id, "reason": reason}),
            )

    device_dict = _row_to_dict(updated)

    await log_action(
        actor_user_id=actor_user_id,
        action="device.revoked",
        entity_type="device",
        entity_id=device_dict["id"],
        metadata={"serial_number": serial_number, "reason": reason},
    )

    logger.info("🚫 Device %s revoked by %s: %s", serial_number, actor_user_id, reason)
    return device_dict


async def transfer_device(
    serial_number: str,
    new_site_id: str,
    new_parking_space_id: str,
    accessible_type: str,
    actor_user_id: str,
    notes: Optional[str] = None,
) -> Optional[dict]:
    """
    Transfer an active device to a new site/parking space.
    Decommissions the old installation, creates a new one.
    """
    pool = await get_pool()
    now = datetime.now(timezone.utc)

    async with pool.acquire() as conn:
        async with conn.transaction():

            device = await conn.fetchrow(
                """
                SELECT id, lifecycle_status, organization_id,
                       current_site_id, current_parking_space_id
                FROM devices
                WHERE serial_number = $1
                FOR UPDATE
                """,
                serial_number,
            )

            if not device:
                return None

            if device["lifecycle_status"] != "active":
                logger.warning(
                    "Transfer rejected — device %s status is %s",
                    serial_number,
                    device["lifecycle_status"],
                )
                return None

            device_id = device["id"]
            old_space_id = device["current_parking_space_id"]
            old_site_id = device["current_site_id"]
            org_id = device["organization_id"]

            # Validate site belongs to the device's organization
            site_row = await conn.fetchrow(
                "SELECT id, organization_id FROM sites WHERE id = $1",
                new_site_id,
            )
            if not site_row or str(site_row["organization_id"]) != str(org_id):
                logger.warning(
                    "Transfer rejected — site %s does not belong to org %s",
                    new_site_id, org_id,
                )
                return None

            # Validate parking space belongs to the target site
            space_row = await conn.fetchrow(
                "SELECT id, site_id, current_device_id FROM parking_spaces WHERE id = $1",
                new_parking_space_id,
            )
            if not space_row or str(space_row["site_id"]) != str(new_site_id):
                logger.warning(
                    "Transfer rejected — space %s does not belong to site %s",
                    new_parking_space_id, new_site_id,
                )
                return None

            # Check occupancy — allow if same device is transferring to the same space
            if (
                space_row["current_device_id"] is not None
                and str(space_row["current_device_id"]) != str(device_id)
            ):
                logger.warning(
                    "Transfer rejected — space %s is occupied by device %s",
                    new_parking_space_id, space_row["current_device_id"],
                )
                return None

            # Clear old parking space
            if old_space_id:
                await conn.execute(
                    "UPDATE parking_spaces SET current_device_id = NULL WHERE id = $1",
                    old_space_id,
                )

            # Deactivate old installation
            await conn.execute(
                """
                UPDATE installations
                SET activation_status = 'decommissioned'
                WHERE device_id = $1 AND activation_status = 'active'
                """,
                device_id,
            )

            # Update device to new location
            updated = await conn.fetchrow(
                """
                UPDATE devices
                SET current_site_id          = $2,
                    current_parking_space_id = $3
                WHERE id = $1
                RETURNING id, serial_number, model_code, hardware_revision,
                          firmware_version, manufacture_batch, lifecycle_status,
                          claim_status, claim_expires_at, claimed_by_user_id,
                          claimed_at, organization_id, current_site_id,
                          current_parking_space_id, name, created_at, updated_at
                """,
                device_id,
                new_site_id,
                new_parking_space_id,
            )

            # Set new parking space
            await conn.execute(
                """
                UPDATE parking_spaces
                SET current_device_id = $1,
                    accessible_type   = $2
                WHERE id = $3
                """,
                device_id,
                accessible_type,
                new_parking_space_id,
            )

            # Create new installation record
            await conn.fetchrow(
                """
                INSERT INTO installations (
                    device_id, organization_id, site_id, parking_space_id,
                    installer_user_id, install_notes, installed_at,
                    activation_status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
                RETURNING id
                """,
                device_id,
                org_id,
                new_site_id,
                new_parking_space_id,
                actor_user_id,
                notes,
                now,
            )

            # Device event
            await conn.execute(
                """
                INSERT INTO device_events (device_id, event_type, payload)
                VALUES ($1, 'transferred', $2)
                """,
                device_id,
                json.dumps({
                    "actor_user_id": actor_user_id,
                    "old_site_id": str(old_site_id) if old_site_id else None,
                    "old_parking_space_id": str(old_space_id) if old_space_id else None,
                    "new_site_id": new_site_id,
                    "new_parking_space_id": new_parking_space_id,
                }),
            )

    device_dict = _row_to_dict(updated)

    await log_action(
        actor_user_id=actor_user_id,
        action="device.transferred",
        entity_type="device",
        entity_id=device_dict["id"],
        metadata={
            "serial_number": serial_number,
            "new_site_id": new_site_id,
            "new_parking_space_id": new_parking_space_id,
        },
    )

    logger.info("🔀 Device %s transferred to space %s", serial_number, new_parking_space_id)
    return device_dict


async def release_device(
    serial_number: str,
    actor_user_id: str,
) -> Optional[dict]:
    """
    Release an active device back to 'unclaimed'.
    Clears org, site, parking space. Revokes old claim code.
    """
    pool = await get_pool()

    async with pool.acquire() as conn:
        async with conn.transaction():

            device = await conn.fetchrow(
                """
                SELECT id, lifecycle_status, current_parking_space_id
                FROM devices
                WHERE serial_number = $1
                FOR UPDATE
                """,
                serial_number,
            )

            if not device:
                return None

            if device["lifecycle_status"] != "active":
                logger.warning(
                    "Release rejected — device %s status is %s",
                    serial_number,
                    device["lifecycle_status"],
                )
                return None

            device_id = device["id"]

            # Clear parking space link
            if device["current_parking_space_id"]:
                await conn.execute(
                    "UPDATE parking_spaces SET current_device_id = NULL WHERE id = $1",
                    device["current_parking_space_id"],
                )

            # Deactivate installation
            await conn.execute(
                """
                UPDATE installations
                SET activation_status = 'decommissioned'
                WHERE device_id = $1 AND activation_status = 'active'
                """,
                device_id,
            )

            updated = await conn.fetchrow(
                """
                UPDATE devices
                SET lifecycle_status         = 'unclaimed',
                    claim_status             = 'revoked',
                    organization_id          = NULL,
                    current_site_id          = NULL,
                    current_parking_space_id = NULL,
                    claimed_by_user_id       = NULL,
                    claimed_at               = NULL
                WHERE id = $1
                RETURNING id, serial_number, model_code, hardware_revision,
                          firmware_version, manufacture_batch, lifecycle_status,
                          claim_status, claim_expires_at, claimed_by_user_id,
                          claimed_at, organization_id, current_site_id,
                          current_parking_space_id, name, created_at, updated_at
                """,
                device_id,
            )

            await conn.execute(
                """
                INSERT INTO device_events (device_id, event_type, payload)
                VALUES ($1, 'released', $2)
                """,
                device_id,
                json.dumps({"actor_user_id": actor_user_id}),
            )

    device_dict = _row_to_dict(updated)

    await log_action(
        actor_user_id=actor_user_id,
        action="device.released",
        entity_type="device",
        entity_id=device_dict["id"],
        metadata={"serial_number": serial_number},
    )

    logger.info("🔓 Device %s released by %s", serial_number, actor_user_id)
    return device_dict


async def regenerate_claim_id(
    serial_number: str,
    actor_user_id: str,
) -> Optional[str]:
    """
    Generate a new claim ID for an unclaimed device.

    Returns the NEW PLAIN TEXT claim ID (only time it's available).
    Returns None if device not found or not in a regenerable state.
    """
    pool = await get_pool()

    new_claim_id = generate_claim_id()
    salt = generate_salt()
    claim_hash = hash_claim_id(new_claim_id, salt)

    async with pool.acquire() as conn:
        async with conn.transaction():

            device = await conn.fetchrow(
                """
                SELECT id, lifecycle_status
                FROM devices
                WHERE serial_number = $1
                FOR UPDATE
                """,
                serial_number,
            )

            if not device:
                return None

            if device["lifecycle_status"] not in ("manufactured", "unclaimed"):
                logger.warning(
                    "Claim regen rejected — device %s status is %s",
                    serial_number,
                    device["lifecycle_status"],
                )
                return None

            device_id = device["id"]

            await conn.execute(
                """
                UPDATE devices
                SET claim_id_hash = $2,
                    claim_id_salt = $3,
                    claim_status  = 'unused'
                WHERE id = $1
                """,
                device_id,
                claim_hash,
                salt,
            )

    await log_action(
        actor_user_id=actor_user_id,
        action="device.claim_regenerated",
        entity_type="device",
        entity_id=str(device_id),
        metadata={"serial_number": serial_number},
    )

    logger.info("🔑 Claim ID regenerated for device %s by %s", serial_number, actor_user_id)
    return new_claim_id


# ── device events ────────────────────────────────────────────────────


async def create_device_event(
    *,
    serial_number: str,
    event_type: str,
    payload: Optional[dict[str, Any]] = None,
    notify_org: bool = False,
    notification_title: Optional[str] = None,
    notification_body: Optional[str] = None,
) -> Optional[dict]:
    """Create a v2 device_events row and optionally fan out org notifications.

    Returns the created device event dict, or None if the device is not found.
    Raises RuntimeError if the INSERT fails unexpectedly.
    """
    from app.services import notification_service

    pool = await get_pool()

    device = await pool.fetchrow(
        "SELECT id, organization_id FROM devices WHERE serial_number = $1",
        serial_number,
    )
    if not device:
        return None

    device_id = device["id"]
    org_id = str(device["organization_id"]) if device["organization_id"] else None

    event_payload = json.dumps(payload or {})
    row = await pool.fetchrow(
        """
        INSERT INTO device_events (device_id, event_type, payload)
        VALUES ($1, $2, $3::jsonb)
        RETURNING id, device_id, event_type, payload, created_at
        """,
        device_id,
        event_type,
        event_payload,
    )
    if not row:
        raise RuntimeError("Failed to create device event")

    event_dict = dict(row)
    event_dict["id"] = str(event_dict["id"])
    event_dict["device_id"] = str(event_dict["device_id"])

    logger.info("✅ Device event created: %s (type=%s)", event_dict["id"], event_type)

    if notify_org and org_id and notification_title:
        notifs = await notification_service.create_notifications_for_org(
            org_id=org_id,
            device_event_id=event_dict["id"],
            title=notification_title,
            body=notification_body or f"{event_type} event on device {serial_number}",
            pool=pool,
        )
        logger.info(
            "✅ %d org notifications created for device event %s",
            len(notifs), event_dict["id"],
        )

    return event_dict
