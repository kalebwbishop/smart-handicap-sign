# Hazard Hero Firmware

ESP-IDF firmware for the **single pilot sign**. This firmware is intentionally focused on the one-sign assistance loop and field setup needed for that pilot.

## What this firmware does

- Connects one ESP32 sign to Wi-Fi
- Polls backend status for the installed sign
- Samples the photoresistor on **GPIO 34**
- Sends **200 ADC samples** to `POST /inference/classify` only when the sign is `available`
- Mirrors backend-driven sign state on the LED at **GPIO 2**
- Falls back to SoftAP provisioning when Wi-Fi credentials are missing or invalid

## Dev-only data recorder

The recorder is a separate ESP-IDF project under `firmware/dev/data_recorder/`. It does one job only:

- sample raw ADC data
- POST the samples to the backend over plain HTTP
- ignore HTTP failures and keep looping

That build does **not** use certificates, IoT Hub, provisioning, or sign-state polling.

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
- If status is `available`, collect 200 samples over about 4.0 seconds
- Send the sample batch to `POST /inference/classify`

## Supported sign states

The pilot relies on these core operational states:

- `available`
- `assistance_requested`
- `assistance_in_progress`
- `offline`
- `error`

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
├── dev/
│   └── data_recorder/
│       ├── CMakeLists.txt
│       └── main/
│           ├── CMakeLists.txt
│           └── main.c
├── battery_test/
│   ├── CMakeLists.txt
│   └── main/
│       ├── CMakeLists.txt
│       └── main.c
└── main/
    ├── main.c
    ├── adc_sampler.c
    ├── adc_sampler.h
    ├── connection_policy.c
    ├── dps_client.c
    ├── iot_hub_client.c
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

### Windows quick-start for a plugged-in ESP32

If the board is already connected over USB on Windows, this is the fastest pilot workflow:

1. Find the serial port:

   ```powershell
   Get-CimInstance Win32_SerialPort | Select-Object DeviceID, Description
   ```

2. Build in WSL with ESP-IDF:

   ```cmd
   wsl -d Ubuntu -- bash -lc "source /root/esp/esp-idf/export.sh && cd /mnt/c/Users/kaleb/repos/apps/smart-handicap-sign/firmware && idf.py build"
   ```

3. Install `esptool` on Windows if needed:

   ```cmd
   py -m pip install esptool
   ```

4. Flash the WSL-built image from Windows:

   ```cmd
   py -m esptool --chip esp32 -p COM3 -b 460800 --before default_reset --after hard_reset write_flash --flash_mode dio --flash_size 4MB --flash_freq 40m 0x1000 firmware\build\bootloader\bootloader.bin 0x8000 firmware\build\partition_table\partition-table.bin 0x10000 firmware\build\hazard-hero-firmware.bin
   ```

5. If you want logs after flashing, open a serial monitor separately.

   ```cmd
   py -m serial.tools.miniterm COM3 115200
   ```

### Copilot extension for build, flash, and logs

The repository also includes a Copilot extension at `.github/extensions/hazard-hero-esp32/` with three tools:

- `hazard_hero_esp32_build`
- `hazard_hero_esp32_flash`
- `hazard_hero_esp32_logs`

Use `hazard_hero_esp32_flash` with the device port such as `COM3` or `/dev/ttyUSB0`. Use `hazard_hero_esp32_logs` to capture a bounded window of serial output from the ESP32. If you plan to use the log tool on Windows, install `pyserial` first:

```cmd
py -m pip install pyserial
```

#### Why this flow

`idf.py` inside WSL cannot use Windows serial ports such as `COM3` directly. The reliable path on this repo is:

1. **build in WSL**
2. **flash from Windows**

Replace `COM3` with the port shown for the connected ESP32. If the flash step says the port is busy, close any serial monitor or terminal already attached to that port.

## Required configuration

### Backend URL

Set the backend API base URL in `firmware/CMakeLists.txt` before building:

```cmake
set(HAZARD_HERO_BACKEND_URL "https://api.example.com/api/v1" CACHE STRING "Backend API base URL")
```

Use the real pilot backend URL, including `/api/v1`.

### Dev recorder build

Build it from the separate project directory:

```bash
cd firmware/dev/data_recorder
idf.py -DDEV_BACKEND_URL="http://192.168.1.50:8000/api/v1/dev/training-captures" \
       -DDEV_WIFI_SSID="DevLabWiFi" \
       -DDEV_WIFI_PASSWORD="replace-me" \
       -DDEV_CAPTURE_LABEL="unlabeled" \
       build
```

The dev recorder sends:

- `serial_number`
- `sample_count`
- `sample_interval_ms`
- `capture_label`
- `firmware_version`
- `samples`

The backend records those batches for later training use.

### IoT Hub / DPS enrollment

The firmware requires these CMake definitions at build time:

```cmake
set(DPS_ID_SCOPE "0ne00000000" CACHE STRING "Azure DPS ID scope")
set(DPS_REGISTRATION_ID "hazard-hero-sign-01" CACHE STRING "DPS registration ID")
```

Notes:

- `DPS_ID_SCOPE` is required for the device to resolve its assigned IoT Hub.
- `DPS_REGISTRATION_ID` is optional if the device can load a saved identity from NVS.
- If `DPS_ID_SCOPE` is empty, startup stops with `DPS_ID_SCOPE is not configured`.

### Device identity

The sign uses these identity values:

- `device.serial`
- `device.auth_token`

Notes:

- `device.serial` should be preloaded for the pilot.
- If `device.serial` is missing, current firmware regenerates it from the device MAC address and stores it in NVS.
- `device.auth_token` should be preloaded before pilot installation.

### Wi-Fi credentials

For the pilot, preload these NVS values before installation:

- `wifi.wifi_ssid`
- `wifi.wifi_pass`

## Recovery provisioning

Manual provisioning is the primary pilot path. If Wi-Fi credentials are missing or reconnect attempts fail repeatedly, firmware can still start a SoftAP provisioning server as a recovery tool.

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
  -d "{\"ssid\":\"OfficeWiFi\",\"password\":\"correct-horse-battery-staple\"}"
```

## NVS preload option

For bench setup or manufacturing, generate an NVS image and flash it to the `nvs` partition.

Example CSV:

```csv
key,type,encoding,value
device,namespace,,
serial,data,string,HH-ESP32-0001
auth_token,data,string,replace-with-device-auth-token
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

Windows example:

```powershell
python %IDF_PATH%\components\nvs_flash\nvs_partition_generator\nvs_partition_gen.py `
  generate device_config.csv device_nvs.bin 0x6000

python -m esptool --port COM3 write_flash 0x9000 device_nvs.bin
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
| Sample count | `200` |
| Sample interval | `20 ms` |
| Sampling window | `~4.0 s` |
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
4. Manually preload serial number, auth token, and Wi-Fi credentials.
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
