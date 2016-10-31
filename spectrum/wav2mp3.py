""" Module for converting wav format files to mp3 format.
"""
import os
from pydub import AudioSegment
from spectrum.common import log

def convert(dir_path, wav_filename):
    """ Convert the wav file specified by the given path and filename to mp3.
    """
    mp3_filename = os.path.splitext(os.path.basename(wav_filename))[0] + '.mp3'
    wav_path = os.path.join(dir_path, wav_filename)
    mp3_path = os.path.join(dir_path, mp3_filename)
    log.debug("Converting %s -> %s", wav_path, mp3_path)
    AudioSegment.from_file(wav_path).export(mp3_path, format='mp3')
    return wav_path, mp3_path

def walk_convert(root_dir):
    """ Walk the file system starting at root_dir, converting wav files to mp3.
    """
    log.debug("Walking from path: %s", root_dir)
    for dir_path, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith('.wav'):
                wav_path, mp3_path = convert(dir_path, filename)
                if os.path.exists(mp3_path):
                    os.remove(wav_path)
