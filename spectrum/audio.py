""" Module for recording from an audio device.
"""
import wave
try:
    import ossaudiodev
except ImportError:
    import spectrum.fake_ossaudiodev as ossaudiodev
from spectrum.common import check_device

FORMAT = ossaudiodev.AFMT_S16_LE
SAMPLE_WIDTH = 2

def chunks(x, n):
    i = iter(x)
    while True:
        yield ''.join([i.next() for _ in xrange(n)])

class Recorder(object): # pylint: disable=too-few-public-methods
    """ API for recording audio. Specify None for a path to ignore that channel.

        path_left - audio sample path for left channel
        path_right - audio sample path for right channel
        device - audio device path
    """
    def __init__(self, path_left, path_right, device):
        self.paths = path_left, path_right
        self.wavs = None, None
        self.device = check_device(device)
        self.audio = None

    def __enter__(self):
        self.audio = ossaudiodev.open(self.device, 'r')
        self.wavs = [wave.open(path, 'w') if path is not None else None for path in self.paths]
        return self

    def record(self, monitor, freq, rate, duration):
        """ Record audio.
        """
        if not monitor.set_frequency(freq):
            raise Exception("could not set frequency")
        self.audio.setparameters(FORMAT, 2, rate, True)
        for wav in self.wavs:
            if wav is None: continue
            wav.setsampwidth(SAMPLE_WIDTH)
            wav.setnchannels(1)
            wav.setframerate(rate)
        yield monitor.get_strength()
        for _ in xrange(duration):
            data = self.audio.read(SAMPLE_WIDTH * 2 * rate)
            chunked = list(chunks(data, SAMPLE_WIDTH))
            for offset, wav in enumerate(self.wavs):
                if wav is None: continue
                wav.writeframes(''.join(chunked[offset::2]))
            yield monitor.get_strength()

    def __exit__(self, *args):
        for wav in self.wavs:
            if wav is None: continue
            wav.close()
        self.audio.close()
