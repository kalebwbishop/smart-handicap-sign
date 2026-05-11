# Hazard Hero Firmware (ESP-IDF)

ESP-IDF firmware for the **ESP32-WROOM-32** smart handicap sign controller. It replaces the legacy MicroPython runtime in `hardware/` with a C implementation built around ESP-IDF 5.4+, dual OTA slots, HTTPS transport, NVS-backed provisioning, and deterministic LED / ADC / Wi-Fi behavior.

The firmware samples a photoresistor on **GPIO 34 (ADC1_CH6)**, sends **512 samples** to the backend classifier, polls device status from the API, and reflects that status on the onboard LED at **GPIO 2**.

## At a glance

- **Target board:** ESP32-WROOM-32 class dev boards (4 MB flash, no PSRAM)
- **ADC input:** GPIO 34 / ADC1 channel 6
- **Status LED:** GPIO 2
- **Sampling window:** 512 samples × 25 ms = **12.8 s**
- **Backend base URL:** compile-time CMake cache value `HAZARD_HERO_BACKEND_URL`
- **Wi-Fi fallback:** SoftAP provisioning after missing creds or 3 failed reconnects
- **Watchdog timeout:** 30 s
- **Status poll interval:** 3 s when not in `available`
- **OTA layout:** dual app slots (`ota_0`, `ota_1`) plus `otadata`

---

## Project structure

```text
firmware/
├── CMakeLists.txt                    # Top-level ESP-IDF project definition
├── README.md                         # This setup and architecture guide
├── partitions.csv                    # Custom dual-OTA partition layout
├── sdkconfig.defaults                # Default sdkconfig values for ESP32-WROOM-32
├── version.txt                       # Human-maintained firmware version marker
├── server_certs/
│   └── ca_cert.pem                   # Embedded PEM root CA used by HTTPS + OTA
└── main/
    ├── CMakeLists.txt                # Registers firmware sources and embedded cert
    ├── main.c                        # Application entry point, boot sequence, main loop
    ├── nvs_storage.h                 # Public API for persisted serial, token, and Wi-Fi creds
    ├── nvs_storage.c                 # NVS read/write helpers for device + Wi-Fi namespaces
    ├── wifi_manager.h                # Wi-Fi STA/AP API and scan result types
    ├── wifi_manager.c                # Wi-Fi STA connect, SoftAP mode, RSSI-sorted scanning
    ├── provisioning_server.h         # Provisioning server lifecycle API
    ├── provisioning_server.c         # SoftAP HTTP server for `/status`, `/scan`, `/configure`
    ├── adc_sampler.h                 # ADC constants and batch sampling interface
    ├── adc_sampler.c                 # ADC1 oneshot driver for 12-bit photoresistor sampling
    ├── led_driver.h                  # Device status enum and LED control API
    ├── led_driver.c                  # Non-blocking timer-driven LED patterns for 8 statuses
    ├── https_client.h                # HTTPS classify/status request interfaces and result types
    ├── https_client.c                # TLS client for classify POST and status GET requests
    ├── ota_update.h                  # OTA control API and status enum
    └── ota_update.c                  # esp_https_ota implementation and rollback helpers
```

---

## Architecture

```text
                           +----------------------+
                           |      main.c          |
                           | boot + main loop     |
                           +----------+-----------+
                                      |
          +---------------------------+------------------------------+
          |              |                 |               |          |
          v              v                 v               v          v
+----------------+ +-------------+ +---------------+ +-----------+ +----------------+
| nvs_storage    | | wifi_manager| | adc_sampler   | | led_driver| | https_client   |
| serial/token   | | STA/AP/scan | | ADC1 oneshot  | | 8 patterns| | TLS API calls  |
| wifi creds     | +------+------+ +-------+-------+ +-----+-----+ +--------+-------+
+--------+-------+        |                |               ^                |
         |                v                |               |                |
         |        +---------------+        |               |                |
         |        | provisioning  |<-------+               |                |
         |        | _server       |                        |                |
         |        | SoftAP HTTP   |------------------------+                |
         |        +---------------+                                         |
         |                                                                   |
         +---------------------------------------------------+               |
                                                             |               |
                                                             v               v
                                                     +-------------------------------+
                                                     | Backend API + CA certificate   |
                                                     | `/devices/{serial}/status`     |
                                                     | `/inference/classify`           |
                                                     +-------------------------------+

                           +----------------------+
                           |     ota_update       |
                           | esp_https_ota +      |
                           | rollback helpers     |
                           +----------+-----------+
                                      |
                                      v
                           +----------------------+
                           | partitions.csv       |
                           | ota_0 / ota_1 slots  |
                           +----------------------+
```

