// WiFiHelper.cpp

#include "WiFiHelper.h"

// Global variables
WebServer server(80);
Preferences preferences;
bool accessPointEnabled = false;
String inputSSID = "";
String inputPassword = "";

// Function to setup Wi-Fi and either connect to stored network or start AP
void setupWiFi() {
    Serial.begin(115200);

    // Initialize preferences (for storing credentials)
    preferences.begin("wifi-creds", false);

    // Try to load Wi-Fi credentials from storage
    String storedSSID = preferences.getString("ssid", "");
    String storedPassword = preferences.getString("password", "");

    // Check if credentials are stored
    if (storedSSID != "") {
        // Connect to stored Wi-Fi network
        WiFi.begin(storedSSID.c_str(), storedPassword.c_str());

        Serial.print("Connecting to WiFi: ");
        Serial.println(storedSSID);

        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("Connected to Wi-Fi!");
            Serial.println("IP Address: " + WiFi.localIP().toString());
            return;  // Skip to main loop if connected
        }
    }

    // If not connected, start Access Point for setup
    startAccessPoint();
}

// Function to start the Access Point with dynamic SSID
void startAccessPoint() {
    Serial.println("Starting Access Point...");

    // Get the device's MAC address
    String macAddress = WiFi.macAddress();

    // Extract the last four digits of the MAC address, removing colons
    String lastFourDigits = macAddress.substring(12);  // Get last three octets
    lastFourDigits.replace(":", "");  // Remove colons

    // Generate the SSID with the last four digits of the MAC address
    String default_ssid = "Smart Handicap Sign-" + lastFourDigits;  // Use the last part of the MAC

    // Configure the Access Point with a dynamic SSID and default password
    WiFi.softAPConfig(apIP, gateway, subnet);
    WiFi.softAP(default_ssid, default_password);

    // Set the flag indicating that the Access Point is enabled
    accessPointEnabled = true;

    // Start server
    server.on("/", HTTP_GET, handleRoot);
    server.on("/submit", HTTP_POST, handleSubmit);
    server.begin();

    Serial.println("AP IP address: ");
    Serial.println(WiFi.softAPIP());  // Print the AP IP address
}

// Function to handle the root page for Wi-Fi setup
void handleRoot() {
    String html = "<html><body>"
                  "<h1>Wi-Fi Setup</h1>"
                  "<p>Please enter the SSID and password of a 2.4 GHz Wi-Fi network. The ESP32 does not support 5 GHz networks.</p>"
                  "<form action='/submit' method='POST'>"
                  "SSID: <input type='text' name='ssid'><br>"
                  "Password: <input type='password' name='password'><br>"
                  "<input type='submit' value='Submit'>"
                  "</form></body></html>";
    server.send(200, "text/html", html);
}

// Function to handle submission of Wi-Fi credentials
void handleSubmit() {
    if (server.hasArg("ssid") && server.hasArg("password")) {
        inputSSID = server.arg("ssid");
        inputPassword = server.arg("password");

        // Store the credentials
        preferences.putString("ssid", inputSSID);
        preferences.putString("password", inputPassword);

        // Try to connect to the new Wi-Fi network
        WiFi.softAPdisconnect(true);  // Disconnect the Access Point before reconnecting
        accessPointEnabled = false;   // Set the flag to indicate AP is disabled
        WiFi.begin(inputSSID.c_str(), inputPassword.c_str());

        server.send(200, "text/html", "<h1>Connecting to Wi-Fi...</h1>");

        delay(2000);
        ESP.restart();  // Restart to connect with the new credentials
    }
}