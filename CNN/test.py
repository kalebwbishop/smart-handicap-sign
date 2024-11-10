import tensorflow as tf
import numpy as np
import json

# Load weights and biases from JSON
with open('./model_weights_biases.json', 'r') as f:
    weights_data = json.load(f)

# Rebuild the model architecture
model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=(256,)),
    tf.keras.layers.Dense(16, activation='relu'),
    tf.keras.layers.Dense(1, activation='sigmoid')
])

# Set the weights and biases manually
model.layers[0].set_weights([np.array(weights_data['weights_hidden']), np.array(weights_data['biases_hidden'])])
model.layers[1].set_weights([np.array(weights_data['weights_output']), np.array(weights_data['biases_output'])])

# Make predictions
def classify_wave(input_data):
    prediction = model.predict(np.array([input_data]))
    return prediction > 0.5