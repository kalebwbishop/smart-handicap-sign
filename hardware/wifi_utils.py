import time
import network


def scan_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)

    print("Scanning for Wi-Fi networks...\n")
    networks = wlan.scan()

    if not networks:
        print("No networks found.")
        return []

    results = []
    for net in networks:
        ssid = net[0].decode("utf-8")
        bssid = ":".join("{:02x}".format(b) for b in net[1])
        channel = net[2]
        rssi = net[3]
        authmode = net[4]
        hidden = net[5]

        print("SSID:", ssid)
        print("  BSSID:", bssid)
        print("  Channel:", channel)
        print("  Signal (RSSI):", rssi, "dBm")
        print("  Authmode:", authmode)
        print("  Hidden:", bool(hidden))
        print("-" * 40)

        results.append(
            {
                "ssid": ssid,
                "bssid": bssid,
                "channel": channel,
                "rssi": rssi,
                "authmode": authmode,
                "hidden": bool(hidden),
            }
        )

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
