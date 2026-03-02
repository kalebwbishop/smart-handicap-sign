import time
import ujson
import gc
import machine

try:
    import urequests as requests
except ImportError:
    raise RuntimeError("urequests not found. Install urequests for MicroPython.")

from wifi_utils import scan_wifi, wifi_connect, start_ap, run_provisioning_server
from sensor import Photoresistor, device_id
from config import load_config, save_config
from led import StatusLED

# =====================
# CONFIG
# =====================
BASE_URL = "https://q23tr5nf-8000.usw3.devtunnels.ms/api/v1"
CLASSIFY_URL = BASE_URL + "/inference/classify"
SIGN_ID = "7f997a0d-9e97-4413-946d-224b67c164b5"
STATUS_URL = BASE_URL + "/signs/" + SIGN_ID + "/status"

ADC_PIN = 34
SAMPLES_PER_BATCH = 512
SAMPLE_INTERVAL_MS = 25
SEND_INTERVAL_MS = 1000
STATUS_POLL_INTERVAL_MS = 3000

MAX_RECONNECT_FAILURES = 3
MAX_STATUS_RETRIES = 3
STATUS_RETRY_DELAY_MS = 2000


def get_sign_status():
    """Fetch current sign status from the backend.

    Returns status string on success.
    Raises on network / server errors so the caller can handle reconnection.
    """
    resp = None
    try:
        resp = requests.get(STATUS_URL)
        if resp.status_code == 200:
            data = ujson.loads(resp.text)
            return data.get("status")
        raise RuntimeError("HTTP %d" % resp.status_code)
    finally:
        if resp is not None:
            resp.close()


def post_batch(samples, adc_pin: int):
    payload = {
        "sign_id": SIGN_ID,
        "device_id": device_id(),
        "ts_ms": time.ticks_ms(),
        "adc_pin": adc_pin,
        "samples": samples,
    }
    headers = {"Content-Type": "application/json"}

    print("POSTing batch (samples:", len(samples), ")")
    resp = None
    try:
        resp = requests.post(CLASSIFY_URL, data=ujson.dumps(payload), headers=headers)
        return resp.status_code, resp.text
    finally:
        if resp is not None:
            resp.close()


def main():
    cfg = load_config()

    if cfg is None:
        # ── No saved credentials → enter AP provisioning mode ──
        print("No WiFi credentials found. Starting provisioning AP...")
        start_ap()
        run_provisioning_server()  # blocks until /configure saves creds and reboots
        return  # unreachable (device resets), but keeps linter happy

    wifi_ssid = cfg["ssid"]
    wifi_pass = cfg["password"]

    # Optional: scan first
    # scan_wifi()

    print("Connecting Wi-Fi...")
    wlan = wifi_connect(wifi_ssid, wifi_pass)
    print("Wi-Fi connected:", wlan.ifconfig())

    # Give the network stack a moment to stabilise (DNS, DHCP lease, etc.)
    time.sleep(2)

    sensor = Photoresistor(ADC_PIN)
    status_led = StatusLED(pin=2)
    status_led.set_status("available")
    reconnect_failures = 0

    # Watchdog: resets the device if the loop stalls for >30 s
    wdt = machine.WDT(timeout=30000)

    while True:
        wdt.feed()
        gc.collect()
        # ── 1. Check sign status (with retries) ──────────────────
        sign_status = None
        for attempt in range(MAX_STATUS_RETRIES):
            try:
                sign_status = get_sign_status()
                reconnect_failures = 0  # server reachable
                break
            except Exception as e:
                print("Status check attempt %d failed: %s" % (attempt + 1, repr(e)))
                if attempt < MAX_STATUS_RETRIES - 1:
                    time.sleep_ms(STATUS_RETRY_DELAY_MS)

        if sign_status is None:
            # All retries exhausted — try Wi-Fi reconnect
            print("All status retries failed, reconnecting Wi-Fi...")
            status_led.set_status("error")
            try:
                wifi_connect(wifi_ssid, wifi_pass)
                time.sleep(2)
                reconnect_failures = 0
            except Exception as e2:
                print("Wi-Fi reconnect failed:", repr(e2))
                reconnect_failures += 1
                if reconnect_failures >= MAX_RECONNECT_FAILURES:
                    print("Too many reconnect failures. Entering AP provisioning mode...")
                    status_led.set_status("offline")
                    start_ap()
                    run_provisioning_server()
                    return
            time.sleep_ms(STATUS_POLL_INTERVAL_MS)
            continue

        # Status fetched successfully — update LED
        status_led.set_status(sign_status)
        print("Sign status:", sign_status)

        # ── 2. Only sample + classify when available ──────────────
        if sign_status != "available":
            print("Sign not available (%s), skipping classification" % sign_status)
            time.sleep_ms(STATUS_POLL_INTERVAL_MS)
            continue

        samples = []
        for _ in range(SAMPLES_PER_BATCH):
            samples.append(sensor.read_raw())
            time.sleep_ms(SAMPLE_INTERVAL_MS)

        try:
            http_status, body = post_batch(samples, ADC_PIN)
            print("POST status:", http_status)
            print("resp:", body[:200])
        except Exception as e:
            print("POST failed:", repr(e))
            status_led.set_status("error")

        time.sleep_ms(SEND_INTERVAL_MS)


try:
    main()
except Exception as e:
    print("FATAL:", repr(e))
    time.sleep(5)
    machine.reset()