**Important:** `app_main()` now calls `ota_init()` during boot and `ota_mark_valid()` after the first successful backend connectivity check. `ota_perform_update()` still requires an explicit trigger path.

---

## Boot sequence

The current `app_main()` flow is:

1. **NVS init** via `nvs_storage_init()`
2. **LED driver init** via `led_driver_init()`
3. **OTA init** via `ota_init()`
4. **Load device identity** → regenerate from MAC and persist if missing
5. **Wi-Fi manager init** via `wifi_manager_init()`
6. **Check Wi-Fi credentials** → enter provisioning mode if missing
7. **Wi-Fi STA connect** → enter provisioning mode if the saved network fails
8. **ADC sampler init** via `adc_sampler_init()`
9. **HTTPS client init** via `https_client_init(HAZARD_HERO_BACKEND_URL)`
10. **Enable task watchdog** with a 30 s timeout
11. **Enter main loop**
12. **Mark OTA image valid** after the first successful backend connectivity check

Main loop behavior:

- Poll `/devices/{serial}/status`
- Mirror backend status on the LED
- If status is not `available`, wait **3 s** and poll again
- If status is `available`, collect **512 ADC samples** over **12.8 s**
- POST samples to `/inference/classify`
- Retry Wi-Fi up to **3 failures** before falling back to SoftAP provisioning

---

## Prerequisites

### Required software

- **ESP-IDF v5.4+**
- **Python 3.10+** (installed by the ESP-IDF toolchain flow is fine)
- **CMake + Ninja** (installed via ESP-IDF setup)
- **WSL2 Ubuntu** on Windows (recommended and assumed below)
- **usbipd-win** on Windows for USB passthrough into WSL2

### Required hardware

- ESP32-WROOM-32 board (or compatible ESP32 dev board with 4 MB flash)
- USB cable with data lines
- Photoresistor wired to **GPIO 34**
- LED on **GPIO 2** (most ESP32 dev boards already expose this as the onboard LED)

### WSL2 setup notes

Build from the **Linux filesystem** (for example `~/code/smart-handicap-sign/firmware`), **not** from `/mnt/c/...`. ESP-IDF builds are noticeably slower and less reliable when the source tree lives on the Windows-mounted filesystem.

Example ESP-IDF installation inside WSL2:

```bash
mkdir -p ~/esp
cd ~/esp
git clone -b v5.4 --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
./install.sh esp32
echo 'source ~/esp/esp-idf/export.sh' >> ~/.bashrc
source ~/esp/esp-idf/export.sh
```

Recommended one-time serial access fix inside WSL:

```bash
sudo usermod -aG dialout $USER
# then log out and back in
```

### USB passthrough with `usbipd-win`

Run these commands from **Windows PowerShell as Administrator**:

```powershell
usbipd list
usbipd bind --busid <BUSID>
usbipd attach --wsl --busid <BUSID>
```

Then verify the device inside WSL:

```bash
ls /dev/ttyUSB* /dev/ttyACM*
```

When you are done flashing:

```powershell
usbipd detach --busid <BUSID>
```

---

## Build, flash, and monitor

### 1) Open a WSL2 shell with ESP-IDF exported

```bash
source ~/esp/esp-idf/export.sh
```

### 2) Work from a Linux-path checkout

```bash
cd ~/code/smart-handicap-sign/firmware
```

### 3) Set the target once

```bash
idf.py set-target esp32
```

### 4) Build

```bash
idf.py build
```

Useful clean rebuild if you change targets or toolchain state:

```bash
idf.py fullclean build
```

### 5) Flash the board

```bash
idf.py -p /dev/ttyUSB0 flash
```

### 6) Watch boot logs

```bash
idf.py -p /dev/ttyUSB0 monitor
```

Exit the monitor with **Ctrl+]**.

### 7) One-command flash + monitor

```bash
idf.py -p /dev/ttyUSB0 flash monitor
```

### 8) Optional size report

```bash
idf.py size
```

