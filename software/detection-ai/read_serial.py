import serial
import matplotlib.pyplot as plt
import numpy as np
import json

def read_floats_from_serial(port, baudrate=115200, timeout=1):
    ser = serial.Serial(port, baudrate, timeout=timeout)
    array = np.array([])
    skip_first = True
    while True:
        try:
            line = ser.readline().decode('utf-8').strip()
            if line:
                if skip_first:
                    skip_first = False
                    continue
                float_value = int(line)
                array = np.append(array, float_value)
                print(len(array), float_value)
            
            if len(array) == 2000:
                print(f"Range of values: {np.min(array)} to {np.max(array)} with difference of {np.max(array) - np.min(array)}")


                with open('raw_negative.json', 'w') as f:
                    json.dump(array.tolist(), f, indent=4)

                plt.plot(array)
                plt.ylim(0, 4096)
                plt.show()
                array = np.array([])
                line = ser.read_all()
                skip_first = True

        except ValueError:
            print("Received non-float data")
        except KeyboardInterrupt:
            print("Exiting...")
            break

    ser.close()
    return array

if __name__ == "__main__":
    port = 'COM3'  # Replace with your serial port
    read_floats_from_serial(port)



