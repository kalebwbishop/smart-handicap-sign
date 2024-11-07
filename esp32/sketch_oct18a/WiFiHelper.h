// WiFiHelper.h

#ifndef WIFI_HELPER_H
#define WIFI_HELPER_H

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

// Declare global variables with extern to avoid multiple definitions
extern const char* default_password;
extern IPAddress apIP;
extern IPAddress gateway;
extern IPAddress subnet;

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