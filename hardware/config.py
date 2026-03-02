"""
Persistent WiFi credential storage on ESP32 flash.
Stores credentials as JSON in /wifi_config.json.
"""

import ujson
import os


CONFIG_PATH = "/wifi_config.json"


def load_config():
    """Load saved WiFi credentials. Returns dict with 'ssid' and 'password', or None."""
    try:
        with open(CONFIG_PATH, "r") as f:
            cfg = ujson.load(f)
        if cfg.get("ssid"):
            return cfg
    except (OSError, ValueError):
        pass
    return None


def save_config(ssid, password):
    """Persist WiFi credentials to flash."""
    with open(CONFIG_PATH, "w") as f:
        ujson.dump({"ssid": ssid, "password": password}, f)
    print("[config] Saved WiFi credentials for:", ssid)


def clear_config():
    """Delete saved credentials (factory-reset)."""
    try:
        os.remove(CONFIG_PATH)
        print("[config] Cleared WiFi credentials")
    except OSError:
        pass
