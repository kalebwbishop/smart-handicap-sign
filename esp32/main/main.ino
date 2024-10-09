#include <WiFi.h>
#include <HTTPClient.h>

#include "helpers.h"

const int analogPin = 34;

const int FREQUENCY = 25; // hertz
const int SIZE = 256;

int test_intensity_true[SIZE] = {804, 805, 806, 806, 807, 808, 808, 808, 809, 809, 808, 808, 807, 807, 806, 805, 804, 804, 803, 803, 547, 513, 508, 507, 507, 507, 507, 508, 508, 509, 509, 509, 510, 510, 510, 510, 510, 509, 509, 509, 508, 507, 506, 506, 505, 506, 506, 507, 507, 508, 509, 509, 510, 511, 512, 512, 512, 512, 513, 754, 793, 801, 805, 806, 807, 807, 806, 806, 805, 805, 804, 804, 803, 803, 803, 803, 803, 803, 804, 804, 805, 806, 807, 807, 808, 809, 803, 803, 804, 804, 805, 805, 806, 807, 808, 808, 808, 810, 611, 529, 521, 519, 518, 517, 516, 515, 514, 514, 513, 513, 512, 513, 513, 513, 513, 512, 512, 512, 513, 513, 514, 514, 515, 515, 515, 516, 516, 515, 515, 515, 514, 514, 514, 514, 514, 513, 513, 513, 514, 514, 515, 515, 515, 515, 515, 701, 783, 797, 802, 805, 807, 808, 808, 808, 808, 809, 808, 808, 807, 807, 805, 805, 805, 803, 804, 804, 803, 803, 803, 804, 805, 806, 806, 807, 807, 808, 808, 809, 809, 809, 809, 809, 808, 809, 808, 807, 808, 549, 525, 520, 518, 517, 516, 516, 515, 515, 515, 514, 514, 514, 513, 513, 513, 513, 513, 513, 514, 514, 515, 515, 515, 515, 515, 515, 514, 515, 515, 515, 515, 514, 514, 514, 514, 514, 514, 513, 513, 513, 513, 513, 513, 513, 512, 512, 513, 513, 514, 515, 515, 515, 515, 609, 781, 799, 804, 806, 807, 807, 807, 806, 806, 805, 805, 804, 804, 804};

int intensity[SIZE];
int intensity_idx = 0;

const char* ssid = "Hub Cincinnati";       // Replace with your network name
const char* password = "SFYAQZLM";  // Replace with your network password

const char* serverName = "https://9560ls9j-5000.use2.devtunnels.ms/";

void setup() {
  Serial.begin(115200);
  delay(10);

  // Connecting to WiFi
  // Serial.println();
  // Serial.print("Connecting to ");
  // Serial.println(ssid);

  // WiFi.begin(ssid, password);

  // while (WiFi.status() != WL_CONNECTED) {
  //   delay(1000);
  //   Serial.print(".");
  // }

  // Serial.println("");
  // Serial.println("WiFi connected");
  // Serial.println("IP address: ");
  // Serial.println(WiFi.localIP());

  // HTTPClient http;

  // // Start the GET request to the server
  // http.begin(serverName);
  // int httpResponseCode = http.GET();

  // // Check if the GET request was successful
  // if (httpResponseCode > 0) {
  //   String payload = http.getString();  // Get the response as a string
  //   Serial.println("HTTP Response code: " + String(httpResponseCode));
  //   Serial.println("Response payload: " + payload);
  // } else {
  //   Serial.println("Error in GET request");
  // }
  
  // // Close the connection
  // http.end();

  // read_weights();
}

void loop() {
  // int analogValue = analogRead(analogPin);
  // intensity[intensity_idx] = analogValue;
  // // intensity[intensity_idx] = test_intensity_true[intensity_idx];
  // // Serial.println(intensity[intensity_idx]);
  
  // if (intensity_idx < SIZE) {
  //   intensity_idx += 1;
  // }
  // else {
  //   intensity_idx = 0;

  //   // Serial.println(classify(intensity, SIZE));
  // }

  // delay(1000 / FREQUENCY);
}