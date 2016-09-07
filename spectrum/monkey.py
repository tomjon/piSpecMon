from config import *
from common import *
from process import Process, UpdatableDict
from rds import RdsApi
from time import sleep, time
import requests


def poll(fn, condition, timeout):
  t0 = time()
  while True:
    v = fn()
    if condition(v):
      return v
    if time() - t0 > timeout:
      return None
    sleep(MONKEY_POLL)


def iterator(config_id, config):
  scan_config = parse_config(config)

  with RdsApi(config['rds']['device']) as api:
    while True:
      for idx, freq in scan(**scan_config):
        progress = UpdatableDict()
        yield progress('freq_n', idx)
        api.set_frequency(freq)
        strength = poll(api.get_strength, lambda s: s >= config['rds']['strength_threshold'], config['rds']['strength_timeout'])
        if strength is None:
          continue
        yield progress('strength', strength)
        t0 = time()
        name = poll(api.get_name, lambda n: n is not None, config['rds']['rds_timeout'])
        if name is None:
          continue
        yield progress('name', name)

        data = { 'config_id': config_id, 'idx': idx, 'timestamp': now(), 'name': name }
        r = requests.post(ELASTICSEARCH + '/spectrum/name/', params={ 'refresh': 'true' }, data=json.dumps(data))
        if r.status_code != 201:
          log.error("Could not post to Elasticsearch ({0})".format(r.status_code))
          return

        text0 = None
        while time() < t0 + config['rds']['rds_timeout']:
          text = api.get_text()
          if text is not None and text != text0:
            yield progress('text', text)

            data = { 'config_id': config_id, 'idx': idx, 'timestamp': now(), 'text': text }
            r = requests.post(ELASTICSEARCH + '/spectrum/text/', params={ 'refresh': 'true' }, data=json.dumps(data))
            if r.status_code != 201:
              log.error("Could not post to Elasticsearch ({0})".format(r.status_code))
              return


class Monkey (Process):
  def __init__(self):
    super(Monkey, self).__init__(MONKEY_PID, MONKEY_CONFIG, MONKEY_STATUS)


if __name__ == "__main__":
  monkey = Monkey()
  monkey.init()
  wait_for_elasticsearch()
  monkey.start(iterator)
