#include <iostream>
#include <curl/curl.h>
#include <string>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Callback function to handle the response data
size_t WriteCallback(void *contents, size_t size, size_t nmemb, std::string *userp)
{
    size_t totalSize = size * nmemb;
    userp->append((char *)contents, totalSize);
    return totalSize;
}

// Function to send an HTTP GET request
void sendGETRequest(const std::string &url)
{
    CURL *curl = curl_easy_init();
    json response = {};

    if (curl)
    {
        CURLcode res;

        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

        res = curl_easy_perform(curl);

        if (res != CURLE_OK)
        {
            std::cerr << "GET Request failed: " << curl_easy_strerror(res) << std::endl;
        }
        else
        {
            std::cout << "GET Response: " << response << std::endl;
        }

        curl_easy_cleanup(curl);
    }
}

// Function to send an HTTP POST request
nlohmann::json sendPOSTRequest(const std::string &url, const std::string &data)
{
    CURL *curl = curl_easy_init();
    json jsonResponse;

    if (curl)
    {
        CURLcode res;
        std::string response;

        // Set the URL for the POST request
        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());

        // Set the POST data
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, data.c_str());

        // Set the Content-Type header
        struct curl_slist *headers = nullptr;
        headers = curl_slist_append(headers, "Content-Type: application/json");
        headers = curl_slist_append(headers, "x-functions-key: AZURE_FUNCTION_KEY");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

        // Set the write callback to handle the response
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

        // Perform the POST request
        res = curl_easy_perform(curl);

        if (res != CURLE_OK)
        {
            std::cerr << "POST Request failed: " << curl_easy_strerror(res) << std::endl;
        }
        else
        {
            std::cout << "POST Response: " << response << std::endl;
        }

        // Parse the response into a JSON object
        try
        {
            jsonResponse = json::parse(response);
        }
        catch (json::parse_error &e)
        {
            std::cerr << "JSON parse error: " << e.what() << std::endl;
        }

        // Clean up
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);

        return jsonResponse;
    }
    return jsonResponse;
}