"""
Device identity management for Smart Handicap Sign.

The serial number is written to /device_identity.json during manufacturing.
The firmware reads it at boot to identify itself to the backend.

Manufacturing provisioning tool writes:
  {"serial_number": "SHS-2605-S01-A7K-00003-W"}
"""

import ujson
import os


IDENTITY_PATH = "/device_identity.json"


def load_identity():
    """Load device identity from flash. Returns dict with 'serial_number', or None."""
    try:
        with open(IDENTITY_PATH, "r") as f:
            identity = ujson.load(f)
        if identity.get("serial_number"):
            return identity
    except (OSError, ValueError):
        pass
    return None


def save_identity(serial_number):
    """Write device identity to flash (used during manufacturing provisioning)."""
    with open(IDENTITY_PATH, "w") as f:
        ujson.dump({"serial_number": serial_number}, f)
    print("[identity] Saved serial number:", serial_number)


def get_serial_number():
    """Get serial number or raise if not provisioned."""
    identity = load_identity()
    if identity is None:
        raise RuntimeError("Device not provisioned — no serial number in flash")
    return identity["serial_number"]