---

## Configuration

There is no Kconfig surface for runtime deployment settings yet. Configuration currently comes from **compile-time constants** plus **NVS data**.

### 1) Backend base URL (`HAZARD_HERO_BACKEND_URL`)

The backend URL is provided as a CMake cache value in `firmware/CMakeLists.txt` and compiled into `main/main.c`:

```cmake
set(HAZARD_HERO_BACKEND_URL "https://api.example.com/api/v1" CACHE STRING "Backend API base URL")
```

Set this to the environment-specific API base URL before building.

**Notes:**

- The URL should include `/api/v1`
- `https_client_init()` trims any trailing slash
- The embedded CA in `server_certs/ca_cert.pem` must trust the server you point to

### 2) Device serial number

The device **will not boot into the main loop without a serial number** in NVS.

- Namespace: `device`
- Key: `serial`
- Max length: **32 chars**

### 3) Device auth token

The classify request loads an auth token from NVS.

- Namespace: `device`
- Key: `auth_token`
- Max length: **128 chars**

If the token is missing, boot will still complete, but classification calls will fail once the device starts sending samples.

### 4) Wi-Fi credentials

Wi-Fi credentials may be loaded in either of two ways:

- **Provisioning SoftAP** (recommended for field setup)
- **Preloaded NVS** during manufacturing

Stored keys:

- Namespace: `wifi`
- Key: `wifi_ssid` (max **32 chars**)
- Key: `wifi_pass` (max **64 chars**)

If credentials are missing, or if the device fails to reconnect **3 times**, firmware falls back to provisioning mode.

### 5) TLS certificate

`server_certs/ca_cert.pem` is embedded into the firmware image at build time. Replace the placeholder before using real HTTPS services.

- `https_client.c` disables common-name checking for dev-tunnel usage
- `ota_update.c` uses the embedded CA as well; serve OTA binaries from a host the cert actually matches

---

## Provisioning Wi-Fi in the field

If Wi-Fi credentials are missing or invalid, firmware starts a SoftAP and HTTP provisioning server.

### SoftAP behavior

- SSID format: **`SmartSign-XXXX`** (`XXXX` = last two MAC bytes in hex)
- Port: **80**
- Default ESP-IDF AP IP: **`192.168.4.1`**

### Provisioning endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/status` | GET | Returns device MAC-derived ID and confirms AP mode |
| `/scan` | GET | Returns nearby Wi-Fi networks sorted by RSSI |
| `/configure` | POST | Saves `ssid` and `password`, then reboots |

Example field provisioning flow:

```bash
curl http://192.168.4.1/status
curl http://192.168.4.1/scan
curl -X POST http://192.168.4.1/configure \
  -H 'Content-Type: application/json' \
  -d '{"ssid":"OfficeWiFi","password":"correct-horse-battery-staple"}'
```

---

## NVS provisioning (serial number, auth token, optional Wi-Fi)

For manufacturing or bench setup, the cleanest path is to generate an NVS partition image and flash it to the `nvs` partition at **0x9000**.

### Option A — generate an NVS partition binary

Create `device_config.csv`:

```csv
key,type,encoding,value
device,namespace,,
serial,data,string,HH-ESP32-0001
auth_token,data,string,replace-with-device-auth-token
wifi,namespace,,
wifi_ssid,data,string,OfficeWiFi
wifi_pass,data,string,correct-horse-battery-staple
```

If you want Wi-Fi entered later through the provisioning portal, omit the `wifi_*` rows and keep only the `device` namespace values.

Generate the partition image:

```bash
python $IDF_PATH/components/nvs_flash/nvs_partition_generator/nvs_partition_gen.py \
  generate device_config.csv device_nvs.bin 0x6000
```

Flash it:

```bash
esptool.py --port /dev/ttyUSB0 write_flash 0x9000 device_nvs.bin
```

Or, if you prefer using the ESP-IDF Python environment explicitly:

```bash
python -m esptool --port /dev/ttyUSB0 write_flash 0x9000 device_nvs.bin
```

### Option B — flash firmware, then flash NVS

```bash
idf.py -p /dev/ttyUSB0 flash
esptool.py --port /dev/ttyUSB0 write_flash 0x9000 device_nvs.bin
```

### Important NVS notes

