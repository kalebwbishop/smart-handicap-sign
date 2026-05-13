"""Tests for app.utils.claim — claim ID generation, hashing, and verification."""

import re

import pytest

from app.utils.claim import (
    CLAIM_ALPHABET,
    generate_claim_id,
    generate_salt,
    hash_claim_id,
    normalize_claim_id,
    verify_claim_id,
)

# ── generation ───────────────────────────────────────────────────────


class TestGenerateClaimId:
    """Tests for generate_claim_id()."""

    def test_generate_claim_id_format(self):
        """Claim ID matches the XXXX-XXXX pattern."""
        cid = generate_claim_id()
        assert re.fullmatch(r"[A-Z0-9]{4}-[A-Z0-9]{4}", cid), f"unexpected format: {cid}"

    def test_generate_claim_id_uses_valid_alphabet(self):
        """Every character in the claim ID belongs to CLAIM_ALPHABET."""
        for _ in range(20):
            cid = generate_claim_id()
            for ch in cid.replace("-", ""):
                assert ch in CLAIM_ALPHABET, f"{ch!r} not in CLAIM_ALPHABET"

    def test_generate_claim_id_uniqueness(self):
        """100 generated claim IDs should all be distinct."""
        ids = {generate_claim_id() for _ in range(100)}
        assert len(ids) == 100


# ── salt ─────────────────────────────────────────────────────────────


class TestGenerateSalt:
    """Tests for generate_salt()."""

    def test_generate_salt_format(self):
        """Salt is a 32-character lowercase hex string."""
        salt = generate_salt()
        assert len(salt) == 32
        assert re.fullmatch(r"[0-9a-f]{32}", salt), f"unexpected salt format: {salt}"

    def test_generate_salt_uniqueness(self):
        """Each salt is unique."""
        salts = {generate_salt() for _ in range(50)}
        assert len(salts) == 50


# ── hashing ──────────────────────────────────────────────────────────


class TestHashClaimId:
    """Tests for hash_claim_id()."""

    def test_hash_claim_id_deterministic(self):
        """Same claim ID + salt always produces the same hash."""
        cid = generate_claim_id()
        salt = generate_salt()
        h1 = hash_claim_id(cid, salt)
        h2 = hash_claim_id(cid, salt)
        assert h1 == h2

    def test_hash_claim_id_different_salts_differ(self):
        """Different salts produce different hashes for the same claim ID."""
        cid = generate_claim_id()
        s1 = generate_salt()
        s2 = generate_salt()
        assert hash_claim_id(cid, s1) != hash_claim_id(cid, s2)

    def test_hash_is_hex_sha256(self):
        """Hash output is a 64-character hex string (SHA-256)."""
        h = hash_claim_id("ABCD-EFGH", "aa" * 16)
        assert len(h) == 64
        assert re.fullmatch(r"[0-9a-f]{64}", h)


# ── verification ─────────────────────────────────────────────────────


class TestVerifyClaimId:
    """Tests for verify_claim_id()."""

    def test_verify_claim_id_correct(self):
        """Verification succeeds when the claim ID matches."""
        cid = generate_claim_id()
        salt = generate_salt()
        stored_hash = hash_claim_id(cid, salt)
        assert verify_claim_id(cid, stored_hash, salt) is True

    def test_verify_claim_id_incorrect(self):
        """Verification fails when the claim ID does not match."""
        cid = generate_claim_id()
        salt = generate_salt()
        stored_hash = hash_claim_id(cid, salt)
        assert verify_claim_id("ZZZZ-ZZZZ", stored_hash, salt) is False

    def test_verify_claim_id_case_insensitive(self):
        """Verification is case-insensitive (lowercase input matches uppercase)."""
        cid = generate_claim_id()
        salt = generate_salt()
        stored_hash = hash_claim_id(cid, salt)
        assert verify_claim_id(cid.lower(), stored_hash, salt) is True


# ── normalization ────────────────────────────────────────────────────


class TestNormalizeClaimId:
    """Tests for normalize_claim_id()."""

    def test_normalize_strips_hyphens_uppercases(self):
        """Normalization removes hyphens and uppercases all letters."""
        assert normalize_claim_id("ab3d-ef7h") == "AB3DEF7H"

    def test_normalize_idempotent(self):
        """Normalizing an already-normalized ID is a no-op."""
        assert normalize_claim_id("AB3DEF7H") == "AB3DEF7H"

    def test_normalize_multiple_hyphens(self):
        """Extra hyphens are stripped."""
        assert normalize_claim_id("a-b-c-d") == "ABCD"
