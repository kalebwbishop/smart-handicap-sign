import RPi.GPIO as GPIO
import time


GPIO.setmode(GPIO.BCM)

def capture(size):
    mpin=19
    tpin=26
    cap=0.000001
    adj=2.130620985
    i=0
    t=0
    input_intensity = []
    
    while len(input_intensity) < size:
        GPIO.setup(mpin, GPIO.OUT)
        GPIO.setup(tpin, GPIO.OUT)
        GPIO.output(mpin, False)
        GPIO.output(tpin, False)
        time.sleep(0.01)
        GPIO.setup(mpin, GPIO.IN)
        time.sleep(0.01)
        GPIO.output(tpin, True)
        starttime=time.time()
        endtime=time.time()
        while (GPIO.input(mpin) == GPIO.LOW):
            endtime=time.time()
        measureresistance=endtime-starttime
        
        res=(measureresistance/cap)*adj        

        input_intensity.append(res)
        print(res)

    return input_intensity

