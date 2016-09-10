from config import *
from common import *

import requests
import json
from time import sleep, time
import os, os.path
import signal
import common
import errno
import traceback
import sys

from elasticsearch import *

""" Process management module. Use this to provide a process which responds to signals and reads config
    and writes status using the file system, and writes data to the provided data source.
"""

class UpdatableDict (dict):
  def __call__(self, key, value):
    self[key] = value
    return self


class Process (object):

  def __init__(self, pid_file, config_file, status_file):
    self.pid_file = local_path(pid_file)
    self.config_file = local_path(config_file)
    self.status_file = local_path(status_file)
    self._exit = False
    self._stop = False
    self._tidy = True
    self.config_id = None

  def read_pid(self):
    if not os.path.isfile(self.pid_file):
      return None
    try:
      with open(self.pid_file) as f:
        pid = f.read().strip()
      pid = int(pid)
      os.kill(pid, 0)
      return pid
    except IOError:
      raise ProcessError("Can not open PID file: {0}".format(self.pid_file))
    except ValueError:
      raise ProcessError("Bad PID: {0}".format(pid))
    except OSError as e:
      raise ProcessError("Bad PID ({0}): {1}".format(errno.errorcode[e.errno], pid))

  def read_status(self):
    if not os.path.isfile(self.status_file):
      return { }
    stat = os.stat(self.status_file)
    with open(status_file, 'r') as f:
      status = json.loads(f.read())
      status['timestamp'] = stat.st_mtime
      status['config_id'] = self.config_id
      return status

  def write_status(self, status):
    log.debug("Writing status {0}".format(json.dumps(status)))
    tmp = self.status_file + '_tmp'
    with open(tmp, 'w') as f:
      f.write(json.dumps(status))
    os.rename(tmp, self.status_file)

  def _set_signal(self, signame, stop=True, exit=False, tidy=True):
    """ Define signal handler for given signal in order to exit cleanly.
    """
    def _callback(*args):
      self._stop = stop
      self._exit = exit
      self._tidy = tidy
    signal.signal(getattr(signal, signame), _callback)

  def _read_config(self):
    if not os.path.isfile(self.config_file):
      return None
    with open(self.config_file) as f:
      return f.read().strip()

  def start(self, iterator):
    log.info("STARTING")
    try:
      while True:
        self.config_id = self._read_config()
        if self.config_id is not None:
          log.debug("Read config id {0}".format(self.config_id))
          config = read_config(self.config_id)
          if config is not None:
            config = config['config'] #FIXME yuck
            log.debug("Running with config: {0}".format(json.dumps(config)))
            self._stop = False
            for status in iterator(self.config_id, config):
              self.write_status(status)
              if self._stop:
                break
            if os.path.isfile(self.status_file):
              os.remove(self.status_file)
          else:
            log.warn("Config not found for id {0}".format(self.config_id))
        if self._tidy and os.path.isfile(self.config_file):
          os.remove(self.config_file)
        if self._exit:
          break
        signal.pause()
    finally:
      log.info("STOPPING")
      os.remove(self.pid_file)
      if os.path.isfile(self.status_file):
        os.remove(self.status_file)

  def stop(self):
    self._stop = True

  def init(self):
    try:
      pid = self.read_pid()
      if pid is not None:
        log.error("Process already exists: {0}".format(pid))
        sys.exit(1)
    except ProcessError:
      pass
    with open(self.pid_file, 'w') as f:
      f.write(str(os.getpid()))

    self._set_signal('SIGTERM', exit=True, tidy=False)
    self._set_signal('SIGINT', exit=True)
    self._set_signal('SIGHUP', exit=True)
    self._set_signal('SIGUSR1')

  def client(self):
    return Client(self)


class Client:

  def __init__(self, process):
    self.process = process
    self.pid = None
    self.error = None

  def read_pid(self):
    try:
      self.pid = self.process.read_pid()
      self.error = None
    except ProcessError as e:
      self.error = e.message
    if self.pid is None and self.error is None:
      self.error = "No worker process"
    return self.pid

  def status(self):
    self.read_pid()

    if not os.path.isfile(self.process.status_file):
      return { }
    stat = os.stat(self.process.status_file)
    with open(self.process.status_file, 'r') as f:
      status = json.loads(f.read())
      status['timestamp'] = stat.st_mtime

    if self.error is not None:
      status['error'] = self.error
    return status

  def start(self, config_id):
    if self.read_pid() is not None:
      with open(self.process.config_file, 'w') as f:
        f.write(config_id)
      os.kill(self.pid, signal.SIGUSR1)

  def stop(self):
    if self.read_pid() is not None:
      os.kill(self.pid, signal.SIGUSR1)


class ProcessError:

  def __init__(self, message):
    self.message = message
