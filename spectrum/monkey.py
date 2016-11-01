""" Module defining the Monkey process, for decoding RDS using the Monkey board.
"""
from time import sleep, time
from spectrum.common import log, parse_config, scan, now
from spectrum.datastore import StoreError
from spectrum.process import Process
try:
    from spectrum.rds import RdsApi
except ImportError:
    from spectrum.fake_rds import RdsApi


class Monkey(Process):
    """ Process implementation for decoding RDS using the Monkey board.
    """
    def __init__(self, data_store, run_path, poll):
        super(Monkey, self).__init__(data_store, run_path)
        self.poll = poll

    # execute v=fn() until condition(v) is True, or the timeout is exceeded
    def _poll(self, fn, condition, timeout):
        time_0 = time()
        while True:
            v = fn()
            c = condition(v)
            yield v, c
            if c or time() - time_0 > timeout:
                return
            sleep(self.poll)

    def iterator(self, config):
        """ Decode RDS, store data via the config object, and yield status.
        """
        scan_config = parse_config(config.values)
        rds = config.values['rds']

        with RdsApi(rds['device']) as api:
            while True:
                self.status.clear()
                self.status['started'] = now()

                for idx, freq in scan(**scan_config):
                    self._decode_freq(config, rds, api, idx, freq)

    # decode RDS from a single frequency
    def _decode_freq(self, config, rds, api, idx, freq):
        log.debug("Scanning %s", freq)

        for key in ('strength', 'name', 'text'):
            self.status.pop(key, None)
        self.status['freq_n'] = idx
        yield

        api.set_frequency(freq)
        condition = lambda s: s >= rds['strength_threshold']
        for strength, ok in self._poll(api.get_strength, condition, rds['strength_timeout']):
            self.status['strength'] = strength
            yield
        if not ok: # pylint: disable=undefined-loop-variable
            return

        time_0 = time()
        for name, ok in self._poll(api.get_name, lambda n: n is not None, rds['rds_timeout']):
            self.status['strength'] = api.get_strength()
            self.status['name'] = name
            yield
        if not ok: # pylint: disable=undefined-loop-variable
            return

        log.debug("Found RDS name %s", name) # pylint: disable=undefined-loop-variable
        try:
            config.write_rds_name(now(), idx, name) # pylint: disable=undefined-loop-variable
        except StoreError:
            return

        text_0 = None
        while time() < time_0 + rds['rds_timeout']:
            text = api.get_text()
            self.status['strength'] = api.get_strength()
            self.status['text'] = text
            yield

            if text is not None and text != text_0:
                text_0 = text
                log.debug("Found RDS text %s", text)
                try:
                    config.write_rds_text(now(), idx, text)
                except StoreError:
                    return

            sleep(self.poll)
