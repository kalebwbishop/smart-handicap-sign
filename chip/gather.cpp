#include "gather.h"
#include <iostream>
#include <string>
#include <random>

const int FREQ = 25;

void gatherSensorData(int size, int* sensorData)
{
    for (int i = 0; i < size; i++)
    {
        sensorData[i] = rand() % 20000;
        std::cout << i << std::endl;
    }
}