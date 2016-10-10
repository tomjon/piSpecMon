""" Module defines a wrapper for the Keystone DLL.
"""

from ctypes import cdll, create_unicode_buffer, CDLL, c_char_p, c_long, c_int, pointer
from ctypes.util import find_library
from os.path import exists


LIBRARY = 'keystonecomm'
MODE_FM = 1

_buffer = create_unicode_buffer(300)

_library = find_library(LIBRARY)
if _library is not None:
    cdll.LoadLibrary(_library)
    _dll = CDLL(_library)
else:
    raise ImportError("Could not find library {0}".format(LIBRARY))


class RdsApi(object):
    """ Ctypes wrapper for the Keystone monkey board comms DLL.
    """

    def __init__(self, device, use_hard_mute=True):
        if not exists(device):
            raise Exception("No device {0}".format(device))
        self.device = device
        self.use_hard_mute = use_hard_mute

    def __enter__(self):
        value = _dll.OpenRadioPort(c_char_p(self.device), self.use_hard_mute)
        if value != 1:
            raise Exception("Error opening monkey board: {0}".format(value))
        return self

    def __exit__(self, *args):
        value = _dll.CloseRadioPort()
        if value != 1:
            raise Exception("Error closing monkey board: {0}".format(value))

    def set_frequency(self, freq):
        """ Set RDS decode frequency.
        """
        value = _dll.PlayStream(c_char_p(MODE_FM), c_long(int(freq / 1000)))
        if value != 1:
            raise Exception("Error setting frequencya: {0}".format(value))

    def get_strength(self):
        """ Read the signal strength.
        """
        error = pointer(c_int(0))
        strength = _dll.GetSignalStrength(error)
        if error.contents.value != 0:
            raise Exception("Error reading signal strength: {0}".format(error.contents.value))
        return strength

    def get_name(self):
        """ Read the decoded RDS name string.
        """
        value = _dll.GetProgramName(c_char_p(MODE_FM), c_long(0), c_char_p(1), _buffer)
        return _buffer.value.strip() if value > 0 else None

    def get_text(self):
        """ Read the decoded RDS text string.
        """
        value = _dll.GetProgramText(_buffer)
        return _buffer.value.strip() if value == 0 else None
