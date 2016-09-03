from config import *
import requests
import json
import logging, logging.handlers
import sys
import os, os.path
import itertools
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
rfh.setLevel(logging.DEBUG)

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


def get_config(config_id):
  r = requests.get('%s/spectrum/config/_search?fields=*&q=_id:%s' % (ELASTICSEARCH, config_id))
  if r.status_code != 200:
    return None #FIXME need to throw or return an error somehow
  hits = r.json()['hits']['hits']
  return json.loads(hits[0]['fields']['json'][0]) if len(hits) > 0 else None


def scan(freqs=[], range=None, **ignore):
  idx = 0
  for freq in itertools.chain(freqs, frange(*range) if range is not None else []):
    yield idx, freq
    idx += 1

#FIXME this could be 'private' if no-one else is using it outside the module (currently at least monitor.py is)
def frange(min, max, step):
  digits = -int(round(math.log10(step)))
  N = round((max - min) / float(step))
  for n in xrange(int(N) + 1):
    yield round(min + n * step, digits)


def wait_for_elasticsearch():
  while True:
    try:
      r = requests.get('%s/_cluster/health' % ELASTICSEARCH)
      if r.status_code != 200:
        log.warn("Elasticsearch status %s" % r.status_code)
      else:
        status = r.json()['status']
        if status != 'red':
          log.info("Elasticsearch up and running ({0})".format(status))
          return
        log.warn("Elasticsearch cluster health status: %s" % status)
    except requests.exceptions.ConnectionError:
      log.warn("No elasticsearch... waiting")
    sleep(2)
