from config import *
from common import *
from process import Process
from rds import RdsApi
from time import sleep, time


class UpdatableDict (dict):
  def __call__(self, key, value):
    self[key] = value
    return self


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
  with RdsApi() as api:
    progress = UpdatableDict()
    while True:
      for idx, freq in scan(**config['rds']):
        yield progress('frequency', freq)
        api.set_frequency(freq)
        strength = poll(api.get_strength, lambda s: s >= threshold, config['rds']['strength_timeout'])
        if strength is None:
          continue
        yield progress('strength', strength)
        t0 = time()
        name = poll(api.get_name, lambda n: n is not None, config['rds']['rds_timeout'])
        if name is None:
          continue
        yield progress('name', name)
        text0 = None
        while time() < t0 + config['rds']['rds_timeout']:
          text = api.get_text()
          if text is not None and text != text0:
            yield progress('text', text)


if __name__ == "__main__":
  monkey = Process(callable, MONKEY_PID, MONKEY_CONFIG, MONKEY_STATUS, ELASTICSEARCH)
  monkey.init()
  wait_for_elasticsearch()
  monkey.start(iterator)
