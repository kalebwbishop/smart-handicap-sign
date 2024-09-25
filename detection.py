import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import butter, filtfilt, welch, correlate, find_peaks

from send_notification import send_push_notification

flattening_factor = 3

def check_hazard_lights(intensity, fs):
    """
    Check for hazard lights from the signal intensity using FFT and peak detection.
    
    Parameters:
    intensity: numpy array
        The array of intensity values over time (the signal).
    fs: int
        The sampling frequency of the signal (default is 100 Hz).
    """

    # Function to design a Butterworth bandpass filter
    def butter_bandpass(lowcut, highcut, fs, order=4):
        nyquist = 0.5 * fs
        low = lowcut / nyquist
        high = highcut / nyquist
        b, a = butter(order, [low, high], btype='band')
        print(b, a)
        return b, a

    # Apply the bandpass filter to the signal
    def bandpass_filter_og(data, lowcut, highcut, fs, order=4):
        b, a = butter_bandpass(lowcut, highcut, fs, order=order)
        y = filtfilt(b, a, data)
        return y
    
    def bandpass_filter(input_intensity, lowcut, highcut, fs, order=4):
        b, a = butter_bandpass(lowcut, highcut, fs, order=order)

    #     b = [ 5.84514243e-08,  0.00000000e+00, -2.33805697e-07,  0.00000000e+00,
    # 3.50708546e-07,  0.00000000e+00, -2.33805697e-07,  0.00000000e+00,
    # 5.84514243e-08]  # Example coefficients, replace with your own
    #     a = [  1., -7.70008538, 26.15293176, -51.16503217, 63.05575405,
    # -50.12557952, 25.10110048, -7.24026236, 0.92118193]  # Example coefficients, replace with your own

            # Initialize filter state variables
        y = [0] * len(input_intensity)  # Filtered data output
        z = [0] * max(len(b), len(a))  # Filter memory for IIR filter

        # Apply IIR filtering process
        for i in range(len(input_intensity)):
            # Direct form II transposed structure (IIR)
            y[i] = b[0] * input_intensity[i] + z[0]
            for j in range(1, len(b)):
                z[j - 1] = b[j] * input_intensity[i] - a[j] * y[i] + (z[j] if j < len(z) else 0)
        
        return y

    # Generate more random-like signal with a faint 1.5 Hz component
    # fs = 100  # Sampling rate in Hz
    t = np.linspace(0, len(intensity) / fs, len(intensity))  # Time array for 10 seconds
    # Simulated noisy signal: 1.5 Hz sine wave + noise
    intensity = 0.1 * np.sin(2 * np.pi * 1.5 * t) + np.random.randn(len(t))

    # Define the frequency range to filter (around 1.5 Hz)
    lowcut = 1.4  # Lower bound of the bandpass filter
    highcut = 1.6  # Upper bound of the bandpass filter

    # Apply the bandpass filter
    filtered_signal = bandpass_filter(intensity, lowcut, highcut, fs)

    # Power Spectral Density (PSD) analysis
    frequencies, psd = welch(filtered_signal, fs, nperseg=1024)

    # Set a threshold to detect the presence of the 1.5 Hz signal
    threshold = (np.mean(intensity) * (np.max(intensity) - np.min(intensity))) ** 0.5  # This value might need to be adjusted based on the noise level and signal strength
    signal_detected = False

    # Check if any PSD value near 1.5 Hz exceeds the threshold
    target_frequency = 1.5
    tolerance = 0.05  # Frequency tolerance to consider around 1.5 Hz
    for freq, power in zip(frequencies, psd):
        if target_frequency - tolerance <= freq <= target_frequency + tolerance:
            if power > threshold:
                signal_detected = True
                break

    plt.figure(figsize=(10, 4))
    plt.plot(psd, label='Correlation with 1.5 Hz Sine Wave')
    plt.title('Matched Filtering - Detecting 1.5 Hz Signal')
    plt.xlabel('Time [seconds]')
    plt.ylabel('Correlation Amplitude')
    plt.legend()
    plt.show()

    # Print result: True if the signal is detected, False otherwise
    print(f"Threshold: {threshold}")
    print(f"Signal detected: {signal_detected}")

    if signal_detected:
        # send_push_notification("device_token")
        pass


if __name__ == '__main__':
    fs = 1000 / 25  # Sampling frequency (25 Hz)
    t = np.linspace(0, 2 ** 9 / fs, 2 ** 9, endpoint=False)
    intensity = np.sin(2 * np.pi * 1.5 * t) + 0.1 * np.random.randn(len(t))

    check_hazard_lights(intensity, fs)
