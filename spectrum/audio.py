""" Module for recording from an audio device. Publishes left/right channels
    to ZMQ message topics.
"""
import wave
import zmq
from spectrum.config import AUDIO_OSS_DEVICE, AUDIO_ZMQ_PORT
try:
    import ossaudiodev
except ImportError:
    import spectrum.fake_ossaudiodev as ossaudiodev
from spectrum.common import check_device

# fixed format and rate for now
FORMAT = ossaudiodev.AFMT_S16_LE
SAMPLE_WIDTH = 2
RATE = 44100

# these contants are used to specify channel
CHANNEL_LEFT = 'L'
CHANNEL_RIGHT = 'R'

def chunks(x, n):
    i = iter(x)
    while True:
        yield ''.join([i.next() for _ in xrange(n)])

class AudioServer(object): # pylint: disable=too-few-public-methods
    """ Service for publishing left/right audio channels.

        device - audio device path
        port - publish on tcp://localhost:[port]
    """
    def __init__(self):
        self.audio = None
        self.socket = None

    def __enter__(self):
        self.audio = ossaudiodev.open(check_device(AUDIO_OSS_DEVICE), 'r')
        self.socket = zmq.Context().socket(zmq.PUB)
        self.socket.bind('tcp://*:{0:d}'.format(AUDIO_ZMQ_PORT))
        return self

    def __exit__(self, *args):
        self.socket.close()
        self.audio.close()

    def run(self):
        """ Grab audio and publish wav frames on left/right.
        """
        self.audio.setparameters(FORMAT, 2, RATE, True)
        while True:
            data = self.audio.read(SAMPLE_WIDTH * 2 * RATE) # read a one second chunk
            chunked = list(chunks(data, SAMPLE_WIDTH))
            for offset, topic in enumerate((CHANNEL_LEFT, CHANNEL_RIGHT)):
                msg = ''.join(chunked[offset::2])
                self.socket.send('{0} {1}'.format(topic, msg))


class AudioClient(object):
    """ Client API for recording audio to a wav file.
    """
    def __init__(self, channel, path):
        self.socket = None
        self.channel = channel
        self.path = path

    def __enter__(self):
        self.socket = zmq.Context().socket(zmq.SUB)
        self.socket.connect('tcp://localhost:{0:d}'.format(AUDIO_ZMQ_PORT))
        self.socket.setsockopt(zmq.SUBSCRIBE, self.channel)
        self.wav = wave.open(self.path, 'w')
        self.wav.setsampwidth(SAMPLE_WIDTH)
        self.wav.setnchannels(1)
        self.wav.setframerate(RATE)
        return self

    def __exit__(self, *args):
        self.wav.close()
        self.socket.close()

    def __iter__(self):
        while True:
            msg = self.socket.recv()[2:] # ignore topic and space following
            self.wav.writeframes(msg)
            yield
        
