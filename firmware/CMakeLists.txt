cmake_minimum_required(VERSION 3.16)

file(STRINGS "${CMAKE_CURRENT_LIST_DIR}/version.txt" PROJECT_VER LIMIT_COUNT 1)
set(IOT_HUB_HOST "your-iot-hub.azure-devices.net" CACHE STRING "Azure IoT Hub host name")
set(IOT_HUB_DEVICE_ID "" CACHE STRING "Azure IoT Hub device ID override")
set(IOT_HUB_MQTT_PORT 8883 CACHE STRING "Azure IoT Hub MQTT port")
set(IOT_HUB_API_VERSION "2021-04-12" CACHE STRING "Azure IoT Hub MQTT API version")
set(IOT_HUB_SAS_TOKEN "" CACHE STRING "Azure IoT Hub SAS token")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(hazard-hero-firmware)
