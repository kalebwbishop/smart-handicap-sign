import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import butter, filtfilt, welch, correlate, find_peaks, lfilter

from send_notification import send_push_notification

def check_hazard_lights(intensity, fs):
    print("[" + ", ".join(map(str, intensity)) + "]")
    """
    Check for hazard lights from the signal intensity using FFT and peak detection.
    
    Parameters:
    intensity: numpy array
        The array of intensity values over time (the signal).
    fs: int
        The sampling frequency of the signal (default is 100 Hz).
    """

    def manual_lfilter(b, a, x, zi=None):
        # Ensure a[0] is 1 for stability, normalize if necessary
        if a[0] != 1:
            b = b / a[0]
            a = a / a[0]

        # Initialize output array
        y = np.zeros_like(x)
        
        # If initial conditions are not provided, default to zero
        if zi is None:
            zi = np.zeros(max(len(a), len(b)) - 1)

        # Lengths of filter coefficients
        M = len(b)  # Length of the numerator (feed-forward coefficients)
        N = len(a)  # Length of the denominator (feedback coefficients)

        # Iterate over each sample in the input signal x
        for n in range(len(x)):
            # Calculate the current output sample y[n]
            y_n = 0

            # Apply the numerator (b) part: sum b[i] * x[n-i]
            for i in range(M):
                if n - i >= 0:  # Avoid out-of-bounds
                    y_n += b[i] * x[n - i]

            # Apply the denominator (a) part: sum -a[i] * y[n-i]
            for i in range(1, N):  # Skip a[0] since it's normalized
                if n - i >= 0:  # Avoid out-of-bounds
                    y_n -= a[i] * y[n - i]

            # Store the result in the output signal
            y[n] = y_n

        return y

    def manual_filtfilt(b, a, x):
        # Forward pass: filter the signal in the forward direction using manual_lfilter
        y_fwd = manual_lfilter(b, a, x)
        
        # Reverse the filtered signal
        y_fwd_rev = y_fwd[::-1]
        
        # Backward pass: filter the reversed signal again using manual_lfilter
        y_bwd = manual_lfilter(b, a, y_fwd_rev)
        
        # Reverse the backward filtered signal to get the final output
        y_filt = y_bwd[::-1]
        
        return y_filt

    # Function to design a Butterworth bandpass filter
    def butter_bandpass(lowcut, highcut, fs, order=4):
        nyquist = 0.5 * fs
        low = lowcut / nyquist
        high = highcut / nyquist
        b, a = butter(order, [low, high], btype='band')
        return b, a

    # Apply the bandpass filter to the signal
    def bandpass_filter(data, lowcut, highcut, fs, order=4):
        b, a = butter_bandpass(lowcut, highcut, fs, order=order)
        y = manual_filtfilt(b, a, data)
        return y
    
    # Generate more random-like signal with a faint 1.5 Hz component
    # fs = 100  # Sampling rate in Hz
    t = np.linspace(0, len(intensity) / fs, len(intensity))  # Time array for 10 seconds
    # Simulated noisy signal: 1.5 Hz sine wave + noise
    # intensity = 0.1 * np.sin(2 * np.pi * 1.5 * t) + np.random.randn(len(t))

    # Define the frequency range to filter (around 1.5 Hz)
    lowcut = 1.4  # Lower bound of the bandpass filter
    highcut = 1.6  # Upper bound of the bandpass filter

    # Apply the bandpass filter
    filtered_signal = bandpass_filter(intensity, lowcut, highcut, fs)

    # Power Spectral Density (PSD) analysis
    frequencies, psd = welch(filtered_signal, fs, nperseg=1024)

    # Set a threshold to detect the presence of the 1.5 Hz signal
    print(f"Mean intensity: {np.mean(intensity)}")
    print(f"Max intensity: {np.max(intensity)}")
    print(f"Min intensity: {np.min(intensity)}")

    threshold = pow((np.mean(intensity) * (np.max(intensity) - np.min(intensity))), 0.5)  # This value might need to be adjusted based on the noise level and signal strength
    signal_detected = False

    # Check if any PSD value near 1.5 Hz exceeds the threshold
    target_frequency = 1.5
    tolerance = 0.3  # Frequency tolerance to consider around 1.5 Hz
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
