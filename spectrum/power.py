import time
import RPi.GPIO as GPIO

RADIO_ON_SWITCH = 21
SLEEP_SECS = 1 

GPIO.setmode(GPIO.BCM) #There are two ways of numbering pins. We choose I/O chip numbering

GPIO.setup(RADIO_ON_SWITCH, GPIO.OUT, initial=GPIO.LOW)
time.sleep(SLEEP_SECS)
GPIO.output(RADIO_ON_SWITCH, GPIO.HIGH)
time.sleep(SLEEP_SECS)
GPIO.output(RADIO_ON_SWITCH, GPIO.LOW)
time.sleep(SLEEP_SECS)

GPIO.cleanup()

