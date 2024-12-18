import tensorflow as tf
import numpy as np
import json
import math
import matplotlib.pyplot as plt

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, MaxPooling1D, Flatten, Dense, Dropout, BatchNormalization

# Constants
SIZE = 128
FREQ = 25 # Hz (25 samples per second)
TIME_PERIOD = 1 / FREQ
SAMPLES = 20000
TARGET_MAX = 2
TARGET_MIN = 1
EPOCHS = 12

toPrint = None

training_data = np.empty((0, SIZE))
training_labels = np.empty((0,))

# Generate noise data
for i in range(SAMPLES // 4):
    temp_freq = np.random.uniform(0.2, 4)
    temp_offset = np.random.uniform(0, 256)

    x = np.linspace(0, SIZE * TIME_PERIOD, SIZE)
    y = np.random.normal(0, 0.2, SIZE)

    y -= np.min(y)
    y /= np.max(y)

    if i == 0:  # Plot the first generated noise data
        plt.plot(y)
        plt.title("Generated Noise Data")
        plt.show()

    training_data = np.append(training_data, [y], axis=0)
    training_labels = np.append(training_labels, False)


# Generate square wave data
for i in range(3 * SAMPLES // 4):
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

    for i in range(len(training_labels)):
        if training_labels[i]:
            toPrint = training_data[i]
            break

# Define CNN architecture
def create_lightweight_cnn(input_shape):
    model = Sequential()

    # Convolutional layer
    model.add(Conv1D(filters=16, kernel_size=3, activation='relu', input_shape=input_shape))
    model.add(BatchNormalization())  # Helps with faster convergence and stability
    model.add(MaxPooling1D(pool_size=2))  # Downsampling

    # Add another convolutional layer
    model.add(Conv1D(filters=32, kernel_size=3, activation='relu'))
    model.add(MaxPooling1D(pool_size=2))

    # Flatten and dense layers
    model.add(Flatten())
    model.add(Dense(64, activation='relu'))  # Fully connected layer
    model.add(Dropout(0.3))  # Dropout for regularization
    model.add(Dense(1, activation='sigmoid'))  # Output layer for binary classification

    # Compile the model
    model.compile(optimizer='adam',
                  loss='binary_crossentropy',
                  metrics=['accuracy']
                  )
    return model


# Add feature dimension for CNN input
training_data = training_data[..., np.newaxis]

# Ensure shapes match
assert training_data.shape[0] == training_labels.shape[0], "Mismatch in data and label sizes!"

# Update input shape for the model
input_shape = (SIZE, 1)
model = create_lightweight_cnn(input_shape)

# Print model summary
model.summary()

# Train the model
model.fit(training_data, training_labels, epochs=EPOCHS)

# Save the model in TensorFlow Lite format
converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()

# Save to file
with open('model.tflite', 'wb') as f:
    f.write(tflite_model)

with open('success.txt', 'w') as f:
    f.write(json.dumps(toPrint.tolist()))


plt.plot(toPrint)
plt.title("Square wave")
plt.show()

