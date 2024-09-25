import serial

ser = serial.Serial('COM4', 9600, timeout=1)

while True:
    if ser.in_waiting:
        data = ser.readline().decode('utf-8').strip()
        print(data)