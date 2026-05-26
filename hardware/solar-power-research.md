# Solar Power Feasibility Research - Hazard Hero Sign Node

> **Directory note:** The `hardware/` directory is legacy-designated in this repository; the
> active embedded implementation lives in `firmware/`. This document is placed here
> intentionally because it is most naturally read alongside the PCB design artifacts
> (`hazard-hero-easyeda-pcb.json`, `hazard-hero-pcb-README.md`) and the legacy MicroPython
> files (`main.py`, `config.py`, etc.) that preceded the current C firmware. All firmware
> citations reference the active ESP-IDF C codebase under `firmware/main/`.

---

## Executive Summary

The Hazard Hero sign node is presently designed for a hardwired **12 V DC** field supply. The
PCB includes a reserved battery header (J2/VBAT) but no charge controller, no power-path
management IC, and no battery management subsystem. The active firmware runs the ESP32-WROOM-32
at a fixed **240 MHz** with Wi-Fi continuously associated and no power management enabled - a
configuration optimized for deterministic latency, not energy efficiency.

The controller alone draws roughly **80-120 mA at 3.3 V** in the steady-state sampling loop,
before the sign or lamp load switched by Q1 is considered. Because that lamp load is
**not characterized anywhere in the repository**, any specific panel-watt or battery-Ah figure
would carry an order-of-magnitude uncertainty and is intentionally avoided in this document.
Rough sizing formulas are provided so the work can be completed once the lamp load is measured.

Solar operation is technically achievable on this platform, but it requires changes at every
layer: new PCB hardware (charge controller, power-path IC, battery connector), a redesigned
power entry section, firmware power-management strategy (DFS, modem-sleep, and graceful
offline behavior), and an enclosure-level survey for panel placement and thermal management.
None of these are present today. This document maps each gap, estimates the scope of work, and
identifies the highest-risk items to resolve before committing to a solar build.

---

## 1. Current Architecture Overview

### 1.1 PCB power chain

The Hazard Hero controller board (`hardware/hazard-hero-pcb-README.md`) implements a
straightforward cascade:[^pcb-flow]

```
J1 (12 V IN)
  -> F1 (PTC resettable fuse / current limit)
  -> D1 (TVS transient clamp)
  -> U1 (external 5 V buck module header)
  -> U2 (3.3 V SOT-223 LDO)
  -> U3 (ESP32 controller module)
```

The sign or lamp load is fed from the fused 12 V rail through J3 (`VIN_FUSED` / `LAMP_RET`)
and switched on the low side by the Q1 DPAK MOSFET. The load topology means Q1 carries the
full lamp current referenced to GND, while the supply side of the lamp sees the protected
12 V rail directly.

**J2 (VBAT)** is a reserved 2-pin terminal. The PCB README states explicitly: *"The current
layout does not yet include a full charger or power-path management circuit around it."*[^j2-vbat]
It is a provision point, not a functional battery subsystem.

### 1.2 Active firmware at a glance

| Item | Value | Source |
|---|---|---|
| Target module | ESP32-WROOM-32 (4 MB flash, no PSRAM) | `firmware/sdkconfig.defaults:2` (comment), `firmware/README.md:9` |
| CPU clock | **240 MHz, fixed** | `firmware/sdkconfig.defaults:10` |
| ADC batch size | **512 samples** | `firmware/main/adc_sampler.h:10` |
| Sample interval | **25 ms** -> **12.8 s per batch** | `firmware/main/adc_sampler.h:11`, comment line 22 |
| Status poll interval | **3 s** (non-`available` states) | `firmware/main/main.c:25` |
| Post-classify inter-loop delay | **1 s** | `firmware/main/main.c:24` |
| Watchdog timeout | **30 s** | `firmware/sdkconfig.defaults:28` |
| Wi-Fi mode | STA, always-on | `firmware/main/wifi_manager.c` |
| Wi-Fi power saving | **None configured** | No `esp_wifi_set_ps()` call in codebase |
| ESP-IDF power management | **Not enabled** | `CONFIG_PM_ENABLE` absent from `firmware/sdkconfig.defaults` |

Main loop cycle when the device is in `available` state:[^main-loop]

