from config import *
from common import *

import requests
import json
from monitor import Monitor, get_capabilities, frange
from time import sleep, time
import os, os.path
import signal
import common
import errno
import traceback

""" The worker process can be signalled to start and stop operation.

    When signalled to start, it checks for a .monitor file; if there is one, it contains the ElasticSearch config_id
    which is used to look up the config.
    
    Otherwise, it checks for a .config file, and if there is one, config JSON is read from it, and uploaded
    to ES and a config_id obtained, which is written to the .monitor file. The .config file is removed.
    
    Thus, .monitor file is used in preference to .config - if both exist, .config is ignored and not consumed.
    
    The .monitor file is touched at the start of each sweep.
    
    The worker runs until stopped by another signal, and the .monitor file is removed.
"""


def convert(d):
  """ Auto-convert empty strings into None, and number strings into numbers.
  """
  for k, v in d.iteritems():
    if not isinstance(v, basestring):
      continue
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

  # the _file parameters here would be prefices if more than one worker needs to run concurrently
  def __init__(self, elasticsearch=ELASTICSEARCH, config_file=WORKER_CONFIG, monitor_file=WORKER_MONITOR, signum=signal.SIGUSR1):
    self.elasticsearch = elasticsearch
    self.config_file = config_file
    self.monitor_file = monitor_file
    self.signum = signum

  def worker(self):
    return Worker(self)

  def client(self):
    return Client(self)


class Worker:

  def __init__(self, init):
    self.init = init
    self._stop = False

  def run(self):
    """ Uses files .config and .monitor to communicate state. (The .pid file is managed elsewhere.)
        
        If .monitor exists, it contains the ElasticSearch config_id, look up config in ES
        If not, read config JSON from .config and insert into ES - remove .config and create .monitor
        
        Whilst running, the .monitor file is touched to indicate the last sweep time

        If stopped normally, removes .monitor (otherwise .monitor remains)
    """
    self._stop = False

    if isfile_local(self.init.monitor_file):
      with open_local(self.init.monitor_file) as f:
        config_id = f.read()
      config = common.get_config(config_id)
    else:
      if not isfile_local(self.init.config_file):
        return
      with open_local(self.init.config_file) as f:
        config = json.loads(f.read())

      data = { 'timestamp': now(), 'json': json.dumps(config) }
      r = requests.post(self.init.elasticsearch + 'spectrum/config/', params={ 'refresh': 'true' }, data=json.dumps(data))
      if r.status_code != 201:
        log.error("Can not post config: {0} {1}".format(r.status_code, config))
        return
      config_id = r.json()['_id']
      os.remove(self.init.config_file)

      with open_local(self.init.monitor_file, 'w') as f:
        f.write(config_id)

    try:
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
      with Monitor(**rig) as scanner:
        n = 0
        while not self._stop:
          log.debug("Scan: {0}".format(scan))
          t0 = now()
          sweep = { 'config_id': config_id, 'n': n, 'timestamp': t0, 'level': [] }
          n += 1

          os.utime(self.init.monitor_file, None)
          for x in scanner(**scan):
            if self._stop:
              break
            sweep['level'].append(x[1] if x[1] is not None else -128)
          else:
            sweep['totaltime'] = now() - t0

            r = requests.post(self.init.elasticsearch + '/spectrum/sweep/', params={ 'refresh': 'true' }, data=json.dumps(sweep))
            if r.status_code != 201:
              log.error("Could not post to Elasticsearch ({0})".format(r.status_code))
              return

            sleep(max(period - sweep['totaltime'], 0))
    except Exception as e:
      log.error(e)
      data = { 'timestamp': now(), 'config_id': config_id, 'json': json.dumps(str(e)) }
      params = { 'refresh': 'true' }
      requests.post(self.init.elasticsearch + 'spectrum/error/', params=params, data=json.dumps(data))
    finally:
      os.remove(self.init.monitor_file)
      log.info('Scanning stopped')

  def stop(self, *args):
    self._stop = True

  def start(self):
    signal.signal(self.init.signum, self.stop)
    while True:
      self.run()
      signal.pause()


class WorkerClient:

  def __init__(self, init):
    self.init = init
    self.error = None

  def read_pid(self):
    try:
      self.worker_pid = read_pid_file()
      self.error = None
    except ProcessError as e:
      self.error = e.message
    if self.worker_pid is None:
      self.error = "No worker process"
    return self.worker_pid

  def status(self):
    result = { }
    self.read_pid()
    if self.error is not None:
      result['error'] = self.error
    if isfile_local(self.init.monitor_file):
      stat = os.stat(self.init.monitor_file)
      with open_local(self.init.monitor_file) as f:
        result.update({ 'config_id': f.read(), 'last_sweep': stat.st_mtime })
    return result

  def start(self, config):
    if self.read_pid() is not None:
      with open_local(self.init.config_file, 'w') as f:
        f.write(config)
      os.kill(self.worker_pid, self.init.signum)

  def stop(self):
    if self.read_pid() is not None:
      os.kill(self.worker_pid, self.init.signum)


class ProcessError:

  def __init__(self, message):
    self.message = message


def read_pid_file():
  try:
    with open_local(PID_FILE) as f:
      worker_pid = f.read().strip()
    worker_pid = int(worker_pid)
    os.kill(worker_pid, 0)
    return worker_pid
  except IOError:
    raise ProcessError("Can not open PID file: {0}".format(PID_FILE))
  except ValueError:
    raise ProcessError("Bad worker PID: {0}".format(worker_pid))
  except OSError as e:
    raise ProcessError("Bad worker PID ({0}): {1}".format(errno.errorcode[e.errno], worker_pid))


if __name__ == "__main__":
  import Hamlib, sys

  signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

  try:
    pid = read_pid_file()
    if pid is not None:
      log.error("Worker process already exists: {0}".format(pid))
      sys.exit(1)
  except ProcessError:
    pass

  try:
    with open_local(PID_FILE, 'w') as f:
      f.write(str(os.getpid()))
    log.info("Starting worker process")

    with open_local(common.log_filename, 'a') as f:
      Hamlib.rig_set_debug_file(f)
      Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)
      WorkerInit().worker().start()
  except KeyboardInterrupt:
    os.remove(PID_FILE)
  except SystemExit as e:
    if e.code == 0:
      os.remove(PID_FILE)
    else:
      raise
