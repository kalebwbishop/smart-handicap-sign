#include "helpers.h"
#include "FS.h"
#include "SPIFFS.h"

// Example weights for hidden and output layers (replace with actual values)
float weights_hidden[input_size][hidden_layer_size] = { /* fill with actual values */ };
float biases_hidden[hidden_layer_size] = { /* fill with actual values */ };
float weights_output[hidden_layer_size] = { /* fill with actual values */ };
float biases_output[1] = { /* fill with actual values */ };

void read_weights() {
  if (!SPIFFS.begin(true)) {
    Serial.println("An Error has occurred while mounting SPIFFS");
    return;
  }

  File file = SPIFFS.open("/model_weights_biases.txt", "r");
  if (!file) {
    Serial.println("Failed to open file for reading");
    return;
  }

  if (!file.available()) {
    Serial.println("No data");
    return;
  }

  // Read weights for the hidden layer
  for (int i = 0; i < input_size; i++) {
    for (int j = 0; j < hidden_layer_size; j++) {
      if (file.available()) {
        weights_hidden[i][j] = file.parseFloat();
        Serial.println(weights_hidden[i][j]);
      }
    }
  }

  // Read biases for the hidden layer
  for (int i = 0; i < hidden_layer_size; i++) {
    if (file.available()) {
      biases_hidden[i] = file.parseFloat();
    }
  }

  // Read weights for the output layer
  for (int i = 0; i < hidden_layer_size; i++) {
    if (file.available()) {
      weights_output[i] = file.parseFloat();
    }
  }

  // Read bias for the output layer
  if (file.available()) {
    biases_output[0] = file.parseFloat();
  }

  file.close();
  Serial.println("Weights and biases loaded successfully.");
}

// Function to normalize input data (accepting int array and converting to float)
void normalize_input_data(int input_data[], int size, float output_data[]) {
  int min_value = input_data[0];
  int max_value = input_data[0];

  // Find min and max values
  for (int i = 1; i < size; i++) {
    if (input_data[i] < min_value) min_value = input_data[i];
    if (input_data[i] > max_value) max_value = input_data[i];
  }

  // Normalize to float range [0, 1]
  for (int i = 0; i < size; i++) {
    output_data[i] = (float)(input_data[i] - min_value) / (float)(max_value - min_value);
  }
}

// ReLU activation function
float relu(float x) {
  return (x > 0) ? x : 0.0;
}

// Sigmoid activation function
float sigmoid(float x) {
  return 1.0 / (1.0 + exp(-x));
}

// Matrix multiplication function for hidden layer
void dot_product(float inputs[], float weights[][hidden_layer_size], float biases[], float outputs[], int input_len, int output_len) {
  for (int i = 0; i < output_len; i++) {
    float sum = 0;
    for (int j = 0; j < input_len; j++) {
      sum += inputs[j] * weights[j][i];
    }
    sum += biases[i];
    outputs[i] = sum;
  }
}

// Dot product for output layer
float dot_product_output(float inputs[], float weights[], float biases[], int size) {
  float sum = 0;
  for (int i = 0; i < size; i++) {
    sum += inputs[i] * weights[i];
  }
  sum += biases[0];
  return sum;
}

// Classification function (now accepts an array of integers)
bool classify(int input_data[], int size) {
  if (size != input_size) {
    Serial.println("Error: Input data size mismatch.");
    return false;
  }

  // Step 1: Normalize Input Data (converting to float)
  float normalized_input_data[input_size];
  normalize_input_data(input_data, size, normalized_input_data);

  // Step 2: Hidden layer calculation
  float hidden_layer_output[hidden_layer_size];
  dot_product(normalized_input_data, weights_hidden, biases_hidden, hidden_layer_output, input_size, hidden_layer_size);

  // Apply ReLU activation to hidden layer
  for (int i = 0; i < hidden_layer_size; i++) {
    hidden_layer_output[i] = relu(hidden_layer_output[i]);
  }

  // Step 3: Output layer calculation
  float output = dot_product_output(hidden_layer_output, weights_output, biases_output, hidden_layer_size);

  // Apply Sigmoid activation
  float probability = sigmoid(output);

  // Classify based on probability
  return probability > 0.5;
}