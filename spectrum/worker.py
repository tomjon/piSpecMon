import requests
import json
from monitor import Monitor, get_capabilities, frange
from time import sleep, time, strftime, localtime
from md5 import md5
import Hamlib
import math
from datetime import datetime
import os, os.path


#FIXME this is shared with server.py
ELASTICSEARCH = 'http://localhost:9200/'

CONFIG_FILE = '.config'
MONITOR_FILE = '.monitor'

_stop = False


def convert(d):
  """ Auto-convert empty strings into None, and number strings into numbers.
  """
  for k, v in d.iteritems():
    if v.strip() == '':
      d[k] = None
      continue
    try:
      d[k] = int(v)
    except:
      try:
        d[k] = float(v)
      except:
        pass


def now():
  """ Return time in milliseconds since the epoch.
  """
  return int(time() * 1000)


def run():
  global _stop
  _stop = False

  if not os.path.isfile(CONFIG_FILE):
    return
  with open(CONFIG_FILE) as f:
    config = json.loads(f.read())

  data = { 'timestamp': now(), 'json': json.dumps(config) }
  r = requests.post(ELASTICSEARCH + 'spectrum/config/', params={ 'refresh': 'true' }, data=json.dumps(data))
  if r.status_code != 201:
    print "Can not post config:", r.status_code, config
    return
  config_id = r.json()['_id']
  os.remove(CONFIG_FILE)

  with open(MONITOR_FILE, 'w') as f:
    f.write(config_id)

  convert(config['rig'])
  convert(config['monitor'])
  convert(config['scan'])

  rig = config['rig']
  period = config['monitor'].get('period', 1.0)

  # scan settings
  scan = config['scan']
  for x in config['freqs']:
    # x is either 'range' or 'freqs'
    if x == 'range':
      exp = int(config['freqs']['exp'])
      scan[x] = [ 10 ** exp * float(f) for f in config['freqs'][x] ]
    elif x == 'freqs':
      scan[x] = [ 10 ** int(f['exp']) * float(f['f']) for f in config['freqs'][x] ]
    else:
      raise ValueError("Bad key in config.freqs")
    break
  else:
    raise ValueError("No frequencies in config")

  timestamp = None
  try:
    with Monitor(**rig) as scanner:
      n = 0
      while not _stop:
        print "Scan:", scan
        t0 = now()
        sweep = { 'config_id': config_id, 'n': n, 'timestamp': t0, 'level': [] }
        n += 1

        os.utime(MONITOR_FILE, None)
        for x in scanner(**scan):
          if _stop:
            break
          sweep['level'].append(x[1] if x[1] is not None else -128)
        else:
          sweep['totaltime'] = now() - t0

          r = requests.post(ELASTICSEARCH + '/spectrum/sweep/', params={ 'refresh': 'true' }, data=json.dumps(sweep))
          if r.status_code != 201:
            print "Could not post to Elasticsearch (" + r.status_code + ")"
            return

          sleep(max(period - sweep['totaltime'], 0))
  except Exception as e:
    print e
    data = { 'timestamp': now(), 'config_id': config_id, 'json': json.dumps(str(e)) }
    params = { 'refresh': 'true' }
    requests.post(ELASTICSEARCH + 'spectrum/error/', params=params, data=json.dumps(data))
  finally:
    os.remove(MONITOR_FILE)


def status():
  if not os.path.isfile(MONITOR_FILE):
    return None
  stat = os.stat(MONITOR_FILE)
  with open(MONITOR_FILE) as f:
    return { 'config_id': f.read(), 'last_sweep': stat.st_mtime }


def stop(*args):
  global _stop
  _stop = True


if __name__ == "__main__":
  import signal
  import Hamlib

  Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)

  signal.signal(signal.SIGUSR1, stop)
  print os.getpid()

  while True:
    signal.pause()
    run()