```
poll GET /devices/{serial}/status
  -> if not available -> wait 3 s, loop
  -> if available:
       collect 512 ADC samples x 25 ms   (~12.8 s; CPU mostly idle, Wi-Fi held live)
       POST /inference/classify
       wait 1 s
       loop
```

During the 12.8 s ADC window, the Wi-Fi association is maintained but no data is transmitted.
The CPU spends the vast majority of this window blocked inside `vTaskDelay(pdMS_TO_TICKS(25))`
between samples - idle time that power management could exploit if enabled.[^adc-loop]

### 1.3 Legacy MicroPython context

The `hardware/` directory contains legacy MicroPython files (`main.py`, `config.py`,
`led.py`, `provision.py`, `sensor.py`, `identity.py`, `wifi_utils.py`) that preceded the
current ESP-IDF C implementation. The firmware README explicitly states the C firmware
"replaces the legacy MicroPython runtime in `hardware/`".[^fw-readme] Those Python files are
historical artifacts; they are not executed by any active hardware.

---

## 2. What Would Need to Be Added for Solar Power

### 2.1 Solar input and charge regulation

No solar charging circuit exists on the current PCB. A production-grade addition requires at
minimum the following components, none of which are present:

1. **MPPT solar charge controller IC** - sits between the solar panel and the battery,
   maximizing panel power extraction while protecting the battery from overcharge and
   providing a stable output bus. Examples: Texas Instruments BQ24650 (lead-acid / LiFePO4
   compatible), CN3791 (simpler MPPT, single-cell lithium), or a module-level solution such
   as a Victron SmartSolar unit for higher powers.

2. **Battery pack** - a chemistry chosen for the outdoor temperature range. LiFePO4 (lithium
   iron phosphate) is strongly preferred for field use: better cycle life, flatter discharge
   curve, and safer thermal behavior than NMC/NCA. It requires a chemistry-appropriate
   charger and cell-level BMS (battery management system) for overdischarge protection.
   Sealed lead-acid (SLA / AGM) is a lower-cost alternative with lower energy density and
   more stringent temperature derating.

3. **Power-path / load switch** - a circuit that routes power from solar/battery to the
   system, prevents the battery from being pulled below a safe cut-off voltage during heavy
   load, and handles the transition gracefully when solar input drops at sunset. The J2 VBAT
   header has no such circuit.[^j2-vbat]

4. **Revised input voltage architecture** - the existing cascade assumes 12 V at J1. A
   LiFePO4 cell is nominally 3.2 V (12.8 V for a 4S pack). A 4S LiFePO4 pack is a
   workable fit for the existing 12 V input range, but the U1 buck and U2 LDO selection must
   be verified against the full charge/discharge voltage sweep (approximately 10.0-14.6 V for
   4S LiFePO4). A single-cell lithium or 12 V SLA pack could also be used with appropriate
   charge controller output configuration.

### 2.2 PCB redesign scope

The existing board is described as a **2-layer FR-4 concept design** not yet through full
schematic-capture review, footprint lock, or DRC/ERC cleanup.[^pcb-limits] The changes
needed for solar operation are substantial enough that they would produce a new board revision
rather than a rework of the current layout:

| Component / net | Current state | Solar addition required |
|---|---|---|
| J1 (12 V IN) | Mains or vehicle wiring | Battery output rail from charge controller |
| J2 (VBAT) | 2-pin reserved header, no circuit | Full charge IC, BMS, battery connector |
| U1 (5 V buck header) | External module placeholder | Verify input range vs battery sweep |
| U2 (3.3 V LDO) | Cascaded from 5 V | Unchanged if 5 V rail preserved; consider direct 3.3 V buck |
| Power-path IC | Absent | New IC footprint (ideal diode / load switch) |
| Charge controller IC | Absent | New IC footprint + MPPT sense resistors + passives |
| Battery fuel gauge | Absent | Optional but strongly recommended (I2C SOC readout) |
| Solar input TVS/EMI filter | Absent | Panel-side transient clamping, reverse-polarity protection |

The J4 sensor header exposes `I2C_SCL` on pin 3,[^j4-sensor] making it a natural attachment
point for a battery fuel-gauge IC (for example, Texas Instruments BQ27427 or Maxim MAX17048)
once the charge subsystem exists. No firmware or PCB changes to J4 itself are required to add
this peripheral.

