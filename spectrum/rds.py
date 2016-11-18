""" Module defines a wrapper for the Keystone DLL.
"""
from ctypes import cdll, create_unicode_buffer, CDLL, c_char_p, c_long, c_int, pointer
from ctypes.util import find_library
from spectrum.common import check_device


LIBRARY = 'keystonecomm'
MODE_FM = 1


# load the DLL
def _load_dll():
    library = find_library(LIBRARY)
    if library is None:
        raise ImportError("Could not find library {0}".format(LIBRARY))
    cdll.LoadLibrary(library)
    return CDLL(library)

DLL = _load_dll()

class RdsApi(object):
    """ Ctypes wrapper for the Keystone monkey board comms DLL.
    """
    def __init__(self, device, use_hard_mute=True):
        self.device = check_device(device)
        self.use_hard_mute = use_hard_mute
        self._buffer = create_unicode_buffer(300)

    def __enter__(self):
        value = DLL.OpenRadioPort(c_char_p(self.device), self.use_hard_mute)
        if value != 1:
            raise Exception("Error opening monkey board: {0}".format(value))
        return self

    def __exit__(self, *args):
        value = DLL.CloseRadioPort()
        if value != 1:
            raise Exception("Error closing monkey board: {0}".format(value))

    def set_frequency(self, freq): # pylint: disable=no-self-use
        """ Set RDS decode frequency.
        """
        value = DLL.PlayStream(c_char_p(MODE_FM), c_long(int(freq / 1000)))
        if value != 1:
            raise Exception("Error setting frequencya: {0}".format(value))

    def get_strength(self): # pylint: disable=no-self-use
        """ Read the signal strength.
        """
        error = pointer(c_int(0))
        strength = DLL.GetSignalStrength(error)
        if error.contents.value != 0:
            raise Exception("Error reading signal strength: {0}".format(error.contents.value))
        return strength

    def get_name(self):
        """ Read the decoded RDS name string.
        """
        value = DLL.GetProgramName(c_char_p(MODE_FM), c_long(0), c_char_p(1), self._buffer)
        return self._buffer.value.strip() if value > 0 else None

    def get_text(self):
        """ Read the decoded RDS text string.
        """
        value = DLL.GetProgramText(self._buffer)
        return self._buffer.value.strip() if value == 0 else None
