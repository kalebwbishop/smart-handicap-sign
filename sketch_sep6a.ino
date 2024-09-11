#include <math.h>

// Define the number of samples and the sampling frequency
const int N = 100;  // Number of samples (can be increased depending on memory)
const float Fs = 1000.0;  // Sampling frequency

// Time-domain signal array (for demonstration, we create a simple signal)
float signal[N];
int index = 0;

// Arrays to store the real and imaginary parts of the DFT result
float real_part[N];
float imag_part[N];

// Array to store the magnitudes of the frequencies
float magnitude[N];

// Function to compute the DFT
bool computeDFT() {
  for (int k = 2; k < N; k += 2) {
    real_part[k] = 0.0;
    imag_part[k] = 0.0;
    
    // Sum over all the time-domain points
    for (int n = 0; n < N; n++) {
      float angle = 2 * PI * k * n / N;
      real_part[k] += signal[n] * cos(angle);
      imag_part[k] += signal[n] * -sin(angle);
    }
    
    // Compute the magnitude of the frequency component
    magnitude[k] = sqrt(real_part[k] * real_part[k] + imag_part[k] * imag_part[k]);

    if (magnitude[k] > 5) {
      return true;
    }
  }

  return false;
}

void setup() {
  Serial.begin(9600);
}

void loop() {
  int analog_value = analogRead(A0);

  Serial.println(analog_value);

  signal[index] = analog_value;

  if (index == N - 1) {
    // Serial.print("Output: ");
    // Serial.println(computeDFT());
    computeDFT();
  }

  index = (index + 1) % N;
  
  delay(25);
}