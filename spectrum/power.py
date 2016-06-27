from config import *
from time import sleep
import RPi.GPIO as GPIO

def power_on():
  GPIO.setmode(GPIO.BCM) #There are two ways of numbering pins. We choose I/O chip numbering

  GPIO.setup(RADIO_ON_SWITCH, GPIO.OUT, initial=GPIO.LOW)
  sleep(RADIO_ON_SLEEP_SECS)
  GPIO.output(RADIO_ON_SWITCH, GPIO.HIGH)
  sleep(RADIO_ON_SLEEP_SECS)
  GPIO.output(RADIO_ON_SWITCH, GPIO.LOW)
  sleep(RADIO_ON_SLEEP_SECS)

  GPIO.cleanup()
