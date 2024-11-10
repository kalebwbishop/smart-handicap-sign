import tensorflow as tf
import numpy as np
import json
import math

# Constants
SIZE = 256
TIME_PERIOD = 1 / 25 
SAMPLES = 10000
TARGET_MAX = 2.5
TARGET_MIN = 0.5
EPOCHS = 100

# Generate data for a sine wave
training_data = np.empty((0, SIZE))
training_labels = np.empty((0,))
for i in range(SAMPLES // 2):
    temp_freq = np.random.uniform(0.5, 5)
    temp_offset = np.random.uniform(-2, 2)

    x = np.linspace(0, SIZE * TIME_PERIOD, SIZE)
    noise = np.random.normal(0, 3, SIZE)
    y = np.sin(2 * math.pi * x / temp_freq + temp_offset) + noise

    y -= np.min(y)
    y /= np.max(y)

    training_data = np.append(training_data, [y], axis=0)
    training_labels = np.append(training_labels, False)  # Label 0 for sine wave

# Generate square wave data
for i in range(SAMPLES // 2):
    temp_freq = np.random.uniform(0.2, 4)
    temp_offset = np.random.uniform(0, 256)

    x = np.linspace(0, SIZE * TIME_PERIOD, SIZE)
    noise = np.random.normal(0, 0.2, SIZE)
    y = (np.sin(math.pi * (x + temp_offset) / temp_freq) +
         (1/3) * np.sin(3 * math.pi * (x + temp_offset) / temp_freq) +
         (1/5) * np.sin(5 * math.pi * (x + temp_offset) / temp_freq) +
         (1/7) * np.sin(7 * math.pi * (x + temp_offset) / temp_freq) + noise)

    y -= np.min(y)
    y /= np.max(y)

    training_data = np.append(training_data, [y], axis=0)
    training_labels = np.append(training_labels, [temp_freq >= TARGET_MIN and temp_freq <= TARGET_MAX])

# Build and compile the neural network model
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(input_shape=(SIZE,)),
    tf.keras.layers.Dense(16, activation='relu'),  # Small hidden layer
    tf.keras.layers.Dense(1, activation='sigmoid')  # Output layer (binary classification)
])


model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

# Train the model
model.fit(training_data, training_labels, epochs=EPOCHS)

# Save the model weights and biases to a JSON file
weights_hidden, biases_hidden = model.layers[0].get_weights()
weights_output, biases_output = model.layers[1].get_weights()

with open('./model_weights_biases.json', 'w') as f:
    json.dump({
        "weights_hidden": weights_hidden.tolist(),
        "biases_hidden": biases_hidden.tolist(),
        "weights_output": weights_output.tolist(),
        "biases_output": biases_output.tolist()
    }, f, indent=4)

print("Model weights and biases have been saved to model_weights_biases.json")