"""Generation, hashing, and verification of one-time-use claim IDs for device registration.

Claim IDs are 8-character codes in the format XXXX-XXXX drawn from an
unambiguous 32-character alphabet (no 0/O, 1/I/L).  Each claim is salted
and hashed with SHA-256 before storage so the plain-text ID is never
persisted.
"""

import hashlib
import hmac
import secrets

# 32-character alphabet that avoids visually ambiguous characters (0/O, 1/I/L).
CLAIM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

_CLAIM_RAW_LENGTH = 8  # total characters (excluding hyphen)
_GROUP_SIZE = 4


def generate_claim_id() -> str:
    """Generate a random claim ID in the format ``XXXX-XXXX``.

    Uses :func:`secrets.choice` for cryptographically secure selection
    from :data:`CLAIM_ALPHABET`.

    Returns:
        A string like ``"9Q7M-2KD8"``.
    """
    raw = "".join(secrets.choice(CLAIM_ALPHABET) for _ in range(_CLAIM_RAW_LENGTH))
    return f"{raw[:_GROUP_SIZE]}-{raw[_GROUP_SIZE:]}"


def generate_salt() -> str:
    """Generate a random 16-byte salt as a 32-character hex string.

    Each device must receive its own unique salt.

    Returns:
        A 32-character lowercase hex string.
    """
    return secrets.token_hex(16)


def normalize_claim_id(claim_id: str) -> str:
    """Normalize a claim ID: uppercase and remove hyphens.

    This ensures verification is case-insensitive and tolerant of
    formatting differences.

    Args:
        claim_id: The raw claim ID (e.g. ``"9q7m-2kd8"``).

    Returns:
        The normalized form (e.g. ``"9Q7M2KD8"``).
    """
    return claim_id.upper().replace("-", "")


def hash_claim_id(claim_id: str, salt: str) -> str:
    """Hash a claim ID with the given salt using SHA-256.

    The claim ID is first normalized (uppercased, hyphens stripped) so
    that hashing is case-insensitive.

    The digest is computed as ``SHA-256(salt_bytes + normalized_claim_bytes)``.

    Args:
        claim_id: The plain-text claim ID.
        salt: A hex-encoded salt string (see :func:`generate_salt`).

    Returns:
        The hex digest of the resulting SHA-256 hash.
    """
    normalized = normalize_claim_id(claim_id)
    salt_bytes = bytes.fromhex(salt)
    return hashlib.sha256(salt_bytes + normalized.encode()).hexdigest()


def verify_claim_id(claim_id: str, stored_hash: str, salt: str) -> bool:
    """Verify a claim ID against a stored hash and salt.

    Uses :func:`hmac.compare_digest` for constant-time comparison to
    prevent timing attacks.

    Args:
        claim_id: The plain-text claim ID to check.
        stored_hash: The previously stored hex digest.
        salt: The hex-encoded salt that was used when the hash was created.

    Returns:
        ``True`` if the claim ID matches, ``False`` otherwise.
    """
    candidate_hash = hash_claim_id(claim_id, salt)
    return hmac.compare_digest(candidate_hash, stored_hash)
