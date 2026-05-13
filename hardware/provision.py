"""
Manufacturing provisioning script.

Run this ONCE per device during manufacturing to write the serial number
to the ESP32's flash filesystem. After this, the device will identify
itself to the backend using this serial number.

Usage (from device REPL or during factory flash):
    import provision
    provision.set_serial("SHS-2605-S01-A7K-00003-W")
"""

from identity import save_identity, load_identity


def set_serial(serial_number):
    """Provision device with its serial number."""
    # Basic format check
    if not serial_number.startswith("SHS-"):
        raise ValueError("Invalid serial format — must start with SHS-")

    parts = serial_number.split("-")
    if len(parts) != 6:
        raise ValueError("Invalid serial format — expected 6 segments (SHS-YYMM-MDL-BBB-SSSSS-C)")

    existing = load_identity()
    if existing:
        print("WARNING: Device already provisioned as:", existing["serial_number"])
        print("Overwriting with new serial:", serial_number)

    save_identity(serial_number)
    print("Device provisioned successfully!")
    print("Serial number:", serial_number)
    print("Reboot device to apply.")


def show():
    """Display current device identity."""
    identity = load_identity()
    if identity:
        print("Serial number:", identity["serial_number"])
    else:
        print("Device NOT provisioned — no identity found.")
