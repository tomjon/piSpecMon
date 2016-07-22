from config import *
from common import *

import requests
import json
from monitor import Monitor, TimeoutError, get_capabilities, frange
from power import power_on
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
  def __init__(self, elasticsearch=ELASTICSEARCH, pid_file=PID_FILE, config_file=WORKER_CONFIG, monitor_file=WORKER_MONITOR):
    self.elasticsearch = elasticsearch
    self.pid_file = local_path(pid_file)
    self.config_file = local_path(config_file)
    self.monitor_file = local_path(monitor_file)

  def worker(self):
    return Worker(self)

  def client(self):
    return Client(self)

  def read_pid_file(self):
    if not os.path.isfile(self.pid_file):
      return None
    try:
      with open(self.pid_file) as f:
        worker_pid = f.read().strip()
      worker_pid = int(worker_pid)
      os.kill(worker_pid, 0)
      return worker_pid
    except IOError:
      raise ProcessError("Can not open PID file: {0}".format(self.pid_file))
    except ValueError:
      raise ProcessError("Bad worker PID: {0}".format(worker_pid))
    except OSError as e:
      raise ProcessError("Bad worker PID ({0}): {1}".format(errno.errorcode[e.errno], worker_pid))


class Worker:

  def __init__(self, init):
    self.init = init
    self._exit = False
    self._tidy = True
    self._power_off = False
    self._timeout_count = 0
    self.set_signal('SIGUSR1')
    self.set_signal('SIGUSR2', power_off=True)

  def set_signal(self, signame, exit=False, tidy=True, power_off=False):
    """ Define signal handler for given signal in order to exit cleanly.
    """
    signal.signal(getattr(signal, signame), lambda *_: self.stop(signame, exit, tidy, power_off))

  def _init_config(self):
    if os.path.isfile(self.init.monitor_file):
      with open(self.init.monitor_file) as f:
        config_id = f.read()
      config = common.get_config(config_id)
    else:
      if not os.path.isfile(self.init.config_file):
        return None, None
      with open(self.init.config_file) as f:
        config = json.loads(f.read())

      data = { 'timestamp': now(), 'json': json.dumps(config) }
      r = requests.post(self.init.elasticsearch + 'spectrum/config/', params={ 'refresh': 'true' }, data=json.dumps(data))
      if r.status_code != 201:
        log.error("Can not post config: {0} {1}".format(r.status_code, config))
        return
      config_id = r.json()['_id']
      os.remove(self.init.config_file)

      with open(self.init.monitor_file, 'w') as f:
        f.write(config_id)

    return config_id, config

  def _read_config(self, config):
    convert(config['rig'])
    convert(config['monitor'])
    convert(config['scan'])

    rig = config['rig']
    period = config['monitor'].get('period', 0)
    radio_on = config['monitor'].get('radio_on', 0)
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

    return rig, period, radio_on, scan

  def _scan(self, config_id, rig, period, scan):
    with Monitor(**rig) as monitor:
      self._timeout_count = 0
      n = 0
      while not self._stop:
        log.debug("Scan: {0}".format(scan))
        t0 = now()
        sweep = { 'config_id': config_id, 'n': n, 'timestamp': t0, 'level': [] }
        n += 1

        os.utime(self.init.monitor_file, None)
        for x in monitor.scan(**scan):
          if self._stop:
            break
          sweep['level'].append(x[1] if x[1] is not None else -128)
        else:
          sweep['totaltime'] = now() - t0

          r = requests.post(self.init.elasticsearch + '/spectrum/sweep/', params={ 'refresh': 'true' }, data=json.dumps(sweep))
          if r.status_code != 201:
            log.error("Could not post to Elasticsearch ({0})".format(r.status_code))
            return

          sleep(max(period - sweep['totaltime'], 0) / 1000.0)
      if self._power_off:
        monitor.power_off()
        self._stop = False

  def run(self):
    """ Uses files .config and .monitor to communicate state. (The .pid file is managed elsewhere.)
        
        If .monitor exists, it contains the ElasticSearch config_id, look up config in ES
        If not, read config JSON from .config and insert into ES - remove .config and create .monitor
        
        Whilst running, the .monitor file is touched to indicate the last sweep time

        If stopped normally, removes .monitor (otherwise .monitor remains)
    """
    config_id, config = self._init_config()
    if config_id is None:
      return

    try:
      rig, period, radio_on, scan = self._read_config(config)

      while not self._stop:
        try:
          try:
            log.info('Scanning started')
            self._scan(config_id, rig, period, scan)
          finally:
            log.info('Scanning stopped')
        except TimeoutError as e:
          if self._timeout_count < radio_on:
            self._timeout_count += 1
            log.error(e)
            log.info("Attempting to power on")
            power_on()
            sleep(RADIO_ON_SLEEP_SECS) # give the rig chance to power up
          else:
            raise e
    except Exception as e:
      log.error(e)
      data = { 'timestamp': now(), 'config_id': config_id, 'json': json.dumps(str(e)) }
      params = { 'refresh': 'true' }
      requests.post(self.init.elasticsearch + 'spectrum/error/', params=params, data=json.dumps(data))

  def stop(self, signame, exit, tidy, power_off):
    self._stop = True
    self._exit = exit
    self._tidy = tidy
    self._power_off = power_off

  def start(self):
    while True:
      self._stop = False
      self.run()
      if self._tidy and os.path.isfile(self.init.monitor_file):
        os.remove(self.init.monitor_file)
      if self._exit:
        break
      signal.pause()


class WorkerClient:

  def __init__(self, init):
    self.init = init
    self.worker_pid = None
    self.error = None

  def read_pid(self):
    try:
      self.worker_pid = self.init.read_pid_file()
      self.error = None
    except ProcessError as e:
      self.error = e.message
    if self.worker_pid is None and self.error is None:
      self.error = "No worker process"
    return self.worker_pid

  def status(self):
    result = { }
    self.read_pid()
    if self.error is not None:
      result['error'] = self.error
    if os.path.isfile(self.init.monitor_file):
      stat = os.stat(self.init.monitor_file)
      with open(self.init.monitor_file) as f:
        result.update({ 'config_id': f.read(), 'last_sweep': stat.st_mtime })
    return result

  def start(self, config):
    if self.read_pid() is not None:
      with open(self.init.config_file, 'w') as f:
        f.write(config)
      os.kill(self.worker_pid, signal.SIGUSR1)

  def stop(self):
    if self.read_pid() is not None:
      os.kill(self.worker_pid, signal.SIGUSR1)


class ProcessError:

  def __init__(self, message):
    self.message = message


if __name__ == "__main__":
  """ PID file is a hint and not definitive of whether we will start a new process. We only abort
      if there is a .pid file and the indicated process exists (and we have permission to signal it).
  """
  import Hamlib, sys

  init = WorkerInit()
  try:
    pid = init.read_pid_file()
    if pid is not None:
      log.error("Worker process already exists: {0}".format(pid))
      sys.exit(1)
  except ProcessError:
    pass

  with open(init.pid_file, 'w') as f:
    f.write(str(os.getpid()))

  wait_for_elasticsearch()

  worker = init.worker()
  worker.set_signal('SIGTERM', exit=True, tidy=False)
  worker.set_signal('SIGINT', exit=True)
  worker.set_signal('SIGHUP', exit=True)

  try:
    with open(common.log_filename, 'a') as f:
      Hamlib.rig_set_debug_file(f)
      Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)

      log.info("Starting worker process")
      worker.start()
  finally:
    log.info("Stopping worker process")
    os.remove(init.pid_file)
