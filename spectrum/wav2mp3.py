""" Module for converting wav format files to mp3 format.
"""
import os
import shutil
import subprocess
from tempfile import mkstemp
from spectrum.common import log

def convert(dir_path, wav_filename):
    """ Convert the wav file specified by the given path and filename to mp3.
    """
    mp3_filename = os.path.splitext(os.path.basename(wav_filename))[0] + '.mp3'
    wav_path = os.path.join(dir_path, wav_filename)
    mp3_path = os.path.join(dir_path, mp3_filename)
    log.debug("Converting %s -> %s", wav_path, mp3_path)
    f, tmp_path = mkstemp()
    os.close(f)
    try:
        subprocess.call(['avconv', '-loglevel', 'warning', '-y', '-f', 'wav', '-i', wav_path, '-f', 'mp3', tmp_path])
        shutil.copyfile(tmp_path, mp3_path) # use copyfile so we can go across file systems
        return wav_path, mp3_path
    except (IOError, MemoryError, KeyboardInterrupt) as e:
        log.exception("Could not convert %s: %s", wav_path, e)
        return None, None
    finally:
        os.remove(tmp_path)

def walk_convert(root_dir):
    """ Walk the file system starting at root_dir, converting wav files to mp3.
    """
    log.info("Walking from path: %s", root_dir)
    for dir_path, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith('.wav'):
                wav_path, mp3_path = convert(dir_path, filename)
                if wav_path is not None and os.path.exists(mp3_path):
                    os.remove(wav_path)
    log.info("Done")
