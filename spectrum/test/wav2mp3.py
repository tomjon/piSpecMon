""" Unit tests for wav2mp3 module.
"""
import os
import shutil
import pytest
from spectrum.wav2mp3 import walk_convert

#FIXME only tests one export from wav2mp3, also use a real .wav and check the .mp3 output

@pytest.fixture()
def sample():
    """ Pytest fixture returning a class that wraps a sample path.
    """
    class Sample(object):
        """ Class wrapping a sample path.
        """
        def __init__(self, *path):
            self.path = os.path.join(*[str(x) for x in path])

        def create(self):
            """ Copy sample.wav to the path.
            """
            try:
                os.makedirs(os.path.dirname(self.path))
            except OSError:
                pass
            shutil.copy('sample.wav', self.path)
    return Sample


def test_empty(tmpdir):
    """ On an empty directory, walk_convert should do nothing and not complain.
    """
    walk_convert(str(tmpdir))


def test_walk(tmpdir, sample):
    """ Create a basic directory structure and check walk_convert creates mp3s
        and removes wavs.
    """
    s_1 = sample(tmpdir, 'foo', '1.wav')
    s_2 = sample(tmpdir, 'foo', 'bar', '2.wav')
    s_3 = sample(tmpdir, 'foo', 'bar', '3.wav')
    samples = [s_1, s_2, s_3]

    # create samples and check the files appeared
    for sample in samples:
        sample.create()
        assert os.path.exists(sample.path)

    # do the conversion (this is what we are testing)
    walk_convert(str(tmpdir))

    # check each wav became an mp3
    for sample in samples:
        assert not os.path.exists(sample.path)
        name = sample.path[:sample.path.rindex('.')]
        assert os.path.exists("{0}.mp3".format(name))

    # check we have the right number of mp3s (and no wavs)
    count = 0
    for _, _, filenames in os.walk(str(tmpdir)):
        for filename in filenames:
            assert filename.endswith('.mp3')
            count += 1
    assert count == 3
