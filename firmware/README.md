# Hazard Hero Firmware

ESP-IDF firmware for the **single pilot sign**. This firmware is intentionally focused on the one-sign assistance loop and field setup needed for that pilot.

## What this firmware does

- Connects one ESP32 sign to Wi-Fi
- Polls backend status for the installed sign
- Samples the photoresistor on **GPIO 34**
- Sends **512 ADC samples** to `POST /inference/classify` only when the sign is `available`
- Mirrors backend-driven sign state on the LED at **GPIO 2**
- Falls back to SoftAP provisioning when Wi-Fi credentials are missing or invalid

## Pilot-only scope

This firmware is for operating one installed sign. It does **not** depend on:

- OTA updates
- Fleet rollout workflows
- Multi-site coordination
- Complex runtime update channels

Those can be added after the pilot proves the core assistance loop.

## Runtime behavior

Boot flow:

1. Initialize NVS
2. Initialize LED driver
3. Load device identity
4. Initialize Wi-Fi manager
5. Load Wi-Fi credentials or enter provisioning mode
6. Connect to Wi-Fi
7. Initialize ADC sampler
8. Initialize HTTPS client
9. Enter the main loop

Main loop:

- Poll `GET /devices/{serial}/status`
- Update the LED to match backend status
- If status is not `available`, wait 3 seconds and poll again
- If status is `available`, collect 512 samples over 12.8 seconds
- Send the sample batch to `POST /inference/classify`

## Supported sign states

The pilot relies on these core operational states:

- `available`
- `assistance_requested`
- `assistance_in_progress`
- `offline`
- `error`

The LED driver still supports training states, but they are not part of the pilot operator workflow.

## Hardware assumptions

- ESP32-WROOM-32 class board
- 4 MB flash
- Photoresistor on **GPIO 34**
- Status LED on **GPIO 2**

## Project files

```text
firmware/
├── CMakeLists.txt
├── partitions.csv
├── sdkconfig.defaults
├── version.txt
├── server_certs/
│   └── ca_cert.pem
└── main/
    ├── main.c
    ├── adc_sampler.c
    ├── adc_sampler.h
    ├── https_client.c
    ├── https_client.h
    ├── led_driver.c
    ├── led_driver.h
    ├── nvs_storage.c
    ├── nvs_storage.h
    ├── provisioning_server.c
    ├── provisioning_server.h
    ├── wifi_manager.c
    └── wifi_manager.h
```

## Build requirements

- ESP-IDF 5.4+
- Python 3.10+
- CMake + Ninja
- WSL2 on Windows is recommended for local builds

## Build and flash

From a Linux-path checkout with ESP-IDF exported:

```bash
source ~/esp/esp-idf/export.sh
cd ~/code/smart-handicap-sign/firmware
idf.py set-target esp32
idf.py build
idf.py -p /dev/ttyUSB0 flash
idf.py -p /dev/ttyUSB0 monitor
```

## Required configuration

### Backend URL

Set the backend API base URL in `firmware/CMakeLists.txt` before building:

```cmake
set(HAZARD_HERO_BACKEND_URL "https://api.example.com/api/v1" CACHE STRING "Backend API base URL")
```

Use the real pilot backend URL, including `/api/v1`.

### Device identity

The sign uses these identity values:

- `device.auth_token`

Notes:

- `device.serial` should be preloaded for the pilot when possible.
- If `device.serial` is missing, current firmware regenerates it from the device MAC address and stores it in NVS.
- `device.auth_token` still needs to be provisioned for normal backend communication.

### Wi-Fi credentials

The sign needs these NVS values or must receive them through provisioning:

- `wifi.wifi_ssid`
- `wifi.wifi_pass`

## Provisioning in the field

If Wi-Fi credentials are missing or reconnect attempts fail repeatedly, firmware starts a SoftAP provisioning server.

### Provisioning details

- SSID format: `SmartSign-XXXX`
- IP address: `192.168.4.1`
- Port: `80`

### Provisioning endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/status` | GET | Confirms AP mode and device identity summary |
| `/scan` | GET | Lists nearby Wi-Fi networks |
| `/configure` | POST | Saves Wi-Fi credentials and reboots |

Example:

```bash
curl http://192.168.4.1/status
curl http://192.168.4.1/scan
curl -X POST http://192.168.4.1/configure \
  -H "Content-Type: application/json" \
  -d "{\"ssid\":\"OfficeWiFi\",\"password\":\"correct-horse-battery-staple\",\"claim_id\":\"ABCD-EF23\"}"
```

## NVS preload option

For bench setup or manufacturing, generate an NVS image and flash it to the `nvs` partition.

Example CSV:

```csv
key,type,encoding,value
device,namespace,,
serial,data,string,HH-ESP32-0001
auth_token,data,string,replace-with-device-auth-token
setup_code_hash,data,string,replace-with-fake-local-verifier-hash
setup_code_salt,data,string,replace-with-fake-local-verifier-salt
wifi,namespace,,
wifi_ssid,data,string,OfficeWiFi
wifi_pass,data,string,correct-horse-battery-staple
```

Generate and flash:

```bash
python $IDF_PATH/components/nvs_flash/nvs_partition_generator/nvs_partition_gen.py \
  generate device_config.csv device_nvs.bin 0x6000

python -m esptool --port /dev/ttyUSB0 write_flash 0x9000 device_nvs.bin
```

## Partition table

The pilot firmware uses a **single application partition** instead of an OTA layout.

| Partition | Type | Subtype | Offset | Size | Purpose |
|---|---|---|---:|---:|---|
| `nvs` | data | nvs | `0x9000` | `0x6000` | Device identity and Wi-Fi credentials |
| `phy_init` | data | phy | `0xF000` | `0x1000` | RF calibration |
| `factory` | app | factory | `0x10000` | `0x3F0000` | Pilot firmware image |

## Key constants

| Setting | Value |
|---|---|
| Sample count | `512` |
| Sample interval | `25 ms` |
| Sampling window | `12.8 s` |
| Status poll interval | `3000 ms` |
| Wi-Fi connect timeout | `20000 ms` |
| Watchdog timeout | `30000 ms` |
| Max reconnect failures | `3` |

## LED patterns

| Status | Pattern |
|---|---|
| `available` | Slow heartbeat |
| `assistance_requested` | Fast blink |
| `assistance_in_progress` | Double flash |
| `offline` | Off |
| `error` | Triple burst |

## Pilot operations checklist

Before installing the pilot sign:

1. Set the backend URL.
2. Replace `server_certs/ca_cert.pem` with the CA needed for the pilot backend.
3. Flash the firmware.
4. Provision serial number, auth token, and Wi-Fi credentials.
5. Verify the sign can poll status.
6. Verify a real wave triggers `assistance_requested`.
7. Verify the operator can acknowledge and resolve the request.

## Troubleshooting

### Device boots into AP mode

- Wi-Fi credentials are missing
- Saved credentials are wrong
- The sign failed to reconnect too many times

### Status polling fails

- Backend URL is wrong
- TLS certificate does not match the backend chain
- Device serial number or auth token is missing/invalid
- Backend is unavailable

### Classification never runs

- Backend status is not `available`
- ADC wiring is wrong
- HTTPS client cannot reach `/inference/classify`

## Validation

Use `firmware/TEST_PLAN.md` for the hardware validation checklist. The most important pilot checks are:

- boot and LED behavior
- Wi-Fi provisioning
- status polling
- wave sampling and classification
- recovery from temporary Wi-Fi loss
