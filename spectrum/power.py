""" Functions for powering on/off the rig.
"""
from time import sleep
from spectrum.fs_datastore import FsDataStore
from spectrum.common import parse_config
from spectrum.config import RADIO_ON_SLEEP_SECS, DATA_PATH
from spectrum.monitor import Monitor
try:
    import RPi.GPIO as GPIO
except ImportError:
    pass


def power_on():
    """ Turn on the rig.
    """
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
    """ Turn off the rig.
    """
    fsds = FsDataStore(DATA_PATH)
    rig = fsds.settings('rig').read()
    parse_config(rig.values)
    monitor = Monitor(**rig.values)
    monitor.open()
    monitor.power_off()
    monitor.close()
