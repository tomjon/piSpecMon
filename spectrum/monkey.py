""" Module defining the Monkey process, for decoding RDS using the Monkey board.

    Two choice for modes of operation - scanning/static, and audio on/off.

    If scanning, the configured frequencies are scanned for signal strengths that achieves a
    threshold. For each frequency that the strength threshold is achieved, we
    dwell on that frequency and attempt to decode RDS name; if that is achieved
    before a timeout, we dwell on the frequency for a further amount of time
    decoding RDS text.

    If scanning and additionally recording audio, samples for each frequency
    achieving the strength threshold are recorded, for a minimum of the
    requested dwell time. (If the 'decode text' dwell time is longer, the
    sample will be longer.)

    If not scanning but static, the configured frequencies are dwelt on for the
    configured amount of time, collecting rds names and text.

    If static and additionally recording audio, at the same time as collecting
    RDS, samples are recorded.
"""
from time import sleep, time
from spectrum.common import log, parse_config, scan, now
from spectrum.datastore import StoreError
from spectrum.process import Process
from spectrum.config import RDS_DEVICE
from spectrum.audio import AudioClient
import os
try:
    from spectrum.rds import RdsApi
except ImportError:
    from spectrum.fake_rds import RdsApi

class Monkey(Process):
    """ Process implementation for decoding RDS using the Monkey board.
    """
    def __init__(self, data_store, run_path, config_file, poll):
        super(Monkey, self).__init__(data_store, run_path, config_file)
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
        scan_config = parse_config(config.values, 'rds')
        self.config = config
        self.rds = config.values['rds']
        self.scan_enabled = self.rds['scan']['enabled']
        self.audio_enabled = self.rds['audio']['enabled']

        with RdsApi(RDS_DEVICE) as self.api:
            while True:
                self.status.clear()
                self.status['started'] = now()
                yield

                for idx, freq in scan(scan_config):
                    for _ in self._decode_freq(idx, freq):
                        yield

    # decode RDS from a single frequency
    def _decode_freq(self, idx, freq):
        for key in ('strength', 'name', 'text'):
            self.status.pop(key, None)
        self.status['freq_n'] = idx
        yield

        log.debug("Set frequency %s (freq_n %d)", freq, idx)
        self.api.set_frequency(freq)

        self.name = None
        self.text = None

        if not self.audio_enabled:
            if self.scan_enabled:
                for _ in self._scan(idx):
                    yield
            else:
                for _ in xrange(self.rds['duration']):
                    self._sample_rds(idx)
                    yield
                    sleep(1.0)
        else:
            # record audio, possibly scanning at the same time
            path, dirname = self._sample_path(idx)
            channel = str(self.config.values['audio']['rds_channel'])
            log.debug("Sample path %s, channel %s", path, channel)
            with AudioClient(channel, path) as audio:
                if self.scan_enabled:
                    try:
                        for ok in self._scan(idx):
                            yield
                    finally:
                        if not ok:
                            os.remove(path)
                            if dirname is not None:
                                os.rmdir(dirname)
                            return
                for _ in self._record(audio, idx):
                    yield

    # scan for RDS name and text on the current frequency, yielding True unless
    # the scan 'fails' (i.e. nothing detected) when finally False is yielded
    def _scan(self, idx):
        log.debug("Scanning")

        condition = lambda s: s >= self.rds['scan']['strength_threshold']
        for strength, ok in self._poll(self.api.get_strength, condition, self.rds['scan']['strength_timeout']):
            self.status['strength'] = strength
            yield False
        if not ok: # pylint: disable=undefined-loop-variable
            yield False
            return

        time_0 = time()
        for name, ok in self._poll(self.api.get_name, lambda n: n is not None, self.rds['scan']['name_timeout']):
            self.status['strength'] = self.api.get_strength()
            self.status['name'] = name
            yield False
        if not ok: # pylint: disable=undefined-loop-variable
            yield True
            return

        log.debug("Found RDS name %s", name) # pylint: disable=undefined-loop-variable
        try:
            config.write_rds_name(now(), idx, name) # pylint: disable=undefined-loop-variable
        except StoreError as e:
            log.exception(e)
            return

        while time() < time_0 + self.rds['scan']['text_timeout']:
            text = self.api.get_text()
            if text is not None:
                text = text.encode('ascii', 'ignore') #FIXME should be able to store Unicode
            self.status['strength'] = self.api.get_strength()
            self.status['text'] = text
            yield False

            if text is not None and text != self.text:
                self.text = text
                log.debug("Found RDS text %s", text)
                try:
                    config.write_rds_text(now(), idx, text)
                except StoreError as e:
                    log.exception(e)
                    return

            sleep(self.poll)

        yield True

    def _sample_path(self, idx):
        path = '{0}.wav'.format(self.config.write_audio(now(), idx)) #FIXME chunk the same as worker.py
        dirname = os.path.dirname(path)
        if not os.path.exists(dirname):
            os.makedirs(dirname)
        else:
            dirname = None
        return path, dirname

    def _record(self, audio, idx):
        # record a sample, this will block until audio.duration seconds have elapsed
        log.debug("Recording")
        for count, _ in enumerate(audio):
            self._sample_rds(idx)
            yield
            if count >= self.rds['duration'] - 1: break

    def _sample_rds(self, idx):
        self.status['strength'] = self.api.get_strength() # currently, not stored
        self.status['name'] = self.api.get_name()
        if self.name != self.status['name']:
            self.name = self.status['name']
            self.config.write_rds_name(now(), idx, self.name)
        self.status['text'] = self.api.get_text()
        if self.text != self.status['text']:
            self.text = self.status['text']
            self.config.write_rds_text(now(), idx, self.text)
