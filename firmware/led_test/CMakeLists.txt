cmake_minimum_required(VERSION 3.16)

file(STRINGS "${CMAKE_CURRENT_LIST_DIR}/../version.txt" PROJECT_VER LIMIT_COUNT 1)

set(DATA_PIN 32 CACHE STRING "WS2812B data GPIO")
set(NUM_LEDS 38 CACHE STRING "Number of LEDs in the strip")
set(BRIGHTNESS 128 CACHE STRING "LED brightness (0-255)")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(led_test)
