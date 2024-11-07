#ifndef CLASSIFY_H
#define CLASSIFY_H

#define HIDDEN_LAYER_SIZE 16
#define INPUT_SIZE 256
#define OUTPUT_SIZE 1

// Function to normalize input data (from int to float)
void normalize_input_data(int input_data[], int size, float output_data[]);

// ReLU activation function
float relu(float x);

// Sigmoid activation function
float sigmoid(float x);

// Matrix multiplication function for hidden layer (input as float)
void dot_product(const float* inputs, const float weights[][HIDDEN_LAYER_SIZE], const float* biases, float* outputs, int input_size, int output_size);

void dot_product(const float* inputs, const float weights[][OUTPUT_SIZE], const float* biases, float* output, int input_size);

// Classification function
bool classify(int* input_data, int size);

#endif