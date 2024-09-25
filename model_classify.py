import math
import json

# REMOVE THIS LINE
import numpy as np

with open('./model_weights_biases.json', 'r') as f:
    model = json.load(f)

    weights_hidden = model["weights_hidden"]
    biases_hidden = model["biases_hidden"]
    weights_output = model["weights_output"]
    biases_output = model["biases_output"]

# Activation functions
def relu(x):
    return max(0, x)

def sigmoid(x):
    return 1 / (1 + math.exp(-x))

# Matrix multiplication function
def dot_product(inputs, weights, biases):
    outputs = []
    for i in range(len(biases)):  # Iterate over the neurons
        dot = sum(inputs[j] * weights[j][i] for j in range(len(inputs))) + biases[i]
        outputs.append(dot)
    return outputs

def classify(input_data):
    # Ensure the input is an array of 256 numbers
    if len(input_data) != 256:
        raise ValueError("Input data must be an array of 256 numbers")

    # Step 1: Hidden layer
    hidden_layer_output = dot_product(input_data, weights_hidden, biases_hidden)
    hidden_layer_output = [relu(x) for x in hidden_layer_output]  # Apply ReLU activation

    # Step 2: Output layer
    output_layer_output = dot_product(hidden_layer_output, weights_output, biases_output)
    probability = sigmoid(output_layer_output[0])  # Sigmoid activation for binary classification

    # Classify as True (1) if probability > 0.5, else False (0)
    return probability > 0.5

# Example usage

x = np.linspace(0, 256 * (1 / 25), 256)
y = np.sin(2 * math.pi * x / 1.1)
noise = np.random.normal(0, 0.5, y.shape)
y += noise

import matplotlib.pyplot as plt

# Plotting y
plt.plot(x, y)
plt.title('Generated Data with Noise')
plt.xlabel('x')
plt.ylabel('y')
# plt.show()

input_data = y  # Replace with your 256-element input array
classification = classify(input_data)
print("Classification:", classification)