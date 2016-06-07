from config import *
import requests
import json
import logging, logging.handlers
import sys
import os, os.path


""" Initialise logging and define shared functions.
"""

if not os.path.exists('logs'):
  os.mkdir('logs')

log = logging.getLogger('werkzeug') # use this name so flask doesn't use its own logger
log.setLevel(logging.DEBUG)

# create file handler which logs even debug messages (these end up in log file)
filename = 'logs/{0}'.format(sys.argv[0].replace('.py', '.log'))
rfh = logging.handlers.RotatingFileHandler(filename, maxBytes=1 * 1024 * 1024, backupCount=0)
rfh.setLevel(logging.DEBUG)

# create console handler with a higher log level (these end up in system journal)
ch = logging.StreamHandler()
ch.setLevel(logging.ERROR)

# create formatter and add it to the handlers
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
rfh.setFormatter(formatter)
ch.setFormatter(formatter)

# add the handlers to the logger
log.addHandler(rfh)
log.addHandler(ch)


def get_config(config_id):
  r = requests.get('%s/spectrum/config/_search?fields=*&q=_id:%s' % (ELASTICSEARCH, config_id))
  if r.status_code != 200:
    return r.text, r.status_code
  hits = r.json()['hits']['hits']
  if len(hits) == 0:
    return 'No such config id', 404
  return json.loads(hits[0]['fields']['json'][0])
