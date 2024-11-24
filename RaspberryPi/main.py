from time import strftime, localtime, sleep
import numpy as np
import sys
from capture import capture
from classify import classify
from notify import notify
from PyQt6.QtGui import QGuiApplication
from PyQt6.QtQml import QQmlApplicationEngine
from PyQt6.QtCore import QTimer, QObject, pyqtSignal

from perceptron import Perceptron

app = QGuiApplication(sys.argv)
engine = QQmlApplicationEngine()
engine.quit.connect(app.quit)
engine.load('main.qml')

class Backend(QObject):

    updated = pyqtSignal(str, arguments=['time'])
    toggle = pyqtSignal() 

    def __init__(self):
        super().__init__()

        # Define timer.
        self.timer = QTimer()
        self.timer.setInterval(100)  # msecs 100 = 1/10th sec
        self.timer.timeout.connect(self.update_time)
        self.timer.start()

    def update_time(self):
        # Pass the current time to QML.
        curr_time = strftime("%H:%M:%S", localtime())
        self.updated.emit(curr_time)



# Define our backend object, which we pass to QML.
backend = Backend()

engine.rootObjects()[0].setProperty('backend', backend)

# Initial call to trigger first update. Must be after the setProperty to connect signals.
backend.update_time()

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
            backend.toggle.emit()
            break

            
from threading import Thread
loop_thread = Thread(target=loop, daemon=True)
loop_thread.start()

sys.exit(app.exec())

if __name__ == '__main__':
    setup()

    while (not False):
        loop()

