from config import *
import requests
import json
import logging, logging.handlers
import sys
import os, os.path
import itertools
import math
from time import time, sleep

""" Initialise logging and define shared functions.
"""

def local_path(filename):
  dir = os.path.dirname(__file__)
  return os.path.join(dir, filename)


log_dir = local_path('logs')
if not os.path.exists(log_dir):
  os.mkdir(log_dir)

log = logging.getLogger('werkzeug') # use this name so flask doesn't use its own logger
log.setLevel(logging.DEBUG)

# create file handler which logs even debug messages (these end up in log file)
log_filename = os.path.join(log_dir, '{0}.log'.format(os.path.basename(sys.argv[0]).replace('.py', '')))
rfh = logging.handlers.RotatingFileHandler(log_filename, maxBytes=1 * 1024 * 1024, backupCount=0)
rfh.setLevel(logging.INFO)

# create console handler with a higher log level (these end up in system journal)
ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG if 'debug' in sys.argv else logging.ERROR)

# create formatter and add it to the handlers
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
rfh.setFormatter(formatter)
ch.setFormatter(formatter)

# add the handlers to the logger
log.addHandler(rfh)
log.addHandler(ch)


def now():
  """ Return time in milliseconds since the epoch.
  """
  return int(time() * 1000)


def scan(freqs=[], range=None, **ignore):
  idx = 0
  for freq in itertools.chain(freqs, xrange(*range) if range is not None else []):
    yield idx, freq
    idx += 1


def _convert(d):
  """ Auto-convert empty strings into None, number strings into numbers, and boolean strings into booleans.
      Recurse into dictionaries.
  """
  for k, v in d.iteritems():
    if isinstance(v, dict):
      _convert(v)
    if not isinstance(v, basestring):
      continue
    v = v.strip()
    if v == '':
      d[k] = None
      continue
    if v.lower() == 'true':
      d[k] = True
      continue
    if v.lower() == 'false':
      d[k] = False
      continue
    try:
      d[k] = int(v)
      continue
    except:
      pass
    try:
      d[k] = float(v)
      continue
    except:
      pass

def parse_config(config):
  _convert(config)
  scan = { }
  for x in config['freqs']:
    # x is either 'range' or 'freqs'
    if x == 'range':
      exp = int(config['freqs']['exp'])
      scan[x] = [ int(10 ** exp * float(f)) for f in config['freqs'][x] ]
      scan[x][1] += scan[x][2] / 2 # ensure to include the end of the range
    elif x == 'freqs':
      scan[x] = [ int(10 ** int(f['exp']) * float(f['f'])) for f in config['freqs'][x] ]
    else:
      raise ValueError("Bad key in config.freqs")
    break
  else:
    raise ValueError("No frequencies in config")
  return scan


class StoreError (Exception):
    def __init__(self, message):
        log.error(message)
        self.message = message
