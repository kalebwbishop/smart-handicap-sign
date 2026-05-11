cmake_minimum_required(VERSION 3.16)

file(STRINGS "${CMAKE_CURRENT_LIST_DIR}/version.txt" PROJECT_VER LIMIT_COUNT 1)
set(HAZARD_HERO_BACKEND_URL "https://api.example.com/api/v1" CACHE STRING "Backend API base URL")

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(hazard-hero-firmware)