---

## 3. Firmware Changes Required for Solar Viability

### 3.1 Enable ESP-IDF power management

`firmware/sdkconfig.defaults` does not contain `CONFIG_PM_ENABLE`, which is the gate for all
dynamic frequency scaling and automatic light-sleep on the ESP32.[^sdkconfig] Without it:

- The CPU is pinned at **240 MHz** at all times, including the 12.8 s ADC collection window
  when the processor is almost entirely idle inside `vTaskDelay()`.
- The Wi-Fi modem cannot enter sleep between beacon intervals.
- The APB bus remains at 80 MHz, holding peripheral clocks at maximum rate.

The minimum configuration additions:

```kconfig
# firmware/sdkconfig.defaults additions
CONFIG_PM_ENABLE=y
CONFIG_FREERTOS_USE_TICKLESS_IDLE=y   # required for automatic light-sleep
```

And in `app_main()` after Wi-Fi connects (`firmware/main/main.c`), a call to
`esp_pm_configure()` with appropriate `max_freq_mhz`, `min_freq_mhz`, and
`light_sleep_enable` fields, plus `esp_wifi_set_ps(WIFI_PS_MAX_MODEM)` (or `MIN_MODEM`)
after `wifi_sta_connect()` returns.[^esp-pm-docs]

### 3.2 Exploit idle time in the ADC collection window

`adc_sampler_collect_batch()` calls `vTaskDelay(pdMS_TO_TICKS(SAMPLE_INTERVAL_MS))` between
every pair of samples across the full 512-sample batch.[^adc-loop] At 25 ms per interval and
512 samples, the CPU is inside a FreeRTOS idle delay for roughly **12.3 of the 12.8 s
window**. With `CONFIG_PM_ENABLE` and tickless idle enabled, FreeRTOS will automatically
place the chip into light-sleep during each 25 ms gap, potentially reducing the effective
current draw from approximately 80-120 mA to under 1 mA for those intervals. This alone could
cut the energy per inference cycle by a large fraction without any restructuring of
application logic.

For the status-poll idle path (3 s `vTaskDelay` when status != `available`), modem-sleep with
DTIM wakeup is appropriate: Wi-Fi power saving `WIFI_PS_MAX_MODEM` allows the radio to sleep
between access point beacon intervals while maintaining association.[^esp-pm-docs]

### 3.3 Fix the provisioning mode power-failure trap

When Wi-Fi reconnection fails `MAX_RECONNECT_FAILURES` (= 3) consecutive times, `app_main()`
calls `enter_provisioning_mode()`.[^reconnect] That function:

1. Calls `disable_task_wdt()` - permanently disabling the 30 s hardware watchdog.[^prov-wdt]
2. Starts SoftAP (beacon transmitted continuously at full RF power).
3. Starts the HTTP provisioning server.
4. Calls `halt_forever()` - an infinite `vTaskDelay(1000)` loop that **never exits and never
   sleeps**.[^halt]

In a mains-powered deployment this is an acceptable maintenance mode. On a battery-backed
solar node it is a latent **high-power drain with no exit path**: the device will run at full
radio power indefinitely, with no watchdog to recover from a firmware fault, until a technician
connects to the provisioning AP and enters credentials. If this happens at night or during
cloudy weather, the battery will discharge to cut-off.

Mitigations to implement before any solar deployment:

- Add a **provisioning timeout** (for example, 15-30 minutes). If no client connects, enter
  deep sleep for a configurable retry interval (for example, 30 minutes), then repeat. Log a
  `STATUS_OFFLINE` or provisioning event to NVS so the reason for the outage is recoverable on
  next boot.
- **Re-enable a watchdog** during provisioning (with a longer timeout, for example, 5 minutes)
  so that a firmware fault during the provisioning HTTP loop still triggers a reset.
- Consider a **maximum retry count** for the provisioning loop before the device gives up and
  enters long-interval deep sleep, requiring a manual reset to recover.

### 3.4 Add battery state-of-charge awareness

Solar operation requires the firmware to respond to battery level. At minimum:

- **Low-voltage shutdown path:** detect a battery voltage or SOC threshold below which
  continued operation would damage the cell. Enter deep sleep with a timer wakeup to
  periodically re-check whether solar charging has resumed. The ESP32-WROOM-32 supports
  deep sleep at approximately 10-150 uA depending on the wakeup source configured.

