# Firmware Hardware Test Plan

This plan validates the **single pilot sign** on real ESP32 hardware.

## Pre-flash checklist

1. Verify ESP-IDF is installed and `idf.py --version` succeeds.
2. Confirm the expected ESP32 board and serial port.
3. Confirm `firmware\version.txt` matches the intended pilot build.
4. Set `HAZARD_HERO_BACKEND_URL` to the pilot backend.
5. Verify `server_certs\ca_cert.pem` matches the backend certificate chain.
6. Decide whether Wi-Fi credentials will be preloaded or entered through provisioning.
7. Record baseline free heap after boot if memory profiling is in scope.

## Basic functionality tests

### 1. Boot and LED patterns

- Flash the device and reboot.
- Expected: boot logs show NVS, Wi-Fi, ADC, and HTTPS client initialization.
- Expected: LED reaches the `available` pattern after successful startup.
- Force backend states (`available`, `assistance_requested`, `assistance_in_progress`, `offline`, `error`) and verify LED behavior.

### 2. Saved Wi-Fi connect

- Preload valid Wi-Fi credentials in NVS.
- Reboot the board.
- Expected: station connects without entering AP mode.
- Expected: status polling starts within a few seconds.

### 3. AP provisioning mode

- Clear Wi-Fi credentials from NVS and reboot.
- Expected: device starts SoftAP with `SmartSign-XXXX`.
- Query `http://192.168.4.1/status` and verify AP mode is active.
- Query `http://192.168.4.1/scan` and verify nearby networks are returned.
- POST `/configure` without `claim_id` or `setup_code`; expected: `400`, no Wi-Fi write.
- POST `/configure` with both `claim_id` and `setup_code`; expected: `400`, no Wi-Fi write.
- POST invalid setup data; expected: generic auth failure, no Wi-Fi write.
- POST valid Wi-Fi credentials plus exactly one valid verifier; expected: board reboots and joins Wi-Fi.

### 4. Identity readiness

- Verify the board has a valid auth token in NVS and a usable serial number.
- Expected: status polling works against the pilot backend.
- Expected: if the serial number is missing, firmware regenerates one from the MAC address and stores it.
- Expected: missing auth token blocks normal runtime until restored.

## Integration tests

### 1. Status polling

- With backend reachable, observe repeated `GET /devices/{serial}/status` calls.
- Expected: unexpected HTTP responses do not crash the device.
- Expected: reconnect handling runs when networking fails.

### 2. ADC sampling and classification

- Put the backend into `available`.
- Observe logs before and after `adc_sampler_collect_batch()`.
- Expected: 512 samples are collected and `POST /inference/classify` succeeds.
- Expected: ADC failures are logged and the device remains responsive.

### 3. LED and backend state integration

- Simulate backend transitions through supported statuses.
- Expected: each status maps to the intended LED pattern.
- Expected: unknown status strings fail closed without crashing.

### 4. Wi-Fi drop during HTTPS request

- Interrupt network access during status poll and classify requests.
- Expected: request fails cleanly, reconnect logic retries, and the device resumes after connectivity returns.

## Stress procedure

1. Run the board against a stable backend for 24 hours.
2. Keep status polling active throughout.
3. Trigger repeated classify cycles at normal cadence.
4. Force at least three Wi-Fi outages during the run.
5. Expected: no watchdog reset, no reboot loop, and successful recovery after each outage.

## Failure injection checks

- Corrupt or erase Wi-Fi credentials and verify the device enters provisioning mode.
- Return malformed JSON from the backend and verify parse errors do not crash the device.
- Force ADC read errors and verify the device signals error but keeps running.
- Return non-200 responses from status and classify endpoints and verify retry behavior.

## Pilot exit checks

Before launch, confirm:

- the sign can stay connected at the install location
- the sign only classifies when status is `available`
- a real visitor wave produces `assistance_requested`
- the operator can acknowledge and resolve the request
- the device recovers from temporary Wi-Fi or backend interruptions
