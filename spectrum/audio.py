""" Module for recording from an audio device. Publishes left/right channels
    to ZMQ message topics.
"""
import os
import shutil
import wave
from tempfile import NamedTemporaryFile
import zmq
from spectrum.common import log, check_device
from spectrum.config import AUDIO_OSS_DEVICE, AUDIO_ZMQ_PORT, AUDIO_RATE, AUDIO_AAC_BITRATE

try:
    import ossaudiodev
except ImportError:
    log.warn("No audio support")
    import spectrum.fake_ossaudiodev as ossaudiodev

try:
    import pyfaac
except ImportError:
    log.warn("No live streaming support")
    pyfaac = None

# fixed format and rate for now
FORMAT = ossaudiodev.AFMT_S16_LE
SAMPLE_WIDTH = 2

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
        self.audio.setparameters(FORMAT, 2, AUDIO_RATE, True)
        while True:
            data = self.audio.read(SAMPLE_WIDTH * 2 * AUDIO_RATE) # read a one second chunk
            chunked = list(chunks(data, SAMPLE_WIDTH))
            for offset, topic in enumerate((CHANNEL_LEFT, CHANNEL_RIGHT)):
                msg = ''.join(chunked[offset::2])
                self.socket.send('{0} {1}'.format(topic, msg))


class _AudioBase(object):
    def __init__(self, channel):
        if channel not in (CHANNEL_LEFT, CHANNEL_RIGHT):
            raise Exception("Bad channel: " + channel)
        self.channel = channel

    def __enter__(self):
        self.socket = zmq.Context().socket(zmq.SUB)
        self.socket.connect('tcp://localhost:{0:d}'.format(AUDIO_ZMQ_PORT))
        self.socket.setsockopt(zmq.SUBSCRIBE, str(self.channel))
        return self

    def __exit__(self, *args):
        self.socket.close()


class AudioClient(_AudioBase):
    """ Client API for recording audio from a channel to a wav file.
    """
    def __init__(self, channel, f=None):
        super(AudioClient, self).__init__(channel)
        self.socket = None
        self.f = f # a file-like object, otherwise a temporary file is created

    def __enter__(self):
        self.temp = NamedTemporaryFile(delete=False, mode='wb') if self.f is None else None
        self.path = None
        self.wav = wave.open(self.temp or self.f, 'wb')
        self.wav.setsampwidth(SAMPLE_WIDTH)
        self.wav.setnchannels(1)
        self.wav.setframerate(AUDIO_RATE)
        return super(AudioClient, self).__enter__()

    def __exit__(self, *args):
        self.wav.close()
        if self.temp is not None:
            self.temp.close()
            if self.path is not None:
                shutil.copyfile(self.temp.name, self.path) # copy because might be on a different drive from /tmp
            os.remove(self.temp.name)
        else:
            self.f.close()
        super(AudioClient, self).__exit__(*args)

    def __iter__(self):
        while True:
            msg = self.socket.recv()[2:] # ignore topic and space following
            self.wav.writeframes(msg)
            yield

    def write(self, path):
        if self.temp is None:
            raise Exception("No temporary file exists (file like object specified at __init__)")
        self.path = path


class AudioStream(_AudioBase):
    """ Client API for streaming audio from a channel.
    """
    def __init__(self, channel, f_out):
        if pyfaac is None:
            raise "No support for audio streaming (missing pyfaac)"
        super(AudioStream, self).__init__(channel)
        self.f_out = f_out
        self.codec = pyfaac.pyfaac(AUDIO_RATE, 1, AUDIO_AAC_BITRATE)
        self.size = self.codec.getSize()

    def __iter__(self):
        while True:
            data = self.socket.recv()[2:]
            packets = []
            offset = 0
            while offset < len(data):
                stream = self.codec.encode(data[offset:offset + self.size])
                packets.append(stream)
                offset += self.size
            yield packets

    def __exit__(self, *args):
        #excess = self.codec.close()
        #self.f_out.write(excess)
        self.f_out.flush()
        super(AudioStream, self).__exit__(*args)