- **Reduced-function mode:** when SOC is low but above the shutdown threshold, skip the
  12.8 s ADC collection cycle (the highest sustained draw) and post a reduced-power status
  to the backend. Continue polling status at a low rate only.

- **SOC input signal:** the hardware signal can come from a fuel-gauge IC on J4's I2C bus
  (once the charger subsystem is added) or from a resistor-divider on the battery voltage
  read by a spare ADC channel. Neither exists today.

### 3.5 OTA energy gate

The OTA subsystem (`firmware/main/ota_update.c`) uses `esp_https_ota` to download a full
firmware binary over TLS - typically 200-400 kB at maximum Wi-Fi throughput. This is the
longest sustained high-current event in the firmware. On a solar-battery node:

- OTA should be gated on battery SOC exceeding a safe threshold (for example, > 60%).
- The existing rollback infrastructure (`esp_ota_mark_app_invalid_rollback_and_reboot()`) is
  an adequate recovery mechanism if a download is interrupted by a voltage drop.
- OTA should preferably be scheduled during daylight hours when solar input is active.

No OTA gating logic exists today; this is a new code path.

---

## 4. Sensor and Enclosure Considerations

### 4.1 Photoresistor and panel placement coupling

The firmware samples a photoresistor on **GPIO 34 / ADC1_CH6** as the primary inference
input.[^fw-readme] If the photoresistor and the solar panel are mounted on the same enclosure
face, the panel will shadow the sensor at certain sun angles, and specular reflections off
the panel surface may artificially elevate the sensor reading. Panel placement and sensor
orientation must be treated as coupled constraints in the enclosure mechanical design.

### 4.2 Operating temperature range

Sealed outdoor enclosures in direct sun routinely reach 60-80 C internally on summer days in
temperate climates, and higher in desert environments. Binding temperature limits for
candidate components:

| Component | Typical max operating temp |
|---|---|
| ESP32-WROOM-32 | 85 C |
| LiFePO4 cell (charge) | ~45-60 C (varies by cell) |
| LiFePO4 cell (discharge) | ~60-70 C (varies by cell) |
| Sealed lead-acid / AGM | ~50 C continuous |
| Standard electrolytic capacitors | 85-105 C rated |

LiFePO4 is likely the binding constraint. The enclosure thermal design must maintain internal
temperature within battery chemistry limits, or a thermostatically controlled charge cutoff
must be added.

### 4.3 Ingress protection and connector sealing

The PCB connectors (J1-J5) are standard terminal blocks and pin headers with no specified IP
rating.[^pcb-bom] An outdoor solar installation requires:

- Weatherproof cable entry at each field connector (conduit fittings or IP-rated cable glands).
- Consideration of condensation on the PCB, particularly around the antenna keep-out region
  on U3 where a conformal coating must not be applied.
- Panel cable routing that avoids UV degradation and mechanical abrasion at enclosure
  penetrations.

### 4.4 ESP32 vs ESP32-S3 module discrepancy

The PCB README describes U3 as an **"ESP32-S3 module area"**,[^pcb-u3] while the firmware
and `sdkconfig.defaults` target the **ESP32-WROOM-32** (an original ESP32, not S3). These
modules have different package footprints, pin layouts, and power profiles. This discrepancy
must be resolved before ordering any new PCB revision that also incorporates the solar charge
subsystem. Both modules are usable targets for this application; the choice affects both PCB
layout and the specific deep-sleep / ULP architecture available for power management.

---

## 5. Sizing Guidance and Caveats

> **Critical caveat - do not size without measuring the lamp load first.**
>
> The sign or lamp load switched by Q1 is not characterized anywhere in the repository.
> The PCB README flags load-current measurement as a prerequisite for fabrication review
> (item 6 of its "Important current limitations" section).[^pcb-limits] A 3 W LED retrofit
> lamp and a 20 W traditional sign lamp differ by nearly a factor of seven in daily energy
> consumption. At typical panel derating factors, that difference alone spans the gap between
> a 10 W panel and a 60 W panel. **Any specific Wp or Ah number given without this
> measurement is not actionable.**

