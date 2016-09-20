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
    if condition(v):
      return v
    if time() - t0 > timeout:
      return None
    sleep(MONKEY_POLL)


def iterator(config):
  scan_config = parse_config(config.values)

  with RdsApi(config.values['rds']['device']) as api:
    while True:
      for idx, freq in scan(**scan_config):
        progress = UpdatableDict()
        yield progress('freq_n', idx)
        api.set_frequency(freq)
        strength = poll(api.get_strength, lambda s: s >= config.values['rds']['strength_threshold'], config.values['rds']['strength_timeout'])
        if strength is None:
          continue
        yield progress('strength', strength)
        t0 = time()
        name = poll(api.get_name, lambda n: n is not None, config.values['rds']['rds_timeout'])
        if name is None:
          continue
        yield progress('name', name)

        try:
          config.write_rds_name(now(), idx, name)
        except StoreError:
          return

        text0 = None
        while time() < t0 + config.values['rds']['rds_timeout']:
          text = api.get_text()
          if text is not None and text != text0:
            text0 = text
            yield progress('text', text)

            try:
              config.write_rds_text(now(), idx, text)
            except StoreError:
              return


class Monkey (Process):
  def __init__(self):
    super(Monkey, self).__init__(MONKEY_PID, MONKEY_CONFIG, MONKEY_STATUS)


if __name__ == "__main__":
  monkey = Monkey()
  monkey.init()
  monkey.start(iterator)
