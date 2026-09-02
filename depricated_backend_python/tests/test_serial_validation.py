"""Tests for app.utils.serial — serial number validation, parsing, and generation."""

import pytest

from app.utils.serial import (
    SERIAL_ALPHABET,
    compute_check_character,
    generate_serial_number,
    parse_serial_number,
    validate_serial_number,
)


# ── validation ───────────────────────────────────────────────────────


class TestValidateSerialNumber:
    """Tests for validate_serial_number()."""

    def test_valid_serial_passes(self):
        """A correctly formed serial with valid check character passes."""
        serial = generate_serial_number(26, 5, "S01", "A7K", 482)
        assert validate_serial_number(serial) is True

    def test_invalid_prefix_fails(self):
        """A serial that does not start with 'SHS-' is rejected."""
        assert validate_serial_number("XXX-2605-S01-A7K-00482-R") is False

    def test_invalid_yymm_month_13_fails(self):
        """Month 13 is out of range and must fail."""
        # Build a structurally valid string but with month=13
        base = "SHS-2613-S01-A7K-00001"
        check = compute_check_character(base)
        assert validate_serial_number(f"{base}-{check}") is False

    def test_invalid_yymm_month_00_fails(self):
        """Month 00 is out of range and must fail."""
        base = "SHS-2600-S01-A7K-00001"
        check = compute_check_character(base)
        assert validate_serial_number(f"{base}-{check}") is False

    def test_invalid_check_character_fails(self):
        """A serial with the wrong check character is rejected."""
        serial = generate_serial_number(26, 5, "S01", "A7K", 482)
        # Swap the last character to something else
        wrong_char = "A" if serial[-1] != "A" else "B"
        tampered = serial[:-1] + wrong_char
        assert validate_serial_number(tampered) is False

    def test_empty_string_fails(self):
        """An empty string is rejected."""
        assert validate_serial_number("") is False

    def test_lowercase_fails(self):
        """Lowercase letters are not accepted (regex is uppercase only)."""
        serial = generate_serial_number(26, 5, "S01", "A7K", 482)
        assert validate_serial_number(serial.lower()) is False


# ── parsing ──────────────────────────────────────────────────────────


class TestParseSerialNumber:
    """Tests for parse_serial_number()."""

    def test_parse_returns_components(self):
        """Parsing a valid serial returns all expected component keys."""
        serial = generate_serial_number(26, 5, "S01", "A7K", 482)
        result = parse_serial_number(serial)

        assert result is not None
        assert result["prefix"] == "SHS"
        assert result["year_month"] == "2605"
        assert result["model_code"] == "S01"
        assert result["batch_code"] == "A7K"
        assert result["sequence"] == "00482"
        assert result["manufacture_year"] == 26
        assert result["manufacture_month"] == 5
        assert result["check_char"] in SERIAL_ALPHABET

    def test_parse_invalid_returns_none(self):
        """Parsing an invalid serial returns None."""
        assert parse_serial_number("NOT-A-SERIAL") is None

    def test_parse_tampered_serial_returns_none(self):
        """A structurally valid but tampered serial returns None."""
        serial = generate_serial_number(26, 5, "S01", "A7K", 482)
        tampered = serial[:-1] + ("A" if serial[-1] != "A" else "B")
        assert parse_serial_number(tampered) is None


# ── generation ───────────────────────────────────────────────────────


class TestGenerateSerialNumber:
    """Tests for generate_serial_number()."""

    def test_generate_serial_number(self):
        """Generated serial has the correct format and passes validation."""
        serial = generate_serial_number(26, 5, "S01", "A7K", 482)
        assert serial.startswith("SHS-")
        assert validate_serial_number(serial) is True

    def test_generate_rejects_bad_month(self):
        """Month outside 1-12 raises ValueError."""
        with pytest.raises(ValueError, match="month"):
            generate_serial_number(26, 0, "S01", "A7K", 1)
        with pytest.raises(ValueError, match="month"):
            generate_serial_number(26, 13, "S01", "A7K", 1)

    def test_generate_rejects_bad_year(self):
        """Year outside 20-99 raises ValueError."""
        with pytest.raises(ValueError, match="year"):
            generate_serial_number(19, 1, "S01", "A7K", 1)

    def test_generate_rejects_bad_sequence(self):
        """Sequence outside 0-99999 raises ValueError."""
        with pytest.raises(ValueError, match="sequence"):
            generate_serial_number(26, 5, "S01", "A7K", 100000)

    def test_generate_rejects_bad_model_code(self):
        """Model code that isn't 3 alphanumeric chars raises ValueError."""
        with pytest.raises(ValueError, match="model_code"):
            generate_serial_number(26, 5, "AB", "A7K", 1)

    def test_generate_rejects_bad_batch_code(self):
        """Batch code that isn't 3 alphanumeric chars raises ValueError."""
        with pytest.raises(ValueError, match="batch_code"):
            generate_serial_number(26, 5, "S01", "toolong", 1)

    def test_sequence_zero_padding(self):
        """Sequence 0 is zero-padded to 5 digits."""
        serial = generate_serial_number(26, 1, "S01", "A7K", 0)
        assert "-00000-" in serial

    def test_generate_boundary_values(self):
        """Boundary values for all parameters are accepted."""
        assert validate_serial_number(generate_serial_number(20, 1, "A00", "Z99", 0))
        assert validate_serial_number(generate_serial_number(99, 12, "Z99", "A00", 99999))


# ── roundtrip ────────────────────────────────────────────────────────


class TestRoundtrip:
    """End-to-end: generate → validate → parse."""

    def test_roundtrip(self):
        """A generated serial validates and parses back to original components."""
        serial = generate_serial_number(30, 11, "X2Z", "B4C", 12345)

        assert validate_serial_number(serial) is True

        parts = parse_serial_number(serial)
        assert parts is not None
        assert parts["manufacture_year"] == 30
        assert parts["manufacture_month"] == 11
        assert parts["model_code"] == "X2Z"
        assert parts["batch_code"] == "B4C"
        assert parts["sequence"] == "12345"
