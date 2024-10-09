#ifndef HELPER_H
#define HELPER_H

#include <Arduino.h>
#include <math.h>

const int input_size = 256;        // Size of input array
const int hidden_layer_size = 16;  // Number of neurons in the hidden layer

// Function to read weights from file
void read_weights();

// Function to normalize input data (from int to float)
void normalize_input_data(int input_data[], int size, float output_data[]);

// ReLU activation function
float relu(float x);

// Sigmoid activation function
float sigmoid(float x);

// Matrix multiplication function for hidden layer (input as float)
void dot_product(float inputs[], float weights[][hidden_layer_size], float biases[], float outputs[], int input_len, int output_len);

// Dot product for output layer (input as float)
float dot_product_output(float inputs[], float weights[], float biases[], int size);

// Classification function
bool classify(int input_data[], int size);

#endif
