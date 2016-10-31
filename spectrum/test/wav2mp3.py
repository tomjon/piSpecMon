from spectrum.wav2mp3 import *
import os
import shutil
import pytest


@pytest.fixture()
def sample():
    class Sample(object):
        def __init__(self, *path):
            self.path = os.path.join(*[str(x) for x in path])

        def create(self):
            try:
                os.makedirs(os.path.dirname(self.path))
            except OSError:
                pass
            shutil.copy('sample.wav', self.path)
    return Sample


# on an empty directory, walk_convert should do nothing and not complain
def test_empty(tmpdir):
    walk_convert(str(tmpdir))


# create a basic directory structure and check walk_convert creates mp3s and removes wavs
def test_walk(tmpdir, sample):
    s1 = sample(tmpdir, 'foo', '1.wav')
    s2 = sample(tmpdir, 'foo', 'bar', '2.wav')
    s3 = sample(tmpdir, 'foo', 'bar', '3.wav')
    samples = [s1, s2, s3]

    for s in samples:
        s.create()
        assert os.path.exists(s.path)

    walk_convert(str(tmpdir))

    for s in samples:
        assert not os.path.exists(s.path)
        assert os.path.exists("{0}.mp3".format(s.path[:s.path.rindex('.')]))
