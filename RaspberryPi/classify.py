import math
import json

with open('./model_weights_biases.json', 'r') as f:
    model = json.load(f)

    weights_hidden = model["weights_hidden"]
    biases_hidden = model["biases_hidden"]
    weights_output = model["weights_output"]
    biases_output = model["biases_output"]

# Normalizer function
def normalize_input_data(input_data):
    min_value = min(input_data)
    max_value = max(input_data)

    if min_value == max_value:
        return [0.5] * len(input_data)

    return [(float(x) - min_value) / (max_value - min_value) for x in input_data]

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

def classify(input_data, size):
    # Ensure the input is an array of 256 numbers
    if len(input_data) != size:
        raise ValueError("Input data must be an array of {} numbers".format(size))
    
    # Step 1: Normalize Input Data
    normalized_input_data = normalize_input_data(input_data)

    # Step 2: Hidden layer
    hidden_layer_output = dot_product(normalized_input_data, weights_hidden, biases_hidden)
    hidden_layer_output = [relu(x) for x in hidden_layer_output]  # Apply ReLU activation

    # Step 3: Output layer
    output_layer_output = dot_product(hidden_layer_output, weights_output, biases_output)
    probability = sigmoid(output_layer_output[0])  # Sigmoid activation for binary classification

    # Classify as True if probability > 0.5, else False
    return probability > 0.5

if __name__ == "__main__":
    input_data = [804, 805, 806, 806, 807, 808, 808, 808, 809, 809, 808, 808, 807, 807, 806, 805, 804, 804, 803, 803, 547, 513, 508, 507, 507, 507, 507, 508, 508, 509, 509, 509, 510, 510, 510, 510, 510, 509, 509, 509, 508, 507, 506, 506, 505, 506, 506, 507, 507, 508, 509, 509, 510, 511, 512, 512, 512, 512, 513, 754, 793, 801, 805, 806, 807, 807, 806, 806, 805, 805, 804, 804, 803, 803, 803, 803, 803, 803, 804, 804, 805, 806, 807, 807, 808, 809, 803, 803, 804, 804, 805, 805, 806, 807, 808, 808, 808, 810, 611, 529, 521, 519, 518, 517, 516, 515, 514, 514, 513, 513, 512, 513, 513, 513, 513, 512, 512, 512, 513, 513, 514, 514, 515, 515, 515, 516, 516, 515, 515, 515, 514, 514, 514, 514, 514, 513, 513, 513, 514, 514, 515, 515, 515, 515, 515, 701, 783, 797, 802, 805, 807, 808, 808, 808, 808, 809, 808, 808, 807, 807, 805, 805, 805, 803, 804, 804, 803, 803, 803, 804, 805, 806, 806, 807, 807, 808, 808, 809, 809, 809, 809, 809, 808, 809, 808, 807, 808, 549, 525, 520, 518, 517, 516, 516, 515, 515, 515, 514, 514, 514, 513, 513, 513, 513, 513, 513, 514, 514, 515, 515, 515, 515, 515, 515, 514, 515, 515, 515, 515, 514, 514, 514, 514, 514, 514, 513, 513, 513, 513, 513, 513, 513, 512, 512, 513, 513, 514, 515, 515, 515, 515, 609, 781, 799, 804, 806, 807, 807, 807, 806, 806, 805, 805, 804, 804, 804]
    print(classify(input_data, 256))  # Expected output: True
