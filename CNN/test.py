import tensorflow as tf
import numpy as np
import matplotlib.pyplot as plt

# Constants
SIZE = 128
FREQ = 25  # Hz (25 samples per second)
TIME_PERIOD = 1 / FREQ

# Load the TFLite model
interpreter = tf.lite.Interpreter(model_path="model.tflite")
interpreter.allocate_tensors()

# Get input and output details
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# Function to preprocess input data
def preprocess_data(data):
    data -= np.min(data)
    data /= np.max(data)
    return data[..., np.newaxis]  # Add feature dimension

# Generate custom test data (sine wave)
def generate_sine_wave(size, freq, noise_level=0.1):
    x = np.linspace(0, size * TIME_PERIOD, size)
    noise = np.random.normal(0, noise_level, size)
    y = np.sin(2 * np.pi * x / freq) + noise
    y = preprocess_data(y)
    return y

# Generate custom test data (square wave approximation)
def generate_square_wave(size, freq, noise_level=0.1):
    x = np.linspace(0, size * TIME_PERIOD, size)
    noise = np.random.normal(0, noise_level, size)
    y = (np.sin(np.pi * x / freq) +
         (1/3) * np.sin(3 * np.pi * x / freq) +
         (1/5) * np.sin(5 * np.pi * x / freq) +
         (1/7) * np.sin(7 * np.pi * x / freq) + noise)
    y = preprocess_data(y)
    return y

# Test data
sine_wave = generate_sine_wave(SIZE, freq=2)
square_wave = generate_square_wave(SIZE, freq=2)

# Test the model with sine wave
interpreter.set_tensor(input_details[0]['index'], np.array([sine_wave], dtype=np.float32))
interpreter.invoke()
output_sine = interpreter.get_tensor(output_details[0]['index'])[0]

# Test the model with square wave
interpreter.set_tensor(input_details[0]['index'], np.array([square_wave], dtype=np.float32))
interpreter.invoke()
output = interpreter.get_tensor(output_details[0]['index'])[0]

# Print results
print("Wave prediction:", output_sine)
print("Wave prediction:", output)

# Plot test data
plt.figure(figsize=(10, 5))
plt.subplot(1, 2, 1)
plt.plot(sine_wave.squeeze())
plt.title("Sine Wave")
plt.subplot(1, 2, 2)
plt.plot(square_wave.squeeze())
plt.title("Square Wave")
plt.show()