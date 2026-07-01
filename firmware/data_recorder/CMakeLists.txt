cmake_minimum_required(VERSION 3.16)

file(STRINGS "${CMAKE_CURRENT_LIST_DIR}/../../version.txt" PROJECT_VER LIMIT_COUNT 1)

set(DEV_BACKEND_URL "" CACHE STRING "Dev logger backend URL")
set(DEV_WIFI_SSID "" CACHE STRING "Dev logger Wi-Fi SSID")
set(DEV_WIFI_PASSWORD "" CACHE STRING "Dev logger Wi-Fi password")
set(DEV_CAPTURE_LABEL "unlabeled" CACHE STRING "Dev logger capture label")
set(DEV_DEVICE_SERIAL "" CACHE STRING "Dev logger serial number override")
set(DEV_FIRMWARE_VERSION "${PROJECT_VER}" CACHE STRING "Dev logger firmware version")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(data_recorder)
