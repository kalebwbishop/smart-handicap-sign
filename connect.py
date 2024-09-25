import serial
import time
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import numpy as np

from detection import check_hazard_lights

mac_port = '/dev/cu.usbmodem101'
windows_port = 'COM3'

ser = serial.Serial(windows_port, 9600, timeout=1)
time.sleep(2)

signal_limit = 2 ** 9
signal = np.zeros(signal_limit)
signal_idx = 0
signal_ititialized = False

# Lists to store time and data
x_data = np.linspace(0, signal_limit - 1, signal_limit)

fig, ax_signal = plt.subplots(1, 1)
ax_signal.set_xlim(0, signal_limit - 1)
ax_signal.set_ylim(0, 1023)
line_signal, = ax_signal.plot([], [], lw=2)

def init():
    """Initialize the plot with empty data."""
    line_signal.set_data(x_data, np.zeros(signal_limit))
    return line_signal,

def update(_):
    """Update the plot with new data."""
    global signal_idx, signal_ititialized

    while ser.in_waiting:

        if signal_idx == 0 and signal_ititialized:
            check_hazard_lights(signal, 1000/25)

        signal_ititialized = True

        data = ser.readline().decode('utf-8').strip()            

        if data.isdigit():
            y_value = int(data)
            signal[signal_idx] = y_value

            signal_idx = (signal_idx + 1) % signal_limit

        # Update the plot with the new signal data
        line_signal.set_data(x_data, signal)

    return line_signal,

if __name__ == '__main__':
    ani = FuncAnimation(fig, update, init_func=init, blit=True, interval=100, cache_frame_data=False)

    plt.legend()
    plt.show()