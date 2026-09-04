from machine import Pin
import neopixel
import time

NUM_LEDS = 38
DATA_PIN = 13


np = neopixel.NeoPixel(Pin(DATA_PIN), NUM_LEDS)
brightness = 255 # Brightness level for the LEDs (0-255)

while True:
    # Red
    np.fill((brightness, 0, 0))
    np.write()
    print("Red")
    time.sleep(1)

    # Green
    np.fill((0, brightness, 0))
    np.write()
    print("Green")
    time.sleep(1)

    # Blue
    np.fill((0, 0, brightness))
    np.write()
    print("Blue")
    time.sleep(1)

    # Off
    np.fill((0, 0, 0))
    np.write()
    print("Off")
    time.sleep(1)