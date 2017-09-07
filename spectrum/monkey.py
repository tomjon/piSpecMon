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
#try:
#    from spectrum.rds import RdsApi
#except ImportError:
#    from spectrum.fake_rds import RdsApi
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
        self.status.clear()

        with RdsApi(RDS_DEVICE) as self.api:
            sweep_n = 0
            while True:
                time_0 = now()
                self.status['sweep'] = {'timestamp': time_0}
                self.status['sweep']['sweep_n'] = config.count + sweep_n
                yield

                strengths = []
                for idx, freq in scan(scan_config):
                    s = []
                    for strength in self._decode_freq(idx, freq):
                        s.append(strength)
                        yield
                    strengths.append(max(s))

                config.write_spectrum(time_0, strengths) #FIXME TOTAL HACK
                sweep_n += 1

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
                for strength, ok in self._scan(idx):
                    yield strength
            else:
                for _ in xrange(self.rds['duration']):
                    yield self._sample_rds(idx)
                    sleep(1.0)
        else:
            # record audio, possibly scanning at the same time
            channel = str(self.config.values['audio']['rds_channel'])
            log.debug("Audio channel %s", channel)
            with AudioClient(channel) as audio:
                if self.scan_enabled:
                    for strength, ok in self._scan(idx):
                        yield strength
                    if not ok:
                        return
                for strength in self._record(audio, idx):
                    yield strength
                path = self._sample_path(idx)
                log.debug("Sample path %s", path)
                audio.write(path)

    # scan for RDS name and text on the current frequency, yielding True unless
    # the scan 'fails' (i.e. nothing detected) when finally False is yielded
    def _scan(self, idx):
        log.debug("Scanning")

        condition = lambda s: s >= self.rds['scan']['strength_threshold']
        for strength, ok in self._poll(self.api.get_strength, condition, self.rds['scan']['strength_timeout']):
            self.status['strength'] = strength
            yield strength, False
        if not ok: # pylint: disable=undefined-loop-variable
            yield None, False
            return

        time_0 = time()
        for name, ok in self._poll(self.api.get_name, lambda n: n is not None, self.rds['scan']['name_timeout']):
            self.status['strength'] = self.api.get_strength()
            self.status['name'] = name
            yield self.status['strength'], False
        if not ok: # pylint: disable=undefined-loop-variable
            yield None, True
            return

        log.debug("Found RDS name %s", name) # pylint: disable=undefined-loop-variable
        try:
            self.config.write_rds_name(now(), idx, name) # pylint: disable=undefined-loop-variable
        except StoreError as e:
            log.exception(e)
            return

        while time() < time_0 + self.rds['scan']['text_timeout']:
            text = self.api.get_text()
            if text is not None:
                text = text.encode('ascii', 'ignore') #FIXME should be able to store Unicode
            self.status['strength'] = self.api.get_strength()
            self.status['text'] = text
            yield self.status['strength'], False

            if text is not None and text != self.text:
                self.text = text
                log.debug("Found RDS text %s", text)
                try:
                    self.config.write_rds_text(now(), idx, text)
                except StoreError as e:
                    log.exception(e)
                    return

            sleep(self.poll)

        yield None, True

    def _sample_path(self, idx):
        path = '{0}.wav'.format(self.config.write_audio(now(), idx)) #FIXME chunk the same as worker.py
        dirname = os.path.dirname(path)
        if not os.path.exists(dirname):
            os.makedirs(dirname)
        return path

    def _record(self, audio, idx):
        # record a sample, this will block until audio.duration seconds have elapsed
        log.debug("Recording")
        for count, _ in enumerate(audio):
            yield self._sample_rds(idx)
            if count >= self.rds['duration'] - 1: break

    def _sample_rds(self, idx):
        self.status['strength'] = self.api.get_strength() # currently, not stored
        self.status['name'] = self.api.get_name()
        if self.status['name'] and self.name != self.status['name']:
            self.name = self.status['name']
            self.config.write_rds_name(now(), idx, self.name)
        self.status['text'] = self.api.get_text()
        if self.status['text'] and self.text != self.status['text']:
            self.text = self.status['text']
            self.config.write_rds_text(now(), idx, self.text)
        return self.status['strength']
