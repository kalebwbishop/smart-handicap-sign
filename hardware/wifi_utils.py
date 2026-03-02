import time
import network
import usocket
import ujson
import machine

from sensor import device_id
from config import save_config


# ───────────────────────────────────────────
# Station helpers (existing)
# ───────────────────────────────────────────

def scan_wifi():
    """Scan for visible networks. Returns list of dicts."""
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    print("Scanning for Wi-Fi networks...\n")
    networks = wlan.scan()

    if not networks:
        print("No networks found.")
        return []

    results = []
    seen = set()
    for net in networks:
        ssid = net[0].decode("utf-8")
        if not ssid or ssid in seen:
            continue
        seen.add(ssid)

        rssi = net[3]
        authmode = net[4]

        results.append(
            {
                "ssid": ssid,
                "rssi": rssi,
                "authmode": authmode,
            }
        )

    # Sort by signal strength (strongest first)
    results.sort(key=lambda r: r["rssi"], reverse=True)
    return results


def wifi_connect(ssid: str, password: str, timeout_s: int = 20) -> network.WLAN:
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    if wlan.isconnected():
        return wlan

    wlan.connect(ssid, password)

    start = time.time()
    while not wlan.isconnected():
        if time.time() - start > timeout_s:
            raise RuntimeError("Wi-Fi connect timed out")
        time.sleep(0.25)

    return wlan


# ───────────────────────────────────────────
# Access-Point mode + provisioning server
# ───────────────────────────────────────────

def start_ap(essid=None):
    """Activate the ESP32 as a Wi-Fi access point (open network)."""
    # Disable station so it doesn't interfere
    sta = network.WLAN(network.STA_IF)
    sta.active(False)

    ap = network.WLAN(network.AP_IF)
    ap.active(True)

    if essid is None:
        short_id = device_id()[-4:].upper()
        essid = "SmartSign-{}".format(short_id)

    ap.config(essid=essid, authmode=network.AUTH_OPEN)

    # Wait until AP is active
    while not ap.active():
        time.sleep(0.1)

    print("[AP] Access point '{}' active".format(essid))
    print("[AP] IP config:", ap.ifconfig())
    return ap


def stop_ap():
    ap = network.WLAN(network.AP_IF)
    ap.active(False)


# ───────────────────────────────────────────
# Minimal HTTP helpers
# ───────────────────────────────────────────

_CORS_HEADERS = (
    "Access-Control-Allow-Origin: *\r\n"
    "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
    "Access-Control-Allow-Headers: Content-Type\r\n"
)


def _parse_request(client):
    """Read an HTTP request from a socket. Returns (method, path, body)."""
    data = b""
    client.settimeout(5)
    try:
        while b"\r\n\r\n" not in data:
            chunk = client.recv(1024)
            if not chunk:
                break
            data += chunk
    except OSError:
        pass

    head, _, body_start = data.partition(b"\r\n\r\n")
    head_str = head.decode("utf-8")
    lines = head_str.split("\r\n")
    request_line = lines[0] if lines else ""
    parts = request_line.split(" ")
    method = parts[0] if len(parts) >= 1 else ""
    path = parts[1] if len(parts) >= 2 else "/"

    # Read remaining body if Content-Length present
    content_length = 0
    for line in lines[1:]:
        if line.lower().startswith("content-length:"):
            content_length = int(line.split(":")[1].strip())
            break

    body = body_start
    while len(body) < content_length:
        try:
            chunk = client.recv(1024)
            if not chunk:
                break
            body += chunk
        except OSError:
            break

    return method, path, body.decode("utf-8") if body else ""


def _send_response(client, status_code, body_dict):
    """Send a JSON HTTP response."""
    body = ujson.dumps(body_dict)
    status_text = {200: "OK", 400: "Bad Request", 404: "Not Found", 204: "No Content"}.get(
        status_code, "OK"
    )
    resp = (
        "HTTP/1.1 {} {}\r\n"
        "Content-Type: application/json\r\n"
        "{}"
        "Content-Length: {}\r\n"
        "Connection: close\r\n"
        "\r\n"
        "{}"
    ).format(status_code, status_text, _CORS_HEADERS, len(body), body)
    client.sendall(resp.encode("utf-8"))


def _send_cors_preflight(client):
    resp = (
        "HTTP/1.1 204 No Content\r\n"
        "{}"
        "Content-Length: 0\r\n"
        "Connection: close\r\n"
        "\r\n"
    ).format(_CORS_HEADERS)
    client.sendall(resp.encode("utf-8"))


# ───────────────────────────────────────────
# Provisioning HTTP server
# ───────────────────────────────────────────

def run_provisioning_server():
    """
    Blocking HTTP server on port 80.
    Endpoints:
        GET  /status    → {\"device_id\": ..., \"ap_active\": true}
        GET  /scan      → [{\"ssid\": ..., \"rssi\": ..., \"authmode\": ...}, ...]
        POST /configure → expects {\"ssid\": ..., \"password\": ...}
    After a successful /configure the device saves creds and reboots.
    """
    addr = usocket.getaddrinfo("0.0.0.0", 80)[0][-1]
    srv = usocket.socket(usocket.AF_INET, usocket.SOCK_STREAM)
    srv.setsockopt(usocket.SOL_SOCKET, usocket.SO_REUSEADDR, 1)
    srv.bind(addr)
    srv.listen(3)
    print("[Provisioning] HTTP server listening on :80")

    while True:
        client, remote = srv.accept()
        try:
            method, path, body = _parse_request(client)
            print("[Provisioning] {} {} from {}".format(method, path, remote))

            # CORS preflight
            if method == "OPTIONS":
                _send_cors_preflight(client)
                continue

            if path == "/status" and method == "GET":
                _send_response(client, 200, {"device_id": device_id(), "ap_active": True})

            elif path == "/scan" and method == "GET":
                # Temporarily enable STA to scan, then disable
                sta = network.WLAN(network.STA_IF)
                sta.active(True)
                time.sleep(0.5)
                networks = scan_wifi()
                sta.active(False)
                _send_response(client, 200, networks)

            elif path == "/configure" and method == "POST":
                try:
                    cfg = ujson.loads(body)
                except (ValueError, TypeError):
                    _send_response(client, 400, {"error": "Invalid JSON"})
                    continue

                ssid = cfg.get("ssid", "")
                password = cfg.get("password", "")
                if not ssid:
                    _send_response(client, 400, {"error": "ssid is required"})
                    continue

                # Save and respond before rebooting
                save_config(ssid, password)
                _send_response(client, 200, {"ok": True, "message": "Credentials saved. Rebooting..."})
                client.close()
                time.sleep(1)
                machine.reset()

            else:
                _send_response(client, 404, {"error": "Not found"})

        except Exception as e:
            print("[Provisioning] Error:", repr(e))
        finally:
            try:
                client.close()
            except Exception:
                pass
