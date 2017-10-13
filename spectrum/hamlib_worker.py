""" Define Worker process, for scanning the spectrum using the rig (Hamlib).
"""
import os
import Hamlib
from time import sleep
from gpiozero import CPUTemperature
from spectrum.process import Process
from spectrum.common import log, parse_config, now, scan
from spectrum.monitor import Monitor, TimeoutError, get_capabilities
from spectrum.audio import AudioClient
from spectrum.power import power_on
from spectrum.config import PICO_PATH, RIG_DEVICE, RIG_LOG_LEVEL, RADIO_ON_SLEEP_SECS

try:
    import smbus
    i2c = smbus.SMBus(1)
except:
    i2c = None

cpu = CPUTemperature()

class Worker(Process):
    """ Process implementation for spectrum scanning using the Hamlib rig.
    """
    def __init__(self, data_store):
        super(Worker, self).__init__(data_store, 'hamlib')

    def init(self, f):
        Hamlib.rig_set_debug_file(f)
        Hamlib.rig_set_debug(getattr(Hamlib, 'RIG_DEBUG_{0}'.format(RIG_LOG_LEVEL)))
        super(Worker, self).init(f)

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
                    sleep(RADIO_ON_SLEEP_SECS) # give the rig chance to power up
                else:
                    raise e

    def get_capabilities(self):
        return get_capabilities()

    def iterator(self, config, initial_count):
        """ Scan the spectrum, storing data through the config object, and yield status.
        """
        scan_config = parse_config(config.values, 'hamlib')
        values = config.values['hamlib']
        audio_t = 0 if values['audio']['enabled'] else None
        attempts = config.values['rig']['radio_on']
        threshold = values['audio']['threshold']
        period = values['audio']['period']

        self.status.clear()
        yield

        # open the rig for monitoring
        def _monitor_open(config):
            monitor = Monitor(rig_device=RIG_DEVICE, **config.values['rig'])
            monitor.open()
            return monitor

        monitor = None
        try:
            monitor = self._timeout_try(attempts, _monitor_open, config)
            self._timeout_try(attempts, monitor.set_mode, config.values['hamlib']['mode'])
            sweep_n = 0
            while True:
                log.debug("Config: %s %s", values, scan_config)

                time_0 = now()
                strengths = []
                peaks = []
                w = [(None,) * 3] * 3

                self.status['sweep'] = {'timestamp': time_0, 'peaks': []}
                self.status['sweep']['sweep_n'] = initial_count + sweep_n
                yield

                for idx, freq in scan(scan_config):
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

                    temp = self._read_temp(config)
                    config.write_temperature(self.prefix, now(), temp)

                if w[1][1] < w[2][1] and w[2][1] >= threshold:
                    peaks.append((w[2][2], w[2][0]))

                for key in ('previous', 'current', 'record'):
                    self.status['sweep'].pop(key, None)
                yield

                config.write_spectrum(self.prefix, time_0, strengths)

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

            log.info("Recording audio at %sHz", freq)

            if not monitor.set_frequency(freq):
                raise Exception("Could not change frequency: {0}".format(freq))

            with AudioClient(config.values['audio']['receiver_channel']) as audio:
                for count, _ in enumerate(audio):
                    self.status['sweep']['record']['strength'] = monitor.get_strength()
                    self._read_temp(config)
                    yield
                    if count >= config.values['hamlib']['audio']['duration'] - 1: break
                path = config.write_audio(self.prefix, now(), idx)
                audio.write('{0}.wav'.format(path))

    # fall back to Pi CPU temperature if Pico temperature not available
    def _read_temp(self, config):
        try:
            if not os.path.exists(PICO_PATH) or i2c is None:
                raise IOError("No Pico")
            data = i2c.read_byte_data(0x69, 0x0C)
            temp = format(data, "02x")
        except IOError as e:
            log.debug("No UPS temperature ({0})".format(str(e)))
            temp = str(cpu.temperature)
        self.status['temp'] = temp
        return temp
