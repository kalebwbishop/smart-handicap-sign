import numpy as np
import matplotlib.pyplot as plt

# Function to compute DFT manually
def compute_dft(signal):
    N = len(signal)
    dft_result = []
    
    for k in range(N):  # Loop over each frequency bin
        real_part = 0.0
        imag_part = 0.0
        
        for n in range(N):  # Loop over each time sample
            angle = 2 * np.pi * k * n / N
            real_part += signal[n] * np.cos(angle)
            imag_part += signal[n] * -np.sin(angle)
        
        # Combine real and imaginary parts into a complex number
        dft_result.append(complex(real_part, imag_part))
    
    return np.array(dft_result)

# Sampling parameters
Fs = 1000  # Sampling frequency
T = 1.0 / Fs  # Sampling interval
L = 1000  # Length of signal
t = np.linspace(0, L*T, L)  # Time vector

# Generate a signal with two frequencies
f1 = 200  # Frequency of the first sine wave
f2 = 120  # Frequency of the second sine wave
signal = np.sin(2 * np.pi * f1 * t) + np.sin(2 * np.pi * f2 * t)

# Perform manual DFT
dft_result = compute_dft(signal)

# Plot original signal
plt.figure(figsize=(10, 6))

plt.subplot(2, 1, 1)
plt.plot(t, signal)
plt.title("Original Signal")
plt.xlabel("Time (s)")
plt.ylabel("Amplitude")

# Plot manually computed DFT result (only positive frequencies)
plt.subplot(2, 1, 2)
plt.plot(t[:L//2], np.abs(dft_result[:L//2]))
plt.title("Frequency Spectrum (Manual DFT)")
plt.xlabel("Frequency (Hz)")
plt.ylabel("Amplitude")
plt.show()