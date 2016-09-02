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

    When signalled to start, it checks for a .monitor file; if there is one, it contains the last written
    progress of the worker (which itself contains the config_id and config).

    Otherwise, it checks for a .config file, and if there is one, config JSON is read from it, and uploaded
    to ES and a config_id obtained. The .config file is removed.
    
    Note, .monitor file is used in preference to .config - if both exist, .config is ignored and not consumed.
    
    The .monitor file is kept up-to-date with current progress.
    
    The worker runs until stopped by another signal, and the .monitor file is removed.
"""

def convert(d):
  """ Auto-convert empty strings into None, number strings into numbers, and boolean strings into booleans.
  """
  for k, v in d.iteritems():
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
    self.progress = Progress(init.monitor_file)

  def set_signal(self, signame, exit=False, tidy=True, power_off=False):
    """ Define signal handler for given signal in order to exit cleanly.
    """
    signal.signal(getattr(signal, signame), lambda *_: self.stop(signame, exit, tidy, power_off))

  def _init_config(self):
    config_id, config = self.progress.get_config()
    if config_id is None:
      # no monitor progress - check for config file
      if not os.path.isfile(self.init.config_file):
        return None, None

      with open(self.init.config_file) as f:
        config = json.loads(f.read())
      os.remove(self.init.config_file)

    # post config to data store
    data = { 'timestamp': now(), 'json': json.dumps(config) }
    r = requests.post(self.init.elasticsearch + 'spectrum/config/', params={ 'refresh': 'true' }, data=json.dumps(data))
    if r.status_code != 201:
      log.error("Can not post config: {0} {1}".format(r.status_code, config))
      return
    config_id = r.json()['_id']

    return config_id, config

  def _parse_config(self, config):
    convert(config['rig'])
    convert(config['audio'])
    convert(config['monitor'])
    convert(config['scan'])

    rig = config['rig']
    audio = config['audio']
    period = config['monitor'].get('period', 0)
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

    return rig, audio, period, scan

  def _scan(self, config_id, rig, audio, period, scan):
    audio_t = 0 if scan['audio'] else None

    with Monitor(**rig) as monitor:
      self._timeout_count = 0
      n = 0
      while not self._stop:
        log.debug("Scan: {0}".format(scan))
        t0 = now()
        sweep = { 'config_id': config_id, 'n': n, 'timestamp': t0, 'level': [] }
        self.progress.sweep_start(n, t0)

        peaks = [ ]
        w = [(None,) * 3] * 3
        for idx, freq in monitor.scan(**scan):
          if self._stop:
            break
          self.progress.strength_start(idx)
          level = monitor.get_strength(freq)
          self.progress.strength_stop(level)
          w = [w[1], w[2], (freq, level, idx)]
          sweep['level'].append(level if level is not None else -128)
          if w[0][1] < w[1][1] and w[1][1] >= audio['threshold'] and w[1][1] >= w[2][1]: # ..[1] gets you the level
            peaks.append((w[1][2], w[1][0]))
            self.progress.peak(w[1][2], w[1][1])
        else:
          sweep['totaltime'] = now() - t0

          if w[1][1] < w[2][1] and w[2][1] >= audio['threshold']:
            peaks.append((w[2][2], w[2][0]))

          self.progress.sweep_stop()

          r = requests.post(self.init.elasticsearch + '/spectrum/sweep/', params={ 'refresh': 'true' }, data=json.dumps(sweep))
          if r.status_code != 201:
            log.error("Could not post to Elasticsearch ({0})".format(r.status_code))
            return

          if audio_t is not None and now() - audio_t > audio['period'] * 1000:
            audio_t = now()
            self._record(config_id, n, monitor, scan, audio, peaks)

          sleep(max(period - sweep['totaltime'], 0) / 1000.0)

        n += 1

      if self._power_off:
        monitor.power_off()
        self._stop = False

  def _record(self, config_id, sweep_n, monitor, scan, audio, freqs):
    log.debug("Recording audio from {0} frequencies".format(len(freqs)))
    for idx, freq in freqs:
      if self._stop:
        return #FIXME how/whether to interrupt audio recording?
      t0 = now()
      path = '/'.join([SAMPLES_DIRECTORY, str(config_id), str(sweep_n), str(idx)]) + '.wav'
      if not os.path.exists(os.path.dirname(path)):
        os.makedirs(os.path.dirname(path))
      self.progress.record(idx)
      monitor.record(freq, scan['mode'], audio['rate'], audio['duration'], path, audio['path'])
      data = { 'config_id': config_id, 'timestamp': t0, 'sweep_n': sweep_n, 'freq_n': idx }
      r = requests.post(self.init.elasticsearch + '/spectrum/audio/', params={ 'refresh': 'true' }, data=json.dumps(data))
      if r.status_code != 201:
        log.error("Could not post to Elasticsearch ({0})".format(r.status_code))
        return

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
      rig, audio, period, scan = self._parse_config(config)
      self.progress.start(config_id, config)

      while not self._stop:
        try:
          try:
            log.info('Scanning started')
            self._scan(config_id, rig, audio, period, scan)
          finally:
            log.info('Scanning stopped')
        except TimeoutError as e:
          if self._timeout_count < rig['radio_on']:
            self._timeout_count += 1
            log.error(e)
            log.info("Attempting to power on")
            power_on()
            sleep(RADIO_ON_SLEEP_SECS) # give the rig chance to power up
          else:
            raise e
    except Exception as e:
      log.error(e)
      traceback.print_exc()
      data = { 'timestamp': now(), 'config_id': config_id, 'json': json.dumps(str(e)) }
      params = { 'refresh': 'true' }
      requests.post(self.init.elasticsearch + 'spectrum/error/', params=params, data=json.dumps(data))
    finally:
      self.progress.stop()

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
    self.read_pid()

    result = Progress.read(self.init.monitor_file)
    if self.error is not None:
      result['error'] = self.error
    return result

  def start(self, config):
    if self.read_pid() is not None:
      with open(self.init.config_file, 'w') as f:
        f.write(config)
      os.kill(self.worker_pid, signal.SIGUSR1)

  def stop(self):
    if self.read_pid() is not None:
      os.kill(self.worker_pid, signal.SIGUSR1)


class Progress:

  def __init__(self, monitor_file):
    self.monitor_file = monitor_file

  @staticmethod
  def read(monitor_file):
    if not os.path.isfile(monitor_file):
      return { }
    stat = os.stat(monitor_file)
    with open(monitor_file, 'r') as f:
      progress = json.loads(f.read())
      progress['timestamp'] = stat.st_mtime
      return progress

  def get_config(self):
    if not os.path.isfile(self.monitor_file):
      return None, None
    with open(self.monitor_file, 'r') as f:
      progress = json.loads(f.read())
      return progress['config_id'], progress['config']

  def start(self, config_id, config):
    self.progress = { 'config_id': config_id, 'config': config }
    self._write()

  def sweep_start(self, sweep_n, t0):
    self.progress['sweep'] = { 'sweep_n': sweep_n, 'timestamp': t0, 'peaks': [] }
    self._write()

  def sweep_stop(self):
    if 'previous' in self.progress['sweep']:
      del self.progress['sweep']['previous']
    if 'current' in self.progress['sweep']:
      del self.progress['sweep']['current']
    if 'record' in self.progress['sweep']:
      del self.progress['sweep']['record']
    self._write()

  def strength_start(self, idx):
    if 'current' in self.progress['sweep']:
      self.progress['sweep']['previous'] = self.progress['sweep']['current']
    self.progress['sweep']['current'] = { 'freq_n': idx }
    self._write()

  def strength_stop(self, level):
    self.progress['sweep']['current']['strength'] = level
    self._write()

  def peak(self, idx, level):
    self.progress['sweep']['peaks'].append({ 'freq_n': idx, 'strength': level })
    self._write()

  def record(self, idx):
    self.progress['sweep']['record'] = { 'freq_n': idx }
    self._write()

  def stop(self):
    os.remove(self.monitor_file)

  def _write(self):
    tmp = self.monitor_file + '_tmp'
    with open(tmp, 'w') as f:
      f.write(json.dumps(self.progress))
    os.rename(tmp, self.monitor_file)


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
