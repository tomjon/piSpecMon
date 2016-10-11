from config import *
from common import *
from process import Process, UpdatableDict
from time import sleep, time
import requests
import fs_datastore as data_store
try:
  from rds import RdsApi
except ImportError:
  from fake_rds import RdsApi


def poll(fn, condition, timeout):
  t0 = time()
  while True:
    v = fn()
    c = condition(v)
    yield v, c
    if c or time() - t0 > timeout:
      return
    sleep(MONKEY_POLL)


def iterator(config):
  scan_config = parse_config(config.values)
  rds = config.values['rds']

  with RdsApi(rds['device']) as api:
    while True:
      for idx, freq in scan(**scan_config):
        status = UpdatableDict()
        yield status('freq_n', idx)

        api.set_frequency(freq)
        for strength, ok in poll(api.get_strength, lambda s: s >= rds['strength_threshold'], rds['strength_timeout']):
          yield status('strength', strength)

        if not ok:
          continue

        t0 = time()
        for name, ok in poll(api.get_name, lambda n: n is not None, rds['rds_timeout']):
          status['strength'] = api.get_strength()
          yield status('name', name)

        if not ok:
          continue

        try:
          config.write_rds_name(now(), idx, name)
        except StoreError:
          return

        text0 = None
        while time() < t0 + rds['rds_timeout']:
          text = api.get_text()
          status['strength'] = api.get_strength()
          yield status('text', text)

          if text is not None and text != text0:
            text0 = text
            try:
              config.write_rds_text(now(), idx, text)
            except StoreError:
              return

          sleep(MONKEY_POLL)


class Monkey (Process):
  def __init__(self):
    super(Monkey, self).__init__(MONKEY_PID, MONKEY_CONFIG, MONKEY_STATUS)


if __name__ == "__main__":
  monkey = Monkey()
  monkey.init()
  monkey.start(iterator)
