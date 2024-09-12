import serial
import time
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation
import numpy as np

# Replace 'COM3' with your port, in this case '/dev/cu.usbmodem101'
mac_port = '/dev/cu.usbmodem101'
windows_port = 'COM5'

ser = serial.Serial(windows_port, 9600, timeout=1)
time.sleep(2)  # Give some time for the connection to be established

signal_limit = 2 ** 8
signal = [0] * signal_limit
signal_idx = 0

# Lists to store time and data
x_data = np.linspace(0, signal_limit, signal_limit)

fig, (ax_signal, ax_dft) = plt.subplots(2, 1)
ax_signal.set_xlim(0, signal_limit)  # Setting up initial X axis limit
ax_signal.set_ylim(0, 1023)  # Assuming analog input with range 0-1023 (modify as per your data range)
line_signal, = ax_signal.plot([], [], lw=2)

# Line for the detected wave from DFT
line_detected_wave, = ax_signal.plot([], [], lw=2, label='Detected Wave', color='red')

# Placeholder for the detected frequency wave
detected_wave = np.zeros(signal_limit)

# Setup for DFT plot
freq_data = np.fft.fftfreq(signal_limit, d=0.025)  # Frequency components, sampling every 25ms
line_dft, = ax_dft.plot([], [], lw=2)
ax_dft.set_xlim(0, signal_limit // 2)  # We only plot positive frequencies
ax_dft.set_ylim(0, signal_limit)  # Adjust this depending on your magnitude range

def init():
    """Initialize the plot with empty data."""
    line_signal.set_data([], [])
    line_detected_wave.set_data([], [])
    line_dft.set_data([], [])
    return line_signal, line_detected_wave, line_dft

def update(frame):
    """Update the plot with new data."""
    global signal_idx, detected_wave

    while ser.in_waiting:
        data = ser.readline().decode('utf-8').strip()            

        if data.isdigit():
            y_value = int(data)
            signal[signal_idx] = y_value

            signal_idx = (signal_idx + 1) % signal_limit

        # Update the plot with the new signal data
        line_signal.set_data(x_data, smooth_signal(signal))

        # Perform DFT and plot the corresponding wave when buffer is full
        if signal_idx == 0:
            magnitude = compute_dft(signal, signal_limit)
            line_dft.set_data(range(20, len(magnitude) // 2), magnitude[20 :len(magnitude) // 2])  # Only plot positive frequencies

            # Detect hazard light (1-2 Hz)
            detect_hazard_light(magnitude)
    
    return line_signal, line_detected_wave, line_dft

def compute_dft(signal, N):
    # Perform the Fast Fourier Transform (FFT)
    fft_result = np.fft.fft(signal)
    
    # Compute the magnitude of the frequency components
    magnitude = np.abs(fft_result) / N  # Normalize by N
    
    # Return the magnitudes of the frequency components
    return magnitude

def smooth_signal(signal, window_size=5):
    """Apply a simple moving average to smooth the signal."""
    return np.convolve(signal, np.ones(window_size)/window_size, mode='same')

def detect_hazard_light(magnitude):
    # We expect 1-2 Hz hazard light frequency
    # Find corresponding indices in the FFT results based on the frequency bin size
    sampling_rate = 40  # 40 Hz sampling rate
    N = signal_limit  # Number of samples

    # Calculate the frequency resolution
    freq_resolution = sampling_rate / N

    # Find the bins corresponding to 1-2 Hz
    bin_1_hz = int(1 / freq_resolution)
    bin_2_hz = int(2 / freq_resolution)

    # Look for dominant peaks in the 1-2 Hz range
    peak_magnitude = np.max(magnitude[bin_1_hz:bin_2_hz])

    # Define a dynamic threshold based on the global maximum
    global_max = np.max(magnitude)
    dynamic_threshold = global_max * 0.1  # Adjust this factor based on sensitivity

    # Check if the peak in the 1-2 Hz range exceeds the dynamic threshold
    if peak_magnitude > dynamic_threshold:
        print(True)

if __name__ == '__main__':
    # Set up the animation to update every 100ms with cache_frame_data disabled
    ani = FuncAnimation(fig, update, init_func=init, blit=True, interval=100, cache_frame_data=False)

    # Show the plot window
    plt.legend()
    plt.show()