- Partition size must stay **0x6000** to match `partitions.csv`
- Flash offset must stay **0x9000**
- `idf.py erase-flash` wipes NVS and requires reprovisioning
- The app requires **`device.serial`** before normal boot will start

---

## Key firmware constants

| Constant | Value | Source |
|---|---:|---|
| `HAZARD_HERO_BACKEND_URL` | `https://api.example.com/api/v1` (override per build) | `firmware/CMakeLists.txt` |
| `ADC_PIN` | `GPIO 34 / ADC1_CH6` | `main/adc_sampler.h` |
| `LED_GPIO` | `GPIO 2` | `main/led_driver.h` |
| `SAMPLES_PER_BATCH` | `512` | `main/adc_sampler.h` |
| `SAMPLE_INTERVAL_MS` | `25` | `main/adc_sampler.h` |
| Sampling time | `12.8 s` | Derived from 512 × 25 ms |
| WDT timeout | `30000 ms` | `main/main.c` |
| Wi-Fi connect timeout | `20000 ms` | `main/main.c` / `wifi_manager.c` |
| Status poll interval | `3000 ms` | `main/main.c` |
| Max reconnect failures | `3` | `main/main.c` |
| Status retry count | `3` | `main/main.c` |

---

## Partition table

`partitions.csv` defines a dual-slot OTA layout for a 4 MB ESP32 flash part:

| Partition | Type | Subtype | Offset | Size | Purpose |
|---|---|---|---:|---:|---|
| `nvs` | data | nvs | `0x9000` | `0x6000` (24 KB) | Serial number, auth token, Wi-Fi creds |
| `otadata` | data | ota | `0xF000` | `0x2000` (8 KB) | Active OTA slot / rollback metadata |
| `phy_init` | data | phy | `0x11000` | `0x1000` (4 KB) | RF calibration data |
| `ota_0` | app | ota_0 | `0x20000` | `0x1F0000` (~1.94 MiB) | App slot A |
| `ota_1` | app | ota_1 | `0x210000` | `0x1F0000` (~1.94 MiB) | App slot B |

Why it matters:

- Two app partitions allow safe OTA swaps
- NVS is large enough for identity + Wi-Fi provisioning
- The application binary must fit within a **single 0x1F0000 slot**

---

## Memory budget

The table below is an engineering budget for this firmware shape on an ESP32 without PSRAM. Exact free heap varies by build flags, Wi-Fi state, and TLS handshake overhead.

| Component / working set | Approx. RAM |
|---|---:|
| Wi-Fi + lwIP stack | 100-115 KB |
| FreeRTOS kernel / task infrastructure | 20-30 KB |
| ADC sample buffer (`512 * sizeof(int)`) | 2 KB |
| HTTP client TX buffer | 4 KB |
| HTTP client RX buffer | 2 KB |
| JSON request/response allocations | 2-8 KB |
| Provisioning HTTP server overhead | 8-16 KB |
| App state, timers, NVS helpers, strings | 10-20 KB |
| **Target free heap after Wi-Fi + HTTPS init** | **150+ KB** |

If you need real numbers on a board, run `idf.py size` and log `heap_caps_get_free_size()` from a local test build.

---

## LED status patterns

The LED driver is timer-based and non-blocking. Status strings from the backend are converted into the enum in `led_driver.h`.

| Status | Pattern | Timing |
|---|---|---|
| `available` | Slow heartbeat | 1 s on, 2 s off |
| `assistance_requested` | Fast blink | 200 ms on, 200 ms off |
| `assistance_in_progress` | Double flash | 150 ms on, 150 ms off, 150 ms on, 800 ms off |
| `offline` | LED off | Off continuously |
| `error` | Triple burst (SOS-like) | 100 ms on/off ×3, then 800 ms pause |
| `training_ready` | Medium pulse | 500 ms on, 500 ms off |
| `training_positive` | Solid on | On continuously |
| `training_negative` | Very fast blink | 100 ms on, 100 ms off |

---

## HTTPS behavior

### Status polling

- Path: `GET /devices/{serial}/status`
- Serial number comes from NVS
- Response must contain JSON field `status`

### Classification

- Path: `POST /inference/classify`
- Sends `serial_number` plus `samples[512]`
- Samples must be 12-bit raw values in the range `0..4095`
- Authorization header format: `Bearer <serial>:<auth_token>`

### CA / certificate behavior

