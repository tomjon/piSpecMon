from ctypes import *
from ctypes.util import *
from common import scan

LIBRARY = 'keystonecomm'
MODE_FM = 1

_buffer = create_unicode_buffer(300)

class RdsApi:

  def __init__(self, device, use_hard_mute=True):
    library = find_library(LIBRARY)
    if library is not None:
      cdll.LoadLibrary(library)
      self.dll = CDLL(library)
    else:
      raise Exception("Could not find library {0}".format(LIBRARY))
    self.device = device
    self.use_hard_mute = use_hard_mute

  def __enter__(self):
    value = self.dll.OpenRadioPort(c_char_p(self.device), self.use_hard_mute)
    if value != 1:
      raise Exception("Error opening monkey board: {0}".format(value))
    return self

  def __exit__(self, *args):
    value = self.dll.CloseRadioPort()
    if value != 1:
      raise Exception("Error closing monkey board: {0}".format(value))

  def set_frequency(self, freq):
    value = self.dll.PlayStream(c_char_p(MODE_FM), c_long(int(freq / 1000)))
    if value != 1:
      raise Exception("Error setting frequencya: {0}".format(value))

  def get_strength(self):
    error = pointer(c_int(0))
    strength = self.dll.GetSignalStrength(error)
    if error.contents.value != 0:
      raise Exception("Error reading signal strength: {0}".format(error.contents.value))
    return strength

  def get_name(self):
    value = self.dll.GetProgramName(c_char_p(MODE_FM), c_long(0), c_char_p(1), _buffer)
    return _buffer.value.strip() if value > 0 else None

  def get_text(self):
    value = self.dll.GetProgramText(_buffer)
    return _buffer.value.strip() if value == 0 else None
