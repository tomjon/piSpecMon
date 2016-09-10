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
from elasticsearch import *


def iterator(config_id, config):
  scan_config = parse_config(config)
  audio_t = 0 if config['scan']['audio'] else None

  status = UpdatableDict()
  yield status('config_id', config_id)

  try:
    with Monitor(**config['rig']) as monitor:
      timeout_count = 0
      sweep_n = 0
      while True:
        log.debug("Scan: {0}".format(config['scan']))
        yield status

        t0 = now()
        sweep = { 'config_id': config_id, 'n': sweep_n, 'timestamp': t0, 'level': [] }
        yield status('sweep', { 'sweep_n': sweep_n, 'timestamp': t0, 'peaks': [] })

        peaks = [ ]
        w = [(None,) * 3] * 3

        #FIXME mode should probably just be set once at rig.open, and should be an argument to Monitor.__init__()
        monitor.set_mode(config['scan']['mode'])

        for idx, freq in scan(**scan_config):
          if 'current' in status['sweep']:
            status['sweep']['previous'] = status['sweep']['current']
          status['sweep']['current'] = { 'freq_n': idx }
          yield status

          while True:
            try:
              level = monitor.get_strength(freq)
              break
            except TimeoutError as e:
              if timeout_count < rig['radio_on']:
                timeout_count += 1
                log.error(e)
                log.info("Attempting to power on")
                power_on()
                sleep(RADIO_ON_SLEEP_SECS) # give the rig chance to power up
              else:
                raise e

          status['sweep']['current']['strength'] = level
          yield status

          w = [w[1], w[2], (freq, level, idx)]
          sweep['level'].append(level if level is not None else -128)
          if w[0][1] < w[1][1] and w[1][1] >= config['audio']['threshold'] and w[1][1] >= w[2][1]: # ..[1] gets you the level
            peaks.append((w[1][2], w[1][0]))

            status['sweep']['peaks'].append({ 'freq_n': w[1][2], 'strength': w[1][1] })
            yield status
        else:
          sweep['totaltime'] = now() - t0

          if w[1][1] < w[2][1] and w[2][1] >= config['audio']['threshold']:
            peaks.append((w[2][2], w[2][1]))

          if 'previous' in status['sweep']:
            del status['sweep']['previous']
          if 'current' in status['sweep']:
            del status['sweep']['current']
          if 'record' in status['sweep']:
            del status['sweep']['record']
          yield status

          #FIXME now, tidy up by removing sweep list entirely?
          write_data(sweep['config_id'], sweep['n'], sweep['timestamp'], sweep['level'], sweep['totaltime'])

          if audio_t is not None and now() - audio_t > config['audio']['period'] * 1000:
            audio_t = now()
            for st in record(status, config_id, sweep_n, monitor, config['scan'], config['audio'], peaks):
              yield st

        sweep_n += 1
  except Exception as e:
    log.error(e)
    traceback.print_exc()
    write_error(config_id, e)

#FIXME how/whether to interrupt audio recording?
def record(status, config_id, sweep_n, monitor, scan, audio, freqs):
  log.debug("Recording audio from {0} frequencies".format(len(freqs)))
  for idx, freq in freqs:
    t0 = now()
    path = '/'.join([SAMPLES_DIRECTORY, str(config_id), str(sweep_n), str(idx)]) + '.wav'
    if not os.path.exists(os.path.dirname(path)):
      os.makedirs(os.path.dirname(path))

    status['sweep']['record'] = { 'freq_n': idx }
    yield status

    monitor.record(freq, scan['mode'], audio['rate'], audio['duration'], path, audio['path'])

    try:
      write_audio(config_id, t0, sweep_n, idx)
    except StoreError:
      return


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
