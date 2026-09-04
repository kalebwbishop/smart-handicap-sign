## WS2812B LED test

The test firmware drives a WS2812B strip from an ESP32 using the ESP-IDF
`led_strip` RMT backend.

At runtime, it turns the strip solid green for 5 seconds, turns it off for
5 seconds, and repeats. Change the `LED_TEST_STEP_INTERVAL_MS` definition in
`main/main.c` to adjust either interval.

Default configuration:

- `DATA_PIN`: GPIO4
- `NUM_LEDS`: 8
- `BRIGHTNESS`: 128
- Color order: GRB

Connect the buck converter's regulated 5 V and GND to the strip, connect the
ESP32 GND to the same ground, and route GPIO4 through a 330-470 ohm resistor
to the strip's `DIN`. A 1000 uF capacitor across the strip supply is
recommended. Configure the strip for 5.0 V before connecting it.