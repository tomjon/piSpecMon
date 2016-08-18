from config import *
from common import *

import os
from pydub import AudioSegment

def convert(dirpath, wav_filename):
  mp3_filename = os.path.splitext(os.path.basename(wav_filename))[0] + '.mp3'
  wav_path = os.path.join(dirpath, wav_filename)
  mp3_path = os.path.join(dirpath, mp3_filename)
  log.debug("Converting {0} -> {1}".format(wav_path, mp3_path))
  AudioSegment.from_file(wav_path).export(mp3_path, format='mp3')
  return wav_path, mp3_path

def walk_convert(rootdir):
  log.debug("Walking from path: {0}".format(rootdir))
  for dirpath, dirnames, filenames in os.walk(rootdir):
    for filename in filenames:
      if filename.endswith('.wav'):
        wav_path, mp3_path = convert(dirpath, filename)
        if os.path.exists(mp3_path):
          os.remove(wav_path)

if __name__ == "__main__":
  import time

  while True:
    walk_convert('wav')
    log.debug("Sleeping for {0}s".format(CONVERT_PERIOD))
    time.sleep(CONVERT_PERIOD)