### 5.1 Approximate controller power (baseline reference only)

The following figures are drawn from Espressif's ESP32-WROOM-32 datasheet and the ESP-IDF
power management documentation. They represent typical values; actual in-circuit measurements
on this PCB may differ due to LDO inefficiency, leakage paths, and peripheral loads.

| Firmware / hardware state | Approx. controller current at 3.3 V | Notes |
|---|---|---|
| Active, 240 MHz, Wi-Fi TX burst | 200-240 mA | Peak only; brief during classify POST |
| Active, 240 MHz, Wi-Fi associated, CPU idle | **80-120 mA** | **Dominant state in current firmware** |
| Modem-sleep, CPU active, DTIM wakeup | 20-30 mA | Requires `esp_wifi_set_ps()` |
| Light-sleep (tickless idle, radio off) | < 1 mA | Requires `CONFIG_PM_ENABLE` + tickless idle |
| Deep sleep, RTC timer wakeup | 0.01-0.15 mA | Low-battery / no-sun fallback target |

**System efficiency note:** The 3.3 V LDO (U2) drops 1.7 V from the 5 V rail. At 100 mA
controller draw this dissipates approximately 170 mW as heat and makes the 12 V -> 5 V -> 3.3 V
path roughly 50-55% efficient for the controller load alone. A solar-optimized board revision
should replace the LDO with a direct 3.3 V synchronous buck from the battery rail to recover
this efficiency.

### 5.2 Sizing framework - fill in with real measurements

Once the lamp load is measured, apply this framework:

```
Daily energy (Wh):
  E_day = (P_controller_meas + P_lamp_meas) x hours_per_day_active

Battery capacity (Ah at system voltage V_bat):
  C_bat = E_day x autonomy_days / (V_bat x DoD)

  DoD = 0.80 for LiFePO4 (80% depth of discharge)
  DoD = 0.50 for sealed lead-acid

Panel rated power (Wp):
  P_panel = E_day / (PSH x eta_derating)

  PSH  = peak sun hours per day (3-5 h/day, location-dependent)
  eta_derating ~= 0.75-0.80 for dust, tilt angle error, temperature, and wiring losses
```

**Illustrative controller-only example (no lamp, current always-on firmware):**
Assuming 100 mA average at 3.3 V is approximately 0.33 W at the logic rail, and accounting
for the cascaded power conversion efficiency (approximately 55%), the 12 V input draw is
roughly 0.6 W for the controller alone, or approximately 50 mA from the 12 V bus. Over
24 hours this is approximately 14 Wh. At 4 peak sun hours and 0.75 derating:
approximately 5 W panel. For 3 days of autonomy with LiFePO4 at 80% DoD:
approximately 5 Ah at 12 V. These numbers are for the **controller only** and will be dwarfed
by any non-trivial lamp load. They are included solely as a framework sanity check, not a
specification.

---

## 6. Biggest Risks

| Risk | Severity | Basis |
|---|---|---|
| **Unknown lamp load** | **Critical** | Dominates the energy budget; no characterization exists in the repo. Cannot finalize any solar design without this measurement. |
| **Provisioning mode becomes a battery-drain trap** | **High** | `halt_forever()` + SoftAP active + no watchdog + no timeout: a unit that loses Wi-Fi credentials in the field will drain a battery to cut-off with no recovery path.[^halt][^prov-wdt] |
| **No low-voltage shutdown in firmware** | **High** | No code path exists to detect battery depletion. Deep discharge of LiFePO4 causes permanent cell damage. Requires both new hardware signal and new firmware handling. |
| **LDO thermal dissipation in sealed enclosure** | **Medium** | 3.3 V LDO from 5 V wastes approximately 34% of controller power as heat. In a sealed enclosure under direct sun this compounds the thermal management challenge. |
| **PCB U3 module footprint mismatch** | **Medium** | PCB README says ESP32-S3; firmware targets ESP32-WROOM-32. Any new board revision must resolve this before layout. Incorrect footprint would make the board unfabricable or unpopulatable.[^pcb-u3] |
| **No power-path management on J2** | **Medium** | Battery can be physically connected via J2 but cannot be safely charged or discharged without a charger IC and load switch. The header alone is not a functional circuit.[^j2-vbat] |
| **Enclosure temperature vs battery chemistry** | **Medium** | Sealed outdoor enclosures can exceed LiFePO4 charge temperature limits (approximately 45-60 C) on hot days. |
| **Wi-Fi reconnect adds sustained high-power retries** | **Low-Medium** | Three failures -> provisioning mode; each failed attempt uses a 20 s blocking connect timeout (`WIFI_CONNECT_TIMEOUT_MS = 20000`), meaning up to 60 s of maximum-current Wi-Fi activity per reconnect cycle before the provisioning trap is entered.[^reconnect] |
| **OTA mid-download voltage drop** | **Low** | Rollback partition exists and is exercised; risk is manageable but OTA should be gated on battery SOC before enabling over-the-air updates on a solar node. |

