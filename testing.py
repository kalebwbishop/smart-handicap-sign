import serial
from time import sleep

ser = serial.Serial('COM4', 9600, timeout=1)
sleep(2)

while True:
    while ser.in_waiting:
        data = ser.readline().decode('utf-8').strip()

        print(data)

        if data.isdigit():
            y_value = int(data)
            print(y_value)

    sleep(0.1)