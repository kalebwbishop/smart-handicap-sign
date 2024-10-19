// WiFiHelper.h

#ifndef WIFI_HELPER_H
#define WIFI_HELPER_H

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

// Constants
const char* default_password = "12345678";  // Default AP Password
IPAddress apIP(192, 168, 4, 1);      // Custom IP address
IPAddress gateway(192, 168, 4, 1);   // Gateway (typically same as IP in AP mode)
IPAddress subnet(255, 255, 255, 0);  // Subnet mask

// Global variables
extern WebServer server;
extern Preferences preferences;
extern bool accessPointEnabled;
extern String inputSSID;
extern String inputPassword;

// Function declarations
void setupWiFi();
void startAccessPoint();
void handleRoot();
void handleSubmit();

#endif