cmake_minimum_required(VERSION 3.16)

file(STRINGS "${CMAKE_CURRENT_LIST_DIR}/../version.txt" PROJECT_VER LIMIT_COUNT 1)

set(BATTERY_TEST_ADC_CHANNEL ADC_CHANNEL_6 CACHE STRING "ADC channel to read")
set(BATTERY_TEST_SAMPLE_INTERVAL_MS 1000 CACHE STRING "Delay between ADC reads")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(battery_test)
