from config import *
from common import *

import requests
import json
from monitor import Monitor, TimeoutError, get_capabilities
from power import power_on
from time import sleep
import os, os.path
import traceback
from process import Process, UpdatableDict
import fs_datastore as data_store


def timeout_try(attempts, fn, *args):
  timeout_count = 0
  while True:
    try:
      return fn(*args)
    except TimeoutError as e:
      if timeout_count < attempts:
        timeout_count += 1
        log.error(e)
        log.info("Attempting to power on")
        power_on()
        sleep(RADIO_ON_SLEEP_SECS) # give the rig chance to power up
      else:
        raise e


def iterator(config):
  scan_config = parse_config(config.values)
  audio_t = 0 if config.values['scan']['audio'] else None
  attempts = config.values['rig']['radio_on']

  status = UpdatableDict()
  yield status

  monitor = None
  try:
    monitor = Monitor(**config.values['rig'])
    timeout_try(attempts, monitor.open, config.values['scan']['mode'])

    sweep_n = 0
    while True:
      log.debug("Scan: {0}".format(config.values['scan']))
      yield status

      t0 = now()
      strengths = []
      yield status('sweep', { 'sweep_n': sweep_n, 'timestamp': t0, 'peaks': [] })

      peaks = []
      w = [(None,) * 3] * 3

      for idx, freq in scan(**scan_config):
        if 'current' in status['sweep']:
          status['sweep']['previous'] = status['sweep']['current']
        status['sweep']['current'] = { 'freq_n': idx }
        yield status

        strength = timeout_try(attempts, monitor.get_strength, freq)
        status['sweep']['current']['strength'] = strength
        yield status

        w = [w[1], w[2], (freq, strength, idx)]
        strengths.append(strength if strength is not None else -128)
        if w[0][1] < w[1][1] and w[1][1] >= config.values['audio']['threshold'] and w[1][1] >= w[2][1]: # ..[1] gets you the strength
          peaks.append((w[1][2], w[1][0]))

          status['sweep']['peaks'].append({ 'freq_n': w[1][2], 'strength': w[1][1] })
          yield status
      else:
        if w[1][1] < w[2][1] and w[2][1] >= config.values['audio']['threshold']:
          peaks.append((w[2][2], w[2][1]))

        if 'previous' in status['sweep']:
          del status['sweep']['previous']
        if 'current' in status['sweep']:
          del status['sweep']['current']
        if 'record' in status['sweep']:
          del status['sweep']['record']
        yield status('latest', t0)

        config.write_spectrum(t0, strengths)

        if audio_t is not None and now() - audio_t > config.values['audio']['period'] * 1000:
          audio_t = now()
          for st in record(status, config, monitor, peaks):
            yield st

      sweep_n += 1
  except Exception as e:
    log.error(e)
    traceback.print_exc()
    config.write_error(now(), e)
  finally:
    if monitor is not None:
      monitor.close()

#FIXME how/whether to interrupt audio recording?
def record(status, config, monitor, freqs):
  log.debug("Recording audio from {0} frequencies".format(len(freqs)))
  for idx, freq in freqs:
    t0 = now()

    status['sweep']['record'] = {'freq_n': idx}
    yield status

    try:
      path = '{0}.wav'.format(config.write_audio(t0, idx))
      if not os.path.exists(os.path.dirname(path)):
        os.makedirs(os.path.dirname(path))
    except StoreError:
      return

    audio = config.values['audio']
    monitor.record(freq, config.values['scan']['mode'], audio['rate'], audio['duration'], path, audio['path'])


class Worker (Process):
  def __init__(self):
    super(Worker, self).__init__(WORKER_PID, WORKER_CONFIG, WORKER_STATUS)


if __name__ == "__main__":
  import Hamlib

  worker = Worker()
  worker.init()
  with open(log_filename, 'a') as f:
    Hamlib.rig_set_debug_file(f)
    Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)
    worker.start(iterator)
