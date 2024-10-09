import serial
from time import sleep
import matplotlib.pyplot as plt

ser = serial.Serial('COM5', 115200, timeout=1)
sleep(2)

input_data = [0] * 256
input_index = 0

while True:
    while ser.in_waiting:
        data = ser.readline().decode('utf-8').strip()

        if data.isdigit():
            y_value = int(data)
            print(input_index)
            input_data[input_index] = y_value
            input_index += 1

            if input_index == 256:
                input_index = 0

                plt.plot(input_data)
                plt.xlabel('Sample Index')
                plt.ylabel('Y Value')
                plt.title('Serial Data Plot')
                plt.show()

    sleep(0.1)