# Hazard Hero — Hardware Shopping List

## Production-Ready (Outdoor Deployment)

| # | Component | Product | Link | ~Price |
|---|-----------|---------|------|--------|
| 1 | Microcontroller | ESP32-S3-DevKitC-1 N16R8 (16MB Flash, 8MB PSRAM) | [Amazon](https://www.amazon.com/s?k=ESP32-S3-DevKitC-1+N16R8) | $10 |
| 2 | Gesture Sensor | SparkFun VCNL4040 Proximity Sensor Breakout (I2C, IR-based) | [Amazon](https://www.amazon.com/SparkFun-Proximity-Sensor-Breakout-VCNL4040/dp/B07P763YVM) · [SparkFun](https://www.sparkfun.com/sparkfun-proximity-sensor-breakout-20cm-vcnl4040-qwiic.html) | $8 |
| 3 | Status LED | BTF-LIGHTING WS2812B NeoPixel RGB LEDs (100pc bulk) | [Amazon](https://www.amazon.com/BTF-LIGHTING-WS2812B-Heatsink-10mm3mm-WS2811/dp/B01DC0J0WS) | $10 |
| 4 | Enclosure | QILIPSU IP67 Waterproof Junction Box (~110×80×70mm) | [Amazon](https://www.amazon.com/s?k=QILIPSU+IP67+junction+box+110x80) | $10 |
| 5 | Power Supply | Outdoor Waterproof 5V/2A USB Power Adapter | [Amazon](https://www.amazon.com/s?k=outdoor+usb+power+adapter+waterproof) | $10 |
| 6 | Cable Gland | M12 IP68 Waterproof Cable Gland (10pc) | [Amazon](https://www.amazon.com/Waterproof-Plastic-Connector-Protector-3-5-6mm/dp/B078SSCKLJ) | $7 |
| 7 | Pole Mount | Stainless Steel U-Bolt Clamp Bracket | [Amazon](https://www.amazon.com/Stainless-Bracket-Mounting-Hardware-Satellite/dp/B0D2BM2LK3) | $8 |
| 8 | Wires | ELEGOO 120pc Dupont Jumper Wire Kit (M/M, F/F, M/F) | [Amazon](https://www.amazon.com/s?k=ELEGOO+dupont+wire+kit) | $7 |
| 9 | Standoffs | PCB Nylon Standoff Kit (M2/M3 assortment) | [Amazon](https://www.amazon.com/s?k=PCB+nylon+standoff+kit+M3) | $8 |

**Estimated total: ~$78 per unit** (includes bulk items you'll have extras of)

---

## Development / Prototyping (Budget)

| # | Component | Product | Link | ~Price |
|---|-----------|---------|------|--------|
| 1 | Microcontroller | ESP32-WROOM-32E DevKit V4 | [Amazon](https://www.amazon.com/s?k=ESP32+DevKitC+V4) | $5 |
| 2 | Light Sensor | TEMT6000 Ambient Light Sensor Module (analog, drop-in LDR replacement) | [Amazon](https://www.amazon.com/TEMT6000-Sensor-Ambient-Intensity-Visible/dp/B09TBKY9CZ) | $3 |
| 3 | Breadboard | Half-size 400-tie breadboard | [Amazon](https://www.amazon.com/s?k=half+size+breadboard) | $3 |
| 4 | USB Cable | Micro-USB or USB-C (for power + flashing) | [Amazon](https://www.amazon.com/s?k=micro+usb+cable) | $3 |
| 5 | Wires | Dupont jumper wire assortment | [Amazon](https://www.amazon.com/s?k=ELEGOO+dupont+wire+kit) | $7 |

**Estimated total: ~$21 per unit**

---

## Notes

- **VCNL4040 vs TEMT6000**: The VCNL4040 uses IR proximity (works outdoors in any lighting). The TEMT6000 is a direct drop-in replacement for the current photoresistor with zero code changes but still struggles in direct sunlight.
- **WS2812B NeoPixels**: Only 1 LED is needed per sign, but they're sold in bulk packs of 100. Enables RGB color-coded status instead of blink-only patterns.
- **VCNL4040 availability**: Goes in and out of stock on Amazon US. If unavailable, order directly from [SparkFun](https://www.sparkfun.com/sparkfun-proximity-sensor-breakout-20cm-vcnl4040-qwiic.html) (~$6).
- **Power**: Wired 5V USB is recommended for signs near buildings. For remote signs without power access, see the solar power tier in the [full hardware research report](./docs/hardware-research.md) (if available).
