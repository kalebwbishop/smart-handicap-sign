#ifndef NOTIFY_H
#define NOTIFY_H

#include <string>
#include <vector>
#include <nlohmann/json.hpp>

// Callback function to handle the response data
size_t WriteCallback(void* contents, size_t size, size_t nmemb, std::string* userp);

// Function to send an HTTP GET request
void sendGETRequest(const std::string& url);

// Function to send an HTTP POST request
nlohmann::json sendPOSTRequest(const std::string& url, const std::string& data);

#endif
