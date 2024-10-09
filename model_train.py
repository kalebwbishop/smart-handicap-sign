import tensorflow as tf
import numpy as np
import json
import math

SIZE = 256
TIME_PERIOD = 1 / 25 
SAMPLES = 5000
TARGET_MAX = 2.5
TARGET_MIN = 0.5
EPOCHS = 25

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
    training_labels = np.append(training_labels, False)


# Generate square wave data
for i in range(SAMPLES // 2):
    temp_freq = np.random.uniform(0.2, 4)
    temp_offset = np.random.uniform(0, 256)

    x = np.linspace(0, SIZE * TIME_PERIOD, SIZE)
    noise = np.random.normal(0, 0.2, SIZE)
    y =  np.sin(math.pi * (x + temp_offset) / temp_freq) + (1/3) * np.sin(3 * math.pi * (x + temp_offset) / temp_freq)  + (1/5) * np.sin(5 * math.pi * (x + temp_offset) / temp_freq) + (1/7) * np.sin(7 * math.pi * (x + temp_offset) / temp_freq) + noise

    y -= np.min(y)
    y /= np.max(y)

    training_data = np.append(training_data, [y], axis=0)
    training_labels = np.append(training_labels, [temp_freq >= TARGET_MIN and temp_freq <= TARGET_MAX])

    # import matplotlib.pyplot as plt

    # Plot the last 5 training data sets
    # print(training_labels[-5:])
    # plt.figure(figsize=(10, 8))
    # for i in range(1, 6):
    #     plt.subplot(5, 1, i)
    #     plt.plot(x, training_data[-i])
    #     plt.title(f'Training Data Set {-i}')
    #     plt.xlabel('Sample Index')
    #     plt.ylabel('Normalized Amplitude')
    # plt.tight_layout()
    # plt.show()

# Build a simple neural network model in TensorFlow
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(input_shape=(SIZE,)),
    tf.keras.layers.Dense(16, activation='relu'),  # Small hidden layer
    tf.keras.layers.Dense(1, activation='sigmoid')  # Output layer (binary classification)
])

# Compile and train the model
model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
model.fit(training_data, training_labels, epochs=EPOCHS)

# Get the weights and biases from the trained model
weights_hidden, biases_hidden = model.layers[0].get_weights()
weights_output, biases_output = model.layers[1].get_weights()

# Print the weights and biases for use in MicroPython
# Save the weights and biases to a file
with open('./model_weights_biases.json', 'w') as f:
    f.write(json.dumps({
        "weights_hidden": [[f"{float(j):.4f}" for j in i] for i in list(weights_hidden.tolist())],
        "biases_hidden": [f"{float(j):.4f}" for j in biases_hidden.tolist()],
        "weights_output": [[f"{float(j):.4f}" for j in i] for i in list(weights_output.tolist())],
        "biases_output": [f"{float(j):.4f}" for j in biases_output.tolist()]
    }, indent=4))