---

## 7. Recommended Next Steps

Listed in approximate dependency order.

1. **Measure the lamp/sign load.** Attach a current probe to J3 `VIN_FUSED` / `LAMP_RET`
   under normal duty conditions. This single measurement unlocks all subsequent sizing
   decisions and is the highest-value action on this list.

2. **Characterize controller power in-circuit.** Instrument the 12 V input rail and the
   3.3 V rail under real firmware execution: during an ADC batch window, during a Wi-Fi POST,
   and during the 3 s status-poll idle period. Compare with the datasheet estimates in §5.1.

3. **Enable power management on a firmware development branch.** Add `CONFIG_PM_ENABLE=y`,
   `CONFIG_FREERTOS_USE_TICKLESS_IDLE=y`, call `esp_pm_configure()` in `app_main()`, and
   call `esp_wifi_set_ps(WIFI_PS_MAX_MODEM)` after the Wi-Fi connect. Measure the resulting
   current profile against the baseline from step 2 to quantify achievable savings before
   committing to any hardware changes.

4. **Fix the provisioning mode power sink.** Add a configurable provisioning timeout (for
   example, 15 minutes). After timeout: deep-sleep for a retry interval, log to NVS, re-enable
   a watchdog during provisioning. This is a firmware-only change with no hardware dependency.

5. **Resolve the ESP32 / ESP32-S3 footprint discrepancy.** Decide the target module for the
   next PCB revision and update whichever of the PCB layout or the firmware target is
   incorrect. This must be settled before any new board is ordered.

6. **Design the new PCB power section.** With real load numbers in hand (step 1), select:
   battery chemistry and voltage, charge controller IC, load switch / power-path IC, and
   input topology. Treat J2 as a placeholder to be replaced by a complete charge-management
   subsystem. Design the 3.3 V conversion to bypass the LDO in favor of a direct buck.

7. **Thermal survey of the candidate enclosure.** Place a data logger inside a sealed
   prototype enclosure in direct sun. Confirm that internal temperatures remain within battery
   chemistry charge limits and within the ESP32 operating range.

8. **Add battery SOC awareness to firmware.** Wire a voltage divider or fuel-gauge IC to
   give the firmware a battery level signal. Implement the low-voltage shutdown path and
   the reduced-function mode described in §3.4. Gate OTA on SOC.

---

## 8. Confidence Assessment

| Claim | Confidence | Basis |
|---|---|---|
| CPU fixed at 240 MHz, no power management | **Verified** | `firmware/sdkconfig.defaults:10` confirms `CONFIG_ESP_DEFAULT_CPU_FREQ_240=y`; `CONFIG_PM_ENABLE` is absent |
| ADC batch = 512 samples x 25 ms = 12.8 s | **Verified** | `firmware/main/adc_sampler.h:10-11` and comment on line 22 |
| Wi-Fi always-on, no sleep policy | **Verified** | No `esp_wifi_set_ps()` call in `firmware/main/wifi_manager.c`; `CONFIG_PM_ENABLE` absent |
| Provisioning mode runs `halt_forever()` with WDT disabled | **Verified** | `firmware/main/main.c:36-40` (`halt_forever`), lines 43-53 (`disable_task_wdt`), lines 63-81 (`enter_provisioning_mode`) |
| J2 VBAT has no charger / power-path circuit | **Verified** | `hardware/hazard-hero-pcb-README.md:119` explicit statement |
| 12 V -> 5 V -> 3.3 V cascade | **Verified** | `hardware/hazard-hero-pcb-README.md:23-27` |
| PCB U3 labelled ESP32-S3; firmware targets WROOM-32 | **Verified** | `hardware/hazard-hero-pcb-README.md:48` vs `firmware/README.md:9` |
| Controller steady-state current 80-120 mA at 3.3 V | **Estimated** | Espressif datasheet typical values; not measured in-circuit on this specific board |
| LDO path efficiency approximately 50-55% | **Calculated** | Standard LDO behavior at stated voltages; actual depends on component selection and load |
| Rough sizing ranges in §5.2 | **Illustrative only** | Framework is sound; numbers depend entirely on lamp load measurement (unknown) |
| Lamp load contribution | **Unknown** | Not specified anywhere in the repository |