- `server_certs/ca_cert.pem` is embedded at build time
- `https_client.c` keeps TLS common-name validation enabled
- The embedded CA must trust the configured backend hostname and certificate chain

---

## OTA update instructions

The firmware includes an OTA module and a dual-slot partition table. Current status:

- `ota_update.c` is compiled and linked
- `partitions.csv` supports OTA slot switching
- `server_certs/ca_cert.pem` is reused for OTA TLS
- `main.c` now calls `ota_init()` during boot and `ota_mark_valid()` after the first successful backend connectivity check
- `ota_perform_update()` still requires an explicit update trigger

### What is already implemented

`ota_update.c` supports:

- Detecting first boot after OTA (`ota_is_first_boot()`)
- Marking the running image valid (`ota_mark_valid()`)
- Downloading a firmware binary over HTTPS (`ota_perform_update(url)`)
- Reporting current version and OTA status

### Practical OTA workflow

1. Build firmware:

   ```bash
   idf.py build
   ```

2. Host the generated firmware binary (typically under `build/`) on an HTTPS endpoint trusted by `server_certs/ca_cert.pem`
3. Invoke `ota_perform_update("https://your-host/path/firmware.bin")` from your chosen update trigger
4. Reboot after success so the bootloader switches to the new slot
5. On next boot, let the normal boot path call `ota_init()` and wait for the first successful backend connectivity check to trigger `ota_mark_valid()` and cancel rollback

### OTA constraints

- The firmware binary must fit inside one **0x1F0000** app slot
- The OTA URL must be HTTPS
- The server certificate must chain to the embedded CA

---

## Migration status

ESP-IDF migration status for the firmware tree:

- [x] ESP-IDF project scaffolding and component registration
- [x] NVS persistence for serial number, auth token, and Wi-Fi credentials
- [x] Wi-Fi station mode, reconnect handling, and SoftAP fallback
- [x] Provisioning HTTP server (`/status`, `/scan`, `/configure`)
- [x] ADC sampling pipeline (512 samples @ 25 ms)
- [x] Non-blocking LED status patterns for all 8 states
- [x] HTTPS classify and status client
- [x] OTA support module and dual-slot partition table
- [x] Main boot sequence and runtime loop
- [x] Firmware documentation

**Reality check:** migration is complete at the module/documentation level, but OTA still needs to be called from the runtime path if you want automatic update behavior.

---

## Troubleshooting

### `idf.py: command not found`

You have not exported the ESP-IDF environment in the current shell.

```bash
source ~/esp/esp-idf/export.sh
```

### Flashing from WSL cannot find `/dev/ttyUSB0`

- Make sure the board is attached with `usbipd attach --wsl --busid <BUSID>`
- Check `/dev/ttyUSB*` and `/dev/ttyACM*`
- Ensure your user is in the `dialout` group

### Builds are very slow or flaky under WSL2

Do not build from `/mnt/c/...`. Move the repo into the Linux filesystem (for example `~/code/...`).

### Device boots, then halts with error LED

The serial number is missing from NVS. Provision `device.serial` before booting normally.

### Device always starts in provisioning mode

Likely causes:

- No Wi-Fi credentials in NVS
- Saved SSID/password are wrong
- Wi-Fi connect timed out after 20 s
- Reconnect exceeded 3 failures and firmware fell back to SoftAP

### `/scan` works, but backend calls fail

Check all of the following:

- `HAZARD_HERO_BACKEND_URL` is set to the correct backend for the build
- `server_certs/ca_cert.pem` is not the placeholder
- `device.auth_token` exists in NVS
- The backend exposes `/api/v1/devices/{serial}/status` and `/api/v1/inference/classify`

### OTA fails immediately

Common causes:

- Placeholder CA certificate still embedded
- OTA host certificate does not match the URL / trust chain
- Firmware binary is larger than one OTA slot
- No runtime code is currently invoking `ota_perform_update()`

### NVS provisioning image flashes, but values are not read

Verify all three of these match the code:

- Offset: `0x9000`
- Size: `0x6000`
- Keys/namespaces: `device.serial`, `device.auth_token`, `wifi.wifi_ssid`, `wifi.wifi_pass`

### `idf.py erase-flash` fixed one problem and created another

That command wipes the NVS partition too. Reflash your device identity and Wi-Fi credentials afterward.
