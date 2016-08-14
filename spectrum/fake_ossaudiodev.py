AFMT_S16_LE = 1
_open = open

class FakeAudio:

  def __enter__(self):
    self._f = _open('/dev/random')
    return self

  def __exit__(self, *args):
    self._f.close()

  def channels(self, n):
    pass

  def setfmt(self, fmt):
    pass

  def speed(self, speed):
    pass

  def read(self, size):
    return self._f.read(size)


def open(*args):
  return FakeAudio()
