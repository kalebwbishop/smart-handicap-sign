# Firmware Hardware Test Plan

## Scope
This plan validates the ESP-IDF firmware integration on real ESP32 hardware when local flashing is available.

## Pre-flash Checklist
1. Verify ESP-IDF toolchain version matches project requirements and `idf.py --version` succeeds.
2. Confirm target is the expected ESP32 board and USB serial port is stable.
3. Review `firmware\partitions.csv` and confirm dual OTA slots plus `otadata` fit the target flash size.
4. Confirm `firmware\version.txt` matches the intended release version.
5. Set the backend URL build cache value (`HAZARD_HERO_BACKEND_URL`) to the correct environment endpoint.
6. Verify `server_certs\ca_cert.pem` matches the backend certificate chain.
7. Erase or inspect flash intentionally; do not reuse stale credentials or OTA metadata by accident.
8. Record baseline free heap immediately after boot for comparison.

## Basic Functionality Tests

### 1. Boot and LED Patterns
- Flash the device and reboot.
- Expected: boot logs show NVS init, OTA init, WiFi manager init, ADC init, HTTPS client init.
- Expected: LED enters `available` pattern after initialization.
- Force each backend status (`available`, `assistance_requested`, `assistance_in_progress`, `offline`, `error`) and verify LED pattern matches the design.

### 2. Saved WiFi Connect
- Preload valid credentials in NVS.
- Reboot the board.
- Expected: station connects without entering AP mode.
- Expected: status polling begins within a few seconds of boot.

### 3. AP Provisioning Mode
- Clear WiFi credentials from NVS and reboot.
- Expected: device starts SoftAP with `SmartSign-XXXX` SSID.
- Query `http://192.168.4.1/status` and verify `ap_active=true`.
- Query `http://192.168.4.1/scan` and verify nearby SSIDs are returned and sorted reasonably.
- POST valid credentials to `/configure` and confirm the board reboots.
- Expected after reboot: station connects successfully using saved credentials.

### 4. Identity Recovery
- Erase NVS, then boot.
- Expected: firmware regenerates a serial number from the MAC address instead of halting.
- Confirm the regenerated identity is persisted to NVS for subsequent boots.

## Integration Tests

### 1. Status Polling
- With backend reachable, observe repeated `GET /devices/{serial}/status` calls.
- Expected: Authorization header is present.
- Expected: unexpected HTTP responses do not crash the device and trigger reconnect handling when needed.

### 2. ADC Sampling and Classification
- Put the backend into `available` status.
- Capture logs before and after `adc_sampler_collect_batch()`.
- Expected: 512 samples are collected successfully and `POST /inference/classify` returns a parsed label/confidence.
- Expected: ADC read failures are logged and the firmware remains responsive.

### 3. LED + Backend State Integration
- Simulate backend transitions through all supported statuses.
- Expected: polled status string maps to the correct LED pattern every time.
- Expected: unknown status strings fall back to `offline` behavior without crashing.

### 4. WiFi Drop During HTTPS Request
- Disconnect the AP or jam the network during status poll and classify requests.
- Expected: HTTPS request fails cleanly, error is logged, and reconnect logic retries.
- Expected: after reconnect, the device waits for network stabilization and resumes polling.

## Memory Profiling Procedure
1. Add temporary log points using `heap_caps_get_free_size(MALLOC_CAP_8BIT)` at these stages:
   - boot start
   - after NVS + LED init
   - after WiFi connect
   - after HTTPS client init
   - after one status poll
   - after one classify request
2. Record both free heap and largest free block when possible.
3. Repeat while AP provisioning is active and while STA mode is active.
4. Compare repeated classify cycles for memory drift.
5. Target: **more than 150 KB free heap after WiFi + HTTPS initialization**.

## Stress Test Procedure (24h)
1. Run the board for 24 hours against a stable backend.
2. Keep periodic status polling active the entire time.
3. Inject repeated classify cycles at normal cadence.
4. Force at least three WiFi outages during the run.
5. Record heap snapshots every hour.
6. Expected: no watchdog reset, no reboot loop, no steadily decreasing heap, and successful recovery after each outage.

## OTA Test Procedure
1. Flash a known-good base image in `ota_0`.
2. Publish a newer signed firmware image to the OTA server.
3. Trigger OTA manually or through the planned update path.
4. Reboot into the new slot.
5. Before first connectivity, verify the image remains pending verification.
6. After the first successful backend connectivity check, verify `ota_mark_valid()` is called and rollback is cancelled.
7. Negative test: block backend connectivity after OTA boot and confirm rollback behavior matches policy.

## Failure Injection Checks
- Corrupt or erase NVS and verify the device either reprovisions WiFi or regenerates identity safely.
- Return malformed JSON from the backend and verify parse errors are logged without memory leaks or crashes.
- Force ADC read errors and verify the device enters error indication but continues running.
- Return non-200 responses from status and classify endpoints and verify logs plus retry behavior.

## Expected Memory Budget
- Boot + core services: leave ample margin for WiFi startup.
- After WiFi STA connect + HTTPS client init: **>150 KB free heap target**.
- During classify request assembly and response parsing: no sustained downward trend after repeated cycles.
- During AP provisioning: enough headroom to serve `/status`, `/scan`, and `/configure` without allocation failures.