---

## Footnotes

[^pcb-flow]: `hardware/hazard-hero-pcb-README.md:23-28` - system-level power and signal
flow description.

[^j2-vbat]: `hardware/hazard-hero-pcb-README.md:119` - *"Reserved auxiliary or battery
connection point for future backup or ride-through support. The current layout does not yet
include a full charger or power-path management circuit around it."*

[^fw-readme]: `firmware/README.md:3-14` - confirms ESP32-WROOM-32 target, 512-sample batch,
12.8 s window, GPIO 34 ADC input, GPIO 2 LED, and that this firmware replaces the legacy
MicroPython runtime in `hardware/`.

[^sdkconfig]: `firmware/sdkconfig.defaults:10` - `CONFIG_ESP_DEFAULT_CPU_FREQ_240=y`.
`CONFIG_PM_ENABLE` is absent from this file.

[^main-loop]: `firmware/main/main.c:274-332` - the `while(true)` main loop body. Constants
`STATUS_POLL_INTERVAL_MS=3000` (line 25), `SEND_INTERVAL_MS=1000` (line 24),
`MAX_RECONNECT_FAILURES=3` (line 27) defined at lines 23-29.

[^adc-loop]: `firmware/main/adc_sampler.c:89-107` - `adc_sampler_collect_batch()` loop;
`vTaskDelay(pdMS_TO_TICKS(SAMPLE_INTERVAL_MS))` called between every consecutive sample pair.

[^prov-wdt]: `firmware/main/main.c:43-53` - `disable_task_wdt()` calls
`esp_task_wdt_delete()` and `esp_task_wdt_deinit()`, permanently removing the watchdog.
Called unconditionally at line 67 inside `enter_provisioning_mode()`.

[^halt]: `firmware/main/main.c:36-40` - `halt_forever()` is an infinite
`while(true) { vTaskDelay(pdMS_TO_TICKS(1000)); }` loop.

[^reconnect]: `firmware/main/main.c:159-197` - `reconnect_wifi()` calls
`wifi_sta_connect(ssid, password, WIFI_CONNECT_TIMEOUT_MS)` where
`WIFI_CONNECT_TIMEOUT_MS=20000` (line 29). Up to `MAX_RECONNECT_FAILURES=3` attempts before
`enter_provisioning_mode()` is called.

[^pcb-bom]: `hardware/hazard-hero-pcb-README.md:86-103` - component reference table; no IP
or environmental ratings are listed for any connector.

[^pcb-limits]: `hardware/hazard-hero-pcb-README.md:212-226` - "Important current
limitations"; item 6 explicitly calls out output-stage load-current review as a prerequisite
for fabrication.

[^pcb-u3]: `hardware/hazard-hero-pcb-README.md:48` - describes U3 as *"ESP32-S3 module
area"*. `firmware/README.md:9` and `firmware/sdkconfig.defaults:2` (comment) both specify
ESP32-WROOM-32.

[^j4-sensor]: `hardware/hazard-hero-pcb-README.md:131-136` - J4 SENSOR header: pin 1 `3V3`,
pin 2 `SENSOR_IN`, pin 3 `I2C_SCL`, pin 4 `GND`.

[^esp-pm-docs]: ESP-IDF Power Management documentation (ESP32 target) -
<https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/power_management.html>
- confirms `CONFIG_PM_ENABLE` is the prerequisite for DFS and automatic light-sleep, and that
`CONFIG_FREERTOS_USE_TICKLESS_IDLE` is required for automatic light-sleep to activate.
