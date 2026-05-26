# Hazard Hero PCB

This document describes the controller PCB exported as `hazard-hero-easyeda-pcb.json`.

> **Solar assumption for this revision:** assume a **10 W solar panel** is used in the field,
> but only **through a low-cost external non-MPPT solar charge controller and battery
> subsystem**. This PCB does **not** accept a panel directly and does **not** integrate charge
> control, battery protection, or power-path management.

At a high level, this board is the electrical backbone for a connected accessible parking sign node. It accepts field power, protects and regulates it, hosts the main controller module, provides an interface for an external modem/GNSS daughtercard, switches a sign or lamp load, reads external sensors, and exposes service connections for setup and maintenance.

## What the PCB does as a whole

In normal use, the board is intended to:

1. Accept a nominal 12 V input from the field wiring or from an external solar battery/charge-controller output.
2. Protect that input against overcurrent and transient spikes.
3. Convert the input rail into 5 V and then 3.3 V for logic electronics.
4. Host the main controller module that coordinates sensing, communications, and output control.
5. Provide a header for an external modem/GNSS module when wide-area connectivity is needed.
6. Drive a sign, lamp, or other field output through a MOSFET-based low-side switch.
7. Bring in external sensor signals and expose a UART/service header for setup and debug.

## System-level signal and power flow

The intended flow through the board is:

`12V input -> fuse/current limit -> TVS surge clamp -> 5V buck stage -> 3.3V LDO -> controller and low-voltage I/O`

The sign output path is:

`VIN_FUSED -> external sign/lamp load -> LAMP_RET -> Q1 low-side MOSFET -> GND`

That means the load connected to the sign output is powered from the fused supply and switched on the return side by the MOSFET.

## Major functional blocks

### 1. Power entry and protection

This section receives the incoming 12 V supply and makes it safe for the rest of the board.
For a solar-backed deployment, that 12 V rail is assumed to come from an **external 10 W solar
power subsystem**, not from the panel directly.

- **J1** is the main 12 V field power input. In a solar deployment it should be fed by the
  regulated output of a low-cost external PWM or fixed-voltage solar charge controller /
  battery pack sized around a 10 W panel.
- **F1** is the first protection element in series with VIN and is intended to act as a resettable fuse or current-limit placeholder.
- **D1** is a TVS diode that clamps spikes, surges, and other fast transients on the input rail.
- **U1** is a header/footprint area for an external buck regulator module that converts the protected input into 5 V.
- **U2** is a 3.3 V linear regulator that creates the main logic rail from 5 V.
- **D2 + R3** create a simple power-good indicator LED on the low-voltage rail.

### 2. Compute and control

This section is the local controller core.

- **U3** is the ESP32-S3 module area. It is the main controller footprint and breakout region.
- The controller is responsible for reading sensor inputs, managing output control, handling local service access, and interfacing with the modem header.
- An **antenna keep-out** region is marked so nearby copper, metal, or enclosure features do not interfere with the radio section of the module.

### 3. Communications expansion

This section allows the controller board to work with an external communications module.

- **U4** is a 2x10 header intended for a modem/GNSS daughtercard.
- The routed core signals include power and UART.
- Additional pads are present for modem control, USB, SIM, antenna, wake/status, and future expansion signals.

This makes the PCB a baseboard/controller board rather than a fully self-contained radio board.

### 4. High-current output stage

This section drives the sign or lamp load.

- **Q1** is a DPAK MOSFET used as the low-side switch.
- **R2** is a 100 ohm gate resistor between the controller output and the MOSFET gate.
- **J3** exposes the field-side sign interface, including fused supply, switched return, sensor input, and ground.

The low-side topology is simple and practical for switching loads, but the connected field device must be wired with that arrangement in mind.

### 5. Sensor and service access

This section provides low-voltage access for external peripherals and technicians.

- **J4** is the sensor header.
- **J5** is the UART/service header for setup, programming, recovery, or maintenance access.
- **J2** is a reserved auxiliary/battery header. In the current layout it is more of a provision
  point than a complete battery-management subsystem, and it is not a direct solar-panel input.

