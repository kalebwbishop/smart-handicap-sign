from perceptron import Perceptron
import numpy as np
from capture import capture
from classify import classify
from notify import notify
# from threading import Thread

FREQUENCY = 25
SIZE = 300

perceptron = Perceptron(SIZE)
perceptron.load()

def setup():
    print("Starting")

def loop():
    print("printing weights: ", np.shape(perceptron.weights))
    while(True):
        # Capture photoresistor values
        input_intensity = capture(SIZE)
        print(input_intensity)
        
        # Perform AI classification
        classification = classify(input_intensity, SIZE, perceptron)
                
        # Send signal to notifications api
        if (classification):
            notify()
            break

            
# loop_thread = Thread(target=loop, daemon=True)
# loop_thread.start()

if __name__ == '__main__':
    setup()
    loop()

