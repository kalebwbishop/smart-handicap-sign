from random import random
from time import sleep

FREQUENCY = 25 # hertz

def setup():
    pass

def main():
    while(True):
        # TODO: Capture photoresistor values
        print(int(1024 * random()))
        
        # Perform bandpass filter
        
        # Perform Power Spectral Density
        
        # Check for threshold breach
        
        # Send signal to notifications api
        
        sleep(1 / FREQUENCY)
    

if __name__ == '__main__':
    setup()
    main()
