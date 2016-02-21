import requests
import json
from monitor import Monitor, get_capabilities, frange
from time import sleep, time
import os, os.path
import signal


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


class WorkerInit:

  def __init__(self, elasticsearch='http://localhost:9200/', config_file = '.config', monitor_file='.monitor', signum=signal.SIGUSR1):
    self.elasticsearch = elasticsearch
    self.config_file = config_file
    self.monitor_file = monitor_file

  def worker(self):
    return Worker(self)

  def client(self):
    return Client(self)


class Worker:

  def __init__(self, init):
    self.init = init
    self.stop = False

  def run():
    self.stop = False

    if not os.path.isfile(self.init.config_file):
      return
    with open(self.init.config_file) as f:
      config = json.loads(f.read())

    data = { 'timestamp': now(), 'json': json.dumps(config) }
    r = requests.post(ELASTICSEARCH + 'spectrum/config/', params={ 'refresh': 'true' }, data=json.dumps(data))
    if r.status_code != 201:
      print "Can not post config:", r.status_code, config
      return
    config_id = r.json()['_id']
    os.remove(self.init.config_file)

    with open(self.init.monitor_file, 'w') as f:
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
        while not self.stop:
          print "Scan:", scan
          t0 = now()
          sweep = { 'config_id': config_id, 'n': n, 'timestamp': t0, 'level': [] }
          n += 1

          os.utime(self.init.monitor_file, None)
          for x in scanner(**scan):
            if self.stop:
              break
            sweep['level'].append(x[1] if x[1] is not None else -128)
          else:
            sweep['totaltime'] = now() - t0

            r = requests.post(self.init.elasticsearch + '/spectrum/sweep/', params={ 'refresh': 'true' }, data=json.dumps(sweep))
            if r.status_code != 201:
              print "Could not post to Elasticsearch (" + r.status_code + ")"
              return

            sleep(max(period - sweep['totaltime'], 0))
    except Exception as e:
      print e
      data = { 'timestamp': now(), 'config_id': config_id, 'json': json.dumps(str(e)) }
      params = { 'refresh': 'true' }
      requests.post(self.init.elasticsearch + 'spectrum/error/', params=params, data=json.dumps(data))
    finally:
      os.remove(self.init.monitor_file)

  def stop(self, *args):
    self.stop = True

  def start(self):
    signal.signal(self.init.signum, self.stop)
    while True:
      signal.pause()
      self.run()


class Client:

  def __init__(self, init, worker_pid):
    self.worker_pid = worker_pid
    self.init = init

  def status(self):
    if not os.path.isfile(self.init.monitor_file):
      return None
    stat = os.stat(self.init.monitor_file)
    with open(self.init.monitor_file) as f:
      return { 'config_id': f.read(), 'last_sweep': stat.st_mtime }

  def sweep(self, config):
    with open(self.init.config_file, 'w') as f:
      f.write(config)
    os.kill(self.worker_pid, self.init.signum)

  def stop(self):
    os.kill(self.worker_pid, self.init.signum)


if __name__ == "__main__":
  import Hamlib

  print os.getpid()
  Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)
  WorkerInit().worker().start()
