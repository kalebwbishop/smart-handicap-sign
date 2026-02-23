import time
import ujson

try:
    import urequests as requests
except ImportError:
    raise RuntimeError("urequests not found. Install urequests for MicroPython.")

from wifi_utils import scan_wifi, wifi_connect
from sensor import Photoresistor, device_id

# =====================
# USER CONFIG
# =====================
WIFI_SSID = "222 Potomac WiFi"
WIFI_PASS = "Everhart12052026"

ENDPOINT_URL = "https://0lg8kplt-8000.use.devtunnels.ms/api/v1/inference/classify"

ADC_PIN = 34
SAMPLES_PER_BATCH = 512
SAMPLE_INTERVAL_MS = 25
SEND_INTERVAL_MS = 1000


def post_batch(samples, adc_pin: int):
    payload = {
        "device_id": device_id(),
        "ts_ms": time.ticks_ms(),
        "adc_pin": adc_pin,
        "samples": samples,
    }
    headers = {"Content-Type": "application/json"}

    print("POSTing batch (samples:", len(samples), ")")
    resp = None
    try:
        resp = requests.post(ENDPOINT_URL, data=ujson.dumps(payload), headers=headers)
        return resp.status_code, resp.text
    finally:
        if resp is not None:
            resp.close()


def main():
    # Optional: scan first
    scan_wifi()

    print("Connecting Wi-Fi...")
    wlan = wifi_connect(WIFI_SSID, WIFI_PASS)
    print("Wi-Fi connected:", wlan.ifconfig())

    sensor = Photoresistor(ADC_PIN)

    while True:
        samples = []
        for _ in range(SAMPLES_PER_BATCH):
            samples.append(sensor.read_raw())
            time.sleep_ms(SAMPLE_INTERVAL_MS)

        try:
            status, body = post_batch(samples, ADC_PIN)
            print("POST status:", status)
            print("resp:", body[:200])
        except Exception as e:
            print("POST failed:", repr(e))
            # try reconnect
            try:
                wifi_connect(WIFI_SSID, WIFI_PASS)
            except Exception as e2:
                print("Wi-Fi reconnect failed:", repr(e2))

        time.sleep_ms(SEND_INTERVAL_MS)


main()
