import pyfirmata
import numpy as np
import matplotlib.pyplot as plt

# Define the data generation function
def generate_data(x: list):
    return [np.sin(i) for i in x]

# x axis values 
x = [0.2 * i for i in range(0, 100, 1)]
# corresponding y axis values
y = generate_data(x)

# Compute FFT of y values
y_fft = np.fft.fft(y)
freqs = np.fft.fftfreq(len(y), d=0.2)  # Assuming the sample spacing is 0.2

# Create subplots
fig, axs = plt.subplots(2, 1, figsize=(10, 8))

# Plot the original data
axs[0].plot(x, y)
axs[0].set_title('Original Data')
axs[0].set_xlabel('x - axis')
axs[0].set_ylabel('y - axis')

# Plot the FFT data (magnitude of the FFT)
axs[1].plot(np.abs(freqs), np.abs(y_fft))
axs[1].set_title('FFT of Data')
axs[1].set_xlabel('Frequency')
axs[1].set_ylabel('Magnitude')

# Adjust layout and show the plots
plt.tight_layout()
plt.show()

