""" Module defining the Monkey process, for decoding RDS using the Monkey board.
"""
from time import sleep, time
from config import MONKEY_PID, MONKEY_CONFIG, MONKEY_STATUS, MONKEY_POLL
from common import log, parse_config, scan, now, StoreError
from process import Process
try:
    from rds import RdsApi
except ImportError:
    from fake_rds import RdsApi


# execute v=fn() until condition(v) is True, or the timeout is exceeded
def _poll(fn, condition, timeout):
    time_0 = time()
    while True:
        v = fn()
        c = condition(v)
        yield v, c
        if c or time() - time_0 > timeout:
            return
        sleep(MONKEY_POLL)


# iterator for monkey.start() yields status of RDS decoding
def _iterator(config, status):
    scan_config = parse_config(config.values)
    rds = config.values['rds']

    with RdsApi(rds['device']) as api:
        while True:
            for idx, freq in scan(**scan_config):
                log.debug("Scanning %s", freq)

                status.clear()
                status['freq_n'] = idx
                yield

                api.set_frequency(freq)
                condition = lambda s: s >= rds['strength_threshold']
                for strength, ok in _poll(api.get_strength, condition, rds['strength_timeout']):
                    status['strength'] = strength
                    yield
                if not ok: # pylint: disable=undefined-loop-variable
                    continue

                time_0 = time()
                for name, ok in _poll(api.get_name, lambda n: n is not None, rds['rds_timeout']):
                    status['strength'] = api.get_strength()
                    status['name'] = name
                    yield
                if not ok: # pylint: disable=undefined-loop-variable
                    continue

                log.debug("Found RDS name %s", name) # pylint: disable=undefined-loop-variable
                try:
                    config.write_rds_name(now(), idx, name) # pylint: disable=undefined-loop-variable
                except StoreError:
                    return

                text_0 = None
                while time() < time_0 + rds['rds_timeout']:
                    text = api.get_text()
                    status['strength'] = api.get_strength()
                    status['text'] = text
                    yield

                    if text is not None and text != text_0:
                        text_0 = text
                        log.debug("Found RDS text %s", text)
                        try:
                            config.write_rds_text(now(), idx, text)
                        except StoreError:
                            return

                    sleep(MONKEY_POLL)


if __name__ == "__main__":
    #pylint: disable=invalid-name
    monkey = Process(MONKEY_PID, MONKEY_CONFIG, MONKEY_STATUS)
    monkey.init()
    monkey.start(_iterator)