### 6. Mechanical support

- **H1-H4** are M3 mounting holes used to secure the PCB inside the sign enclosure or carrier.

## Component-by-component guide

| Ref | Block / package | What it does |
|---|---|---|
| **J1** | 2-pin terminal, `12V IN` | Main field power input for the board. For a solar-backed install, feed this from the regulated 12 V output of an external low-cost non-MPPT charge controller / battery subsystem sized around a 10 W panel. |
| **F1** | Series protection element, `PTC` placeholder | Limits fault current on the incoming VIN rail before power reaches the rest of the board. |
| **D1** | TVS diode, `TVS` | Clamps surge and transient events on the input supply. |
| **U1** | Buck module header, `5V BUCK` | Footprint/header area for an external DC/DC converter that generates the 5 V rail. |
| **U2** | SOT-223 regulator, `3V3 LDO` | Generates the 3.3 V logic rail for the controller and low-voltage interfaces. |
| **J2** | 2-pin terminal, `VBAT` | Reserved auxiliary/battery connection point for future backup or ride-through support. It is not a direct panel input and does not have on-board charge management. |
| **U3** | ESP32-S3 module area | Main controller footprint and breakout region. Intended to run local control, sensing, and communications interfacing. |
| **U4** | 2x10 modem/GNSS header, `MODEM HDR` | Expansion header for an external modem/GNSS daughtercard. |
| **Q1** | DPAK MOSFET, `MOSFET` | Low-side switch for the sign or lamp load. |
| **R2** | 0603 resistor, `100R` | Gate resistor for Q1; helps tame switching edges and protects the controller pin. |
| **D2** | 0603 LED, `PWR` | Power indicator LED showing that the low-voltage rail is present. |
| **R3** | 0603 resistor, `1K` | Current-limiting resistor for the power LED. |
| **J3** | 4-pin terminal, `SIGN IO` | Main field I/O connector for the sign load and one sensor input. |
| **J4** | 1x4 header, `SENSOR` | Low-voltage sensor header for simple external sensing connections. |
| **J5** | 1x6 header, `UART` | Service/programming/debug header for direct board access. |
| **H1-H4** | M3 mounting holes | Mechanical attachment points for the PCB. |

## Connector and interface summary

### J1 - 12V IN

- **Pin 1:** VIN
- **Pin 2:** GND

Main board power enters here.

For a solar deployment, **do not connect a 10 W panel directly to J1**. J1 should only see the
regulated output of an external non-MPPT charge controller / battery subsystem.

### J2 - VBAT

- **Pin 1:** VBAT
- **Pin 2:** GND

Reserved auxiliary or backup power connection. The current layout does not yet include a full
charger or power-path management circuit around it, so **do not connect a solar panel directly
to J2**.

### J3 - SIGN IO

- **Pin 1:** `VIN_FUSED`
- **Pin 2:** `LAMP_RET`
- **Pin 3:** `SENSOR_IN`
- **Pin 4:** `GND`

This is the primary field connector. A typical load would connect between `VIN_FUSED` and `LAMP_RET`, with `LAMP_RET` being switched by Q1.

### J4 - SENSOR

- **Pin 1:** `3V3`
- **Pin 2:** `SENSOR_IN`
- **Pin 3:** `I2C_SCL`
- **Pin 4:** `GND`

This is a light sensor/peripheral header for simple external sensing or future accessory hardware.

### J5 - UART

- **Pin 1:** `3V3`
- **Pin 2:** `GND`
- **Pin 3:** `UART_TXD`
- **Pin 4:** `UART_RXD`
- **Pin 5:** `EN`
- **Pin 6:** `IO0`

This header is intended for service access, boot mode control, recovery, and direct serial interaction with the controller module.

### U4 - MODEM HDR

The daughtercard header exposes the board's communications expansion interface. In the current layout, the most important routed signals are:

- `5V`
- `GND`
- `MODEM_RX`
- `MODEM_TX`

Pads are also reserved for modem control and future functions such as:

