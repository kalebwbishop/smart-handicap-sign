import tensorflow as tf
import numpy as np
import json
import math

SIZE = 256
FREQ = 1 / 25 
SAMPLES = 5000
TARGET_MAX = 1.8
TARGET_MIN = 1.2
EPOCHS = 25

# Generate some sample data (replace with your real data)

# Generate data for a sine wave
training_data = []
training_labels = []
for i in range(SAMPLES // 2):
    temp_freq = np.random.uniform(0.5, 5)

    x = np.linspace(0, SIZE * FREQ, SIZE)
    noise = np.random.normal(0, 3, SIZE)  # Adding Gaussian noise with mean 0 and standard deviation 0.1
    y = np.sin(2 * math.pi * x / temp_freq) + noise

    training_data.append(y)
    training_labels.append(temp_freq >= TARGET_MIN and temp_freq <= TARGET_MAX)


training_data = np.array(training_data)
training_labels = np.array(training_labels)

# Generate square wave data
for i in range(SAMPLES // 2):
    temp_freq = np.random.uniform(0.5, 5)

    x = np.linspace(0, SIZE * FREQ, SIZE)
    noise = np.random.normal(0, 3, SIZE)  # Adding Gaussian noise with mean 0 and standard deviation 0.1
    y = np.sign(np.sin(2 * math.pi * x / temp_freq)) + noise

    training_data = np.append(training_data, [y], axis=0)
    training_labels = np.append(training_labels, [temp_freq >= TARGET_MIN and temp_freq <= TARGET_MAX])



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
        "weights_hidden": weights_hidden.tolist(),
        "biases_hidden": biases_hidden.tolist(),
        "weights_output": weights_output.tolist(),
        "biases_output": biases_output.tolist()
    }, indent=4))
