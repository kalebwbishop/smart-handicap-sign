import RPi.GPIO as GPIO
import time
import numpy as np

GPIO.setmode(GPIO.BCM)

def capture(size, capture_duration=3):
    mpin = 19
    tpin = 26
    input_intensity = []

    GPIO.setup(mpin, GPIO.OUT)
    GPIO.setup(tpin, GPIO.OUT)
    GPIO.output(mpin, False)
    GPIO.output(tpin, False)

    start_batch = time.perf_counter()
    
    while start_batch + capture_duration > time.perf_counter():
        GPIO.setup(mpin, GPIO.OUT)
        GPIO.output(mpin, False)
        time.sleep(0.001)

        GPIO.setup(mpin, GPIO.IN)
        time.sleep(0.001)

        GPIO.output(tpin, True)
        starttime = time.perf_counter()
        endtime = starttime
        timeout = 0.4  # 100 ms timeout

        while GPIO.input(mpin) == GPIO.LOW:
            endtime = time.perf_counter()
            if endtime - starttime > timeout:
                print("Timeout reached")
                break

        measureresistance = endtime - starttime
        input_intensity.append(measureresistance)

    end_batch = time.perf_counter()
    batch_duration = end_batch - start_batch

    # Calculate Sampling Rate
    samples_per_second = len(input_intensity) / batch_duration
    print(f"Total Samples: {len(input_intensity)}")
    print(f"Batch Duration: {batch_duration:.2f} seconds")
    print(f"Sampling Rate: {samples_per_second:.2f} samples/sec")

    normalized_data = input_intensity - np.min(input_intensity)

    if np.max(normalized_data) == 0:
        return [0] * size

    normalized_data = normalized_data / np.max(normalized_data)

    # Use linear interpolation to extend the data
    extrapolated_data = np.interp(
        np.linspace(0, len(input_intensity) - 1, size),
        np.arange(len(input_intensity)),
        normalized_data
    )

    return extrapolated_data

if __name__ == '__main__':
    try:
        while True:
            input_intensity = capture(128)  # Capture 64 samples
            print(f"numbers1 = [{', '.join([f'{x}' for x in input_intensity])}]")
            time.sleep(0.5)
    except KeyboardInterrupt:
        GPIO.cleanup()