- `PWRKEY`
- `NETSTAT`
- `SIM_IO`
- `SIM_CLK`
- `SIM_RST`
- `ANT`
- `ANT_GND`
- `USB_DP`
- `USB_DM`
- `WAKE`
- `STATUS`

## How the main components work together

When field power enters through **J1**, it first passes through **F1**, then sees surge
protection at **D1**. The protected rail feeds **U1**, which is expected to generate **5 V**.
That 5 V rail then feeds **U2**, which produces the **3.3 V** logic rail used by the controller
and low-voltage interfaces.

Under the **10 W solar-panel assumption**, the board still expects a regulated 12 V input at
**J1**. The panel, a low-cost external non-MPPT charge controller, battery pack, and
low-voltage disconnect all remain external to this PCB revision.

The controller module at **U3** uses that logic rail and interacts with external hardware through **J4**, **J5**, and **U4**. When the controller needs to switch a sign or lamp load, it drives **Q1** through **R2**. The load itself is connected through **J3**, where it sees fused supply on one side and MOSFET-switched return on the other.

The power LED made by **D2** and **R3** gives a quick visual confirmation that the low-voltage logic rail is alive.

## Manufacturing and design assumptions

This README reflects the current PCB concept as laid out in the EasyEDA JSON file. The silkscreen notes on the board assume:

- **2-layer FR-4**
- **1.6 mm board thickness**
- **1 oz copper**
- Nominal **12 V** field input
- External **5 V buck module**
- Local **3.3 V** regulation on-board

### Solar deployment assumption

For planning purposes, this board can be considered part of a solar-backed system built around:

- A nominal **10 W solar panel**
- An **external low-cost non-MPPT** solar charge controller (PWM or fixed-voltage charger)
- An **external** battery pack sized for the site autonomy target
- A regulated **12 V output** delivered to **J1**

This assumption favors **lower cost over maximum energy harvest**. For a modest 10 W panel,
discarding MPPT is reasonable if the project can tolerate lower charging efficiency in weak sun,
temperature swings, or suboptimal panel orientation.

This assumption does **not** mean the board is itself solar-ready. A true integrated solar
revision would still need an on-board charger, power-path management, battery protection, and
likely a more efficient 3.3 V conversion stage.

## Estimated cost

These numbers are rough order-of-magnitude estimates for the current board concept, not vendor quotes.

| Scope | Rough cost |
|---|---:|
| Bare 2-layer PCB | **$3-8** |
| Assembled controller PCB | **$25-40** |
| Add modem/GNSS daughtercard and antenna | **+$20-45** |
| Add external solar kit (10 W panel, non-MPPT charge controller, battery, harnessing) | **+$30-70** |
| Add enclosure, harnessing, and final assembly | **+$20-35** |
| Estimated finished field unit with external 10 W solar subsystem | **$105-210** |

### What the estimate assumes

- Low-volume prototype or pilot-build quantities, not mass production.
- The communications hardware remains on an external daughtercard rather than being integrated directly onto the main PCB.
- The 5 V conversion stage is still treated as a module/header item rather than a fully integrated custom power stage.
- The estimate is centered on the controller board and nearby integration hardware, not a complete certified product program.
- The solar line item assumes a modest **10 W** panel with a lower-cost **non-MPPT** external charger and keeps all charging/battery hardware external to this PCB.

## Important current limitations

This board is best understood as a solid hardware direction and board-level concept, not a fully signed-off production release. Before fabrication for field use, it should still go through:

1. Full schematic capture review against the PCB.
2. Final footprint and BOM lock.
3. Decoupling and regulator stability review.
4. DRC/ERC cleanup and manufacturability review.
5. Thermal, surge, ESD, and EMC validation.
6. Output-stage load-current review for the actual lamp/sign hardware.
7. RF review around the controller antenna region and any modem daughtercard used.
8. External solar power-chain validation if deploying with the assumed **10 W** panel, including non-MPPT charge controller selection, battery sizing, low-voltage disconnect, and enclosure thermal review.

## Related file

- `hazard-hero-easyeda-pcb.json` - EasyEDA-style PCB JSON for this board
