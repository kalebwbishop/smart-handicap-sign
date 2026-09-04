## WS2812B LED test

This MicroPython test drives a 38-pixel WS2812B strip from an ESP32. It
alternates between solid green and off, holding each state for five seconds.

Default configuration:

- `LED_DATA_PINS`: usable output GPIOs tested one at a time
- `NUM_LEDS`: 38
- `BRIGHTNESS`: 128
- Color order: RGB values passed to MicroPython's `neopixel` driver

Copy `main.py` to the ESP32 as the runtime entry point. Connect the strip's
regulated 5 V and GND to the buck converter, connect ESP32 GND to the same
ground, and route the strip's `DIN` through a 330-470 ohm resistor to the GPIO currently
being tested. The firmware clears every strip before lighting the current pin.
A 1000 uF capacitor across the strip supply is recommended.

### Run on an ESP32

Install the host tools:

```powershell
python -m pip install esptool mpremote
```

Find the board's serial port in Windows Device Manager, then replace `COM3`
below if needed. For a fresh ESP32, download the generic firmware from
<https://micropython.org/download/ESP32_GENERIC/> and flash it:

```powershell
python -m esptool --port COM3 chip-id
python -m esptool --port COM3 erase-flash
python -m esptool --port COM3 --baud 460800 write-flash 0x1000 ESP32_GENERIC.bin
```

Copy the test to the board and restart it:

```powershell
python -m mpremote connect COM3 fs cp .\main.py :main.py
python -m mpremote connect COM3 reset
python -m mpremote connect COM3 repl
```

The test starts automatically after reset. Verify the deployed file with:

```powershell
python -m mpremote connect COM3 fs sha256sum :main.py
```
python -m mpremote connect COM3 fs cp .\main.py :main.py && python -m mpremote connect COM3 reset && python -m mpremote connect COM3 repl