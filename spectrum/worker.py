""" Define Worker process, for scanning the spectrum using the rig.
"""
import os
from ses_common.config import PICO_PATH
from time import sleep
from spectrum.process import Process
from spectrum.common import log, parse_config, now, scan
from spectrum.monitor import Monitor, TimeoutError, Recorder
from spectrum.power import power_on

try:
    import smbus
    i2c = smbus.SMBus(1)
except:
    i2c = None

def read_temp():
    if not os.path.exists(PICO_PATH) or i2c is None:
        return None
    data = i2c.read_byte_data(0x69, 0x0C)
    return format(data, "02x")


class Worker(Process):
    """ Process implementation for spectrum scanning using the rig.
    """
    def __init__(self, data_store, run_path, config_file, radio_on_sleep_secs):
        super(Worker, self).__init__(data_store, run_path, config_file)
        self.radio_on_sleep_secs = radio_on_sleep_secs

    # try fn() handling timeout errors until the number of attempts is exceeded
    def _timeout_try(self, attempts, fn, *args):
        timeout_count = 0
        while True:
            try:
                return fn(*args)
            except TimeoutError as e:
                if attempts == '*' or timeout_count < attempts:
                    timeout_count += 1
                    log.error(e)
                    power_on()
                    sleep(self.radio_on_sleep_secs) # give the rig chance to power up
                else:
                    raise e

    def iterator(self, config):
        """ Scan the spectrum, storing data through the config object, and yield status.
        """
        scan_config = parse_config(config.values)
        audio_t = 0 if config.values['scan']['audio'] else None
        attempts = config.values['rig']['radio_on']
        threshold = config.values['audio']['threshold']
        period = config.values['audio']['period']

        self.status.clear()
        yield

        # open the rig for monitoring
        def _monitor_open(config):
            monitor = Monitor(**config.values['rig'])
            monitor.open()
            return monitor

        monitor = None
        try:
            monitor = self._timeout_try(attempts, _monitor_open, config)
            self._timeout_try(attempts, monitor.set_mode, config.values['scan']['mode'])
            sweep_n = 0
            while True:
                log.debug("Scan: %s %s", config.values['scan'], scan_config)

                time_0 = now()
                strengths = []
                peaks = []
                w = [(None,) * 3] * 3

                self.status['sweep'] = {'timestamp': time_0, 'peaks': []}
                self.status['sweep']['sweep_n'] = config.count + sweep_n
                yield

                for idx, freq in scan(**scan_config):
                    log.debug("Scanning frequency %s (%s)", freq, idx)

                    if 'current' in self.status['sweep']:
                        self.status['sweep']['previous'] = self.status['sweep']['current']
                    self.status['sweep']['current'] = {'freq_n': idx}
                    yield

                    strength = self._timeout_try(attempts, monitor.get_strength, freq)
                    self.status['sweep']['current']['strength'] = strength
                    yield

                    w = [w[1], w[2], (freq, strength, idx)]
                    strengths.append(strength if strength is not None else -128)
                    # ..[1] gets you the strength:
                    if w[0][1] < w[1][1] and w[1][1] >= threshold and w[1][1] >= w[2][1]:
                        peaks.append((w[1][2], w[1][0]))

                        peak = {'freq_n': w[1][2], 'strength': w[1][1]}
                        self.status['sweep']['peaks'].append(peak)
                        yield

                if w[1][1] < w[2][1] and w[2][1] >= threshold:
                    peaks.append((w[2][2], w[2][0]))

                for key in ('previous', 'current', 'record'):
                    self.status['sweep'].pop(key, None)
                yield

                config.write_spectrum(time_0, strengths)

                temp = read_temp()
                if temp is not None:
                    config.write_temperature(time_0, temp)

                if audio_t is not None and now() - audio_t > period * 1000:
                    audio_t = now()
                    for _ in self._record(config, monitor, peaks):
                        yield

                sweep_n += 1
        finally:
            if monitor is not None:
                monitor.close()

    # record audio sample for the given frequencies
    def _record(self, config, monitor, freqs):
        log.debug("Recording audio from %d frequencies", len(freqs))
        for idx, freq in freqs:
            self.status['sweep']['record'] = {'freq_n': idx}
            yield

            path = '{0}.wav'.format(config.write_audio(now(), idx))
            if not os.path.exists(os.path.dirname(path)):
                os.makedirs(os.path.dirname(path))

            audio = config.values['audio']
            log.info("Recording audio at %sHz and storing in %s", freq, path)

            with Recorder(path, config.values['rig']['audio_device']) as recorder:
                for strength in recorder.record(monitor, freq, audio['rate'], audio['duration']):
                    self.status['sweep']['record']['strength'] = strength
                    yield
