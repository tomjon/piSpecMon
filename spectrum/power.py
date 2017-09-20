""" Functions for powering on/off the rig.
"""
from time import sleep
from spectrum.binary_datastore import BinaryDataStore
from spectrum.common import log, parse_config
from spectrum.config import RADIO_ON_SLEEP_SECS, RADIO_ON_SWITCH, DATA_PATH
try:
    from spectrum.monitor import Monitor
except ImportError:
    Monitor = None
try:
    import RPi.GPIO as GPIO
except ImportError:
    GPIO = None


def power_on():
    """ Turn on the rig.
    """
    if GPIO is None:
        log.error("Cannot power on - no GPIO")
        return
    log.info("Attempting to power on")
    try:
        # if we're on a Pi, we can import GPIO and use it to turn on the rig
        GPIO.setmode(GPIO.BCM) # There are two ways of numbering pins. We choose I/O chip numbering
    except NameError as e:
        # otherwise, nothing we can do
        log.info("No GPIO: can not power on: %s", str(e))
    else:
        GPIO.setup(RADIO_ON_SWITCH, GPIO.OUT, initial=GPIO.LOW)
        sleep(RADIO_ON_SLEEP_SECS)
        GPIO.output(RADIO_ON_SWITCH, GPIO.HIGH)
        sleep(RADIO_ON_SLEEP_SECS)
        GPIO.output(RADIO_ON_SWITCH, GPIO.LOW)
        sleep(RADIO_ON_SLEEP_SECS)
        GPIO.cleanup()


def power_off():
    """ Turn off the rig.
    """
    if Monitor is None:
        log.error("Cannot power off - no Monitor/Hamlib")
        return
    log.info("Attempting to power off")
    data = BinaryDataStore(DATA_PATH)
    rig = data.settings('rig').read()
    parse_config(rig.values)
    monitor = Monitor(**rig.values)
    monitor.open()
    monitor.power_off()
    monitor.close()
