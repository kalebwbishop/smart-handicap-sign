from time import strftime, localtime, sleep
import math
import sys
from capture import capture
from RaspberryPi.classify_og import classify
from RaspberryPi.notify_og import notify
from PyQt6.QtGui import QGuiApplication
from PyQt6.QtQml import QQmlApplicationEngine
from PyQt6.QtCore import QTimer, QObject, pyqtSignal

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

FREQUENCY = 25 # hertz
SIZE = 256

input_intensity = [0] * SIZE

test_intensity_false = [867.0, 867.0, 867.0, 866.0, 867.0, 864.0, 863.0, 862.0, 862.0, 863.0, 863.0,864.0, 866.0, 866.0, 867.0, 870.0, 873.0, 875.0, 876.0, 877.0, 878.0, 879.0,880.0, 880.0, 880.0, 880.0, 880.0, 880.0, 880.0, 879.0, 879.0, 877.0, 876.0,877.0, 877.0, 877.0, 878.0, 877.0, 877.0, 878.0, 878.0, 880.0, 880.0, 881.0,881.0, 882.0, 883.0, 883.0, 882.0, 883.0, 883.0, 883.0, 882.0, 884.0, 884.0,884.0, 881.0, 878.0, 874.0, 872.0, 871.0, 871.0, 871.0, 870.0, 870.0, 870.0,870.0, 871.0, 871.0, 871.0, 870.0, 871.0, 871.0, 872.0, 872.0, 872.0, 871.0,870.0, 870.0, 870.0, 870.0, 870.0, 869.0, 868.0, 868.0, 867.0, 867.0, 866.0,866.0, 865.0, 864.0, 864.0, 865.0, 865.0, 865.0, 866.0, 867.0, 868.0, 868.0,869.0, 866.0, 866.0, 865.0, 865.0, 866.0, 865.0, 865.0, 865.0, 866.0, 866.0,867.0, 865.0, 866.0, 868.0, 869.0, 871.0, 872.0, 873.0, 873.0, 872.0, 872.0,871.0, 871.0, 870.0, 869.0, 869.0, 868.0, 868.0, 867.0, 868.0, 867.0, 867.0,868.0, 867.0, 867.0, 868.0, 868.0, 868.0, 867.0, 865.0, 864.0, 863.0, 862.0,861.0, 860.0, 861.0, 860.0, 860.0, 859.0, 859.0, 858.0, 857.0, 857.0, 857.0,858.0, 859.0, 860.0, 861.0, 862.0, 862.0, 862.0, 862.0, 861.0, 861.0, 861.0,860.0, 860.0, 860.0, 859.0, 859.0, 857.0, 858.0, 858.0, 857.0, 856.0, 855.0,855.0, 853.0, 854.0, 854.0, 855.0, 857.0, 858.0, 859.0, 863.0, 866.0, 867.0,869.0, 870.0, 871.0, 872.0, 874.0, 875.0, 876.0, 876.0, 878.0, 878.0, 878.0,878.0, 879.0, 876.0, 877.0, 878.0, 879.0, 881.0, 881.0, 882.0, 882.0, 882.0,881.0, 882.0, 881.0, 880.0, 880.0, 879.0, 879.0, 878.0, 878.0, 877.0, 877.0,877.0, 877.0, 877.0, 877.0, 878.0, 879.0, 879.0, 879.0, 880.0, 880.0, 881.0,882.0, 882.0, 883.0, 881.0, 882.0, 880.0, 880.0, 880.0, 879.0, 878.0, 879.0,878.0, 878.0, 877.0, 876.0, 877.0, 877.0, 877.0, 877.0, 877.0, 877.0, 877.0,878.0, 878.0, 877.0]
test_intensity_true = [804, 805, 806, 806, 807, 808, 808, 808, 809, 809, 808, 808, 807, 807, 806, 805, 804, 804, 803, 803, 547, 513, 508, 507, 507, 507, 507, 508, 508, 509, 509, 509, 510, 510, 510, 510, 510, 509, 509, 509, 508, 507, 506, 506, 505, 506, 506, 507, 507, 508, 509, 509, 510, 511, 512, 512, 512, 512, 513, 754, 793, 801, 805, 806, 807, 807, 806, 806, 805, 805, 804, 804, 803, 803, 803, 803, 803, 803, 804, 804, 805, 806, 807, 807, 808, 809, 803, 803, 804, 804, 805, 805, 806, 807, 808, 808, 808, 810, 611, 529, 521, 519, 518, 517, 516, 515, 514, 514, 513, 513, 512, 513, 513, 513, 513, 512, 512, 512, 513, 513, 514, 514, 515, 515, 515, 516, 516, 515, 515, 515, 514, 514, 514, 514, 514, 513, 513, 513, 514, 514, 515, 515, 515, 515, 515, 701, 783, 797, 802, 805, 807, 808, 808, 808, 808, 809, 808, 808, 807, 807, 805, 805, 805, 803, 804, 804, 803, 803, 803, 804, 805, 806, 806, 807, 807, 808, 808, 809, 809, 809, 809, 809, 808, 809, 808, 807, 808, 549, 525, 520, 518, 517, 516, 516, 515, 515, 515, 514, 514, 514, 513, 513, 513, 513, 513, 513, 514, 514, 515, 515, 515, 515, 515, 515, 514, 515, 515, 515, 515, 514, 514, 514, 514, 514, 514, 513, 513, 513, 513, 513, 513, 513, 512, 512, 513, 513, 514, 515, 515, 515, 515, 609, 781, 799, 804, 806, 807, 807, 807, 806, 806, 805, 805, 804, 804, 804]

def setup():
    print("Starting")

def loop():
    input_intensity = []
    while(True):
        # Capture photoresistor values
        input_intensity = capture(SIZE)
        print(input_intensity)
        
        # Perform AI classification
        classification = classify(input_intensity, SIZE)
                
        # Send signal to notifications api
        if (classification):
            notify(classification, "a85e9341-0a8f-4426-947b-d94e65e8376f")
            backend.toggle.emit()

            
from threading import Thread
loop_thread = Thread(target=loop, daemon=True)
loop_thread.start()

sys.exit(app.exec())

if __name__ == '__main__':
    setup()
    loop()

