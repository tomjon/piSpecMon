from config import *
from common import parse_config
from time import sleep
import fs_datastore as data_store
from monitor import Monitor
try:
    import RPi.GPIO as GPIO
except ImportError:
    pass


def power_on():
    try:
        # if we're on a Pi, we can import GPIO and use it to turn on the rig
        GPIO.setmode(GPIO.BCM) # There are two ways of numbering pins. We choose I/O chip numbering

        GPIO.setup(RADIO_ON_SWITCH, GPIO.OUT, initial=GPIO.LOW)
        sleep(RADIO_ON_SLEEP_SECS)
        GPIO.output(RADIO_ON_SWITCH, GPIO.HIGH)
        sleep(RADIO_ON_SLEEP_SECS)
        GPIO.output(RADIO_ON_SWITCH, GPIO.LOW)
        sleep(RADIO_ON_SLEEP_SECS)

        GPIO.cleanup()
    except NameError:
        # otherwise, nothing we can do
        pass


def power_off():
    rig = data_store.Settings('rig').read()
    parse_config(rig.values)
    monitor = Monitor(**rig.values)
    monitor.open()
    monitor.power_off()
    monitor.close()



if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print "Usage: python {0} [on|off]".format(sys.argv[0])
        sys.exit(1)

    if sys.argv[1] == 'on':
        power_on()

    if sys.argv[1] == 'off':
        power_off()
