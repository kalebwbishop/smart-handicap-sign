"""Validation, parsing, and generation of SHS device serial numbers.

Serial number format: SHS-YYMM-MDL-BBB-SSSSS-C

    SHS     – fixed product prefix
    YYMM    – manufacture year (20-99) and month (01-12)
    MDL     – 3-character alphanumeric model code
    BBB     – 3-character alphanumeric batch/lot code
    SSSSS   – 5-digit zero-padded unit sequence number
    C       – single check character from SERIAL_ALPHABET

Example: SHS-2605-S01-A7K-00482-R
"""

from __future__ import annotations

import re

SERIAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

_SERIAL_RE = re.compile(
    r"^SHS-(\d{4})-([A-Z0-9]{3})-([A-Z0-9]{3})-(\d{5})-([A-Z0-9])$"
)


def compute_check_character(serial_without_check: str) -> str:
    """Compute the check character for a serial number.

    Args:
        serial_without_check: Everything before the final ``-C`` segment,
            e.g. ``"SHS-2605-S01-A7K-00482"``.

    Returns:
        A single character from :data:`SERIAL_ALPHABET`.
    """
    weighted_sum = sum(
        ord(ch) * (i + 1) for i, ch in enumerate(serial_without_check)
    )
    return SERIAL_ALPHABET[weighted_sum % len(SERIAL_ALPHABET)]


def validate_serial_number(serial: str) -> bool:
    """Validate a complete serial number string.

    Checks performed:

    1. Matches the structural regex pattern.
    2. YYMM encodes a valid year (20–99) and month (01–12).
    3. Check character is correct.

    Returns:
        ``True`` if valid, ``False`` otherwise.
    """
    match = _SERIAL_RE.match(serial)
    if not match:
        return False

    yymm = match.group(1)
    year = int(yymm[:2])
    month = int(yymm[2:])
    if year < 20 or year > 99 or month < 1 or month > 12:
        return False

    serial_without_check = serial.rsplit("-", 1)[0]
    expected = compute_check_character(serial_without_check)
    return match.group(5) == expected


def parse_serial_number(serial: str) -> dict | None:
    """Parse a valid serial number into its component parts.

    Args:
        serial: A full serial number string, e.g. ``"SHS-2605-S01-A7K-00482-R"``.

    Returns:
        A dict with keys ``prefix``, ``year_month``, ``model_code``,
        ``batch_code``, ``sequence``, ``check_char``, ``manufacture_year``
        (int), and ``manufacture_month`` (int).  Returns ``None`` if the
        serial is invalid.
    """
    if not validate_serial_number(serial):
        return None

    match = _SERIAL_RE.match(serial)
    assert match is not None  # guaranteed by validate_serial_number

    yymm = match.group(1)
    return {
        "prefix": "SHS",
        "year_month": yymm,
        "model_code": match.group(2),
        "batch_code": match.group(3),
        "sequence": match.group(4),
        "check_char": match.group(5),
        "manufacture_year": int(yymm[:2]),
        "manufacture_month": int(yymm[2:]),
    }


def generate_serial_number(
    year: int,
    month: int,
    model_code: str,
    batch_code: str,
    sequence: int,
) -> str:
    """Generate a complete serial number with a computed check character.

    Args:
        year: 2-digit manufacture year (20–99).
        month: Manufacture month (1–12).
        model_code: 3-character alphanumeric model code.
        batch_code: 3-character alphanumeric batch/lot code.
        sequence: Unit sequence number (0–99999).

    Returns:
        A fully-formed serial number string.

    Raises:
        ValueError: If any argument is out of range or malformed.
    """
    if not (20 <= year <= 99):
        raise ValueError(f"year must be 20-99, got {year}")
    if not (1 <= month <= 12):
        raise ValueError(f"month must be 1-12, got {month}")
    if not re.fullmatch(r"[A-Z0-9]{3}", model_code):
        raise ValueError(f"model_code must be 3 alphanumeric chars, got {model_code!r}")
    if not re.fullmatch(r"[A-Z0-9]{3}", batch_code):
        raise ValueError(f"batch_code must be 3 alphanumeric chars, got {batch_code!r}")
    if not (0 <= sequence <= 99999):
        raise ValueError(f"sequence must be 0-99999, got {sequence}")

    base = f"SHS-{year:02d}{month:02d}-{model_code}-{batch_code}-{sequence:05d}"
    check = compute_check_character(base)
    return f"{base}-{check}"
