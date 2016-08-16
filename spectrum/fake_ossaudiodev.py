import time

AFMT_S16_LE = 1
_open = open

class FakeAudio:

  def __enter__(self):
    self._f = _open('/dev/random')
    return self

  def __exit__(self, *args):
    self._f.close()

  def channels(self, channels):
    self.channels = channels

  def setfmt(self, fmt):
    pass

  def speed(self, speed):
    self.speed = speed

  def read(self, size):
    t0 = time.time()
    s = self._f.read(size)
    time.sleep(size / float(self.speed * self.channels) - time.time() + t0)
    return s
    

def open(*args):
  return FakeAudio()
