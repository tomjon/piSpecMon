""" Module providing fake OSS Audio Dev API.
"""
import time
from __builtin__ import open as _open

AFMT_S16_LE = 1

class FakeAudio(object):
    """ Class defining the fake API.
    """

    def __init__(self):
        self._f = _open('/dev/random')
        self._channels = 1
        self._speed = 9600

    def close(self):
        """ Close the audio device.
        """
        self._f.close()

    def channels(self, channels):
        """ Set the number of channels.
        """
        self._channels = channels

    def setfmt(self, fmt):
        """ Set the format (ignored).
        """
        pass

    def speed(self, speed):
        """ Set the speed.
        """
        self._speed = speed

    def read(self, size):
        """ Read the specified number of bytes.
        """
        time_0 = time.time()
        raw = self._f.read(size)
        time.sleep(size / float(self._speed * self._channels) - time.time() + time_0)
        return raw


def open(*_): # pylint: disable=redefined-builtin
    """ Open the fake audio API.
    """
    return FakeAudio()
