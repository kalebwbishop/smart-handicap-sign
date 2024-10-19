#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

// Variables for Wi-Fi credentials
const char* default_password = "12345678";  // Default AP Password

WebServer server(80);
Preferences preferences;

String inputSSID = "";
String inputPassword = "";

// Define the custom IP, gateway, and subnet for AP mode
IPAddress apIP(192, 168, 4, 1);      // Custom IP address
IPAddress gateway(192, 168, 4, 1);   // Gateway (typically same as IP in AP mode)
IPAddress subnet(255, 255, 255, 0);  // Subnet mask

bool accessPointEnabled = false;

void setup() {
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

void loop() {
  server.handleClient();  // Handle web server requests

  // Periodically check if Wi-Fi is reconnected and disable AP if necessary
  if (WiFi.status() == WL_CONNECTED && accessPointEnabled) {
    Serial.println("Wi-Fi connected! Disabling Access Point...");
    WiFi.softAPdisconnect(true);  // Disable Access Point
    accessPointEnabled = false;   // Update flag
    Serial.println("Access Point disabled.");
  }
}