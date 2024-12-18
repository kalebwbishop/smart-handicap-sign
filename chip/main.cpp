#include <iostream>
#include <string>
#include <time.h>
#include <random>
#include <thread>
#include <nlohmann/json.hpp>

#include "gather.h"
#include "classify.h"
#include "notify.h"

using json = nlohmann::json;

const unsigned char SIZE = 128;

int main()
{
    // Modes:
    // 0 - Powering On
    // 1 - Ready
    // 2 - Assist
    // 3 - Error/Failure
    char mode = 0;

    int sensorData[SIZE];

    // Infinite loop to keep the program running
    while (true)
    {
        // Powering On
        if (mode == 0)
        {
            mode = 1;
        }

        // Ready
        if (mode == 1)
        {
            // Gather sensor data
            // TODO: Implement sensor data gathering
            gatherSensorData(SIZE, sensorData);

            // Perform classification
            // TODO: Implement classification
            bool classification = classifySensorData(SIZE, sensorData);

            // Send notification
            if (classification)
            {
                // std::string url = "http://hazard-hero-fa.azurewebsites.net/api/processiotmessage";
                std::string url = "http://127.0.0.1:7071/api/ProcessIoTMessage";
                // std::string postData = "{\"token\":\"ExponentPushToken[0CvbXvNR-5LgnLLBgM1UnG]\"}";
                std::string postData = "{\"hsign_id\":\"1\"}";

                std::cout << "Sending POST Request..." << std::endl;
                sendPOSTRequest(url, postData);
                mode = 2;
            }
        }

        // Assist
        if (mode == 2)
        {
            // Change the color of the light

            // Check to see if the status of the light has changed
            // If the status has changed, then change the mode to 0
            std::string url = "http://127.0.0.1:7071/api/GetHSignStatus";
            std::string postData = "{\"hsign_id\":\"1\"}";
            std::cout << "Sending POST Request..." << std::endl;
            json jsonResponse = sendPOSTRequest(url, postData);

            std::cout << "Response: " << jsonResponse.dump(4) << std::endl;

            if (jsonResponse.contains("status") && jsonResponse["status"] == "Ready")
            {
                std::cout << "Status changed to Ready" << std::endl;
                mode = 1;
                continue;
            }

            // Wait for 5 seconds
            std::this_thread::sleep_for(std::chrono::seconds(5));
        }

        // Error/Failure
        if (mode == 3)
        {
            std::this_thread::sleep_for(std::chrono::seconds(5));
        }
    }
    return 0;
}