""" Define Worker process, for scanning the spectrum using the rig.
"""
import os
import os.path
import traceback
from time import sleep
from process import Process, UpdatableDict
from config import WORKER_PID, WORKER_CONFIG, WORKER_STATUS, RADIO_ON_SLEEP_SECS
from common import log, parse_config, now, scan, StoreError
from monitor import Monitor, TimeoutError, Recorder
from power import power_on


# try fn() handling timeout errors until the number of attempts is exceeded
def _timeout_try(attempts, fn, *args):
    timeout_count = 0
    while True:
        try:
            return fn(*args)
        except TimeoutError as e:
            if timeout_count < attempts:
                timeout_count += 1
                log.error(e)
                log.info("Attempting to power on")
                power_on()
                sleep(RADIO_ON_SLEEP_SECS) # give the rig chance to power up
            else:
                raise e


# open the rig for monitoring
def _monitor_open(config):
    monitor = Monitor(**config.values['rig'])
    monitor.open()
    return monitor


# iterator yielding spectrum scan status
def _iterator(config):
    scan_config = parse_config(config.values)
    audio_t = 0 if config.values['scan']['audio'] else None
    attempts = config.values['rig']['radio_on']
    threshold = config.values['audio']['threshold']
    period = config.values['audio']['period']

    status = UpdatableDict()
    yield status

    monitor = None
    try:
        monitor = _timeout_try(attempts, _monitor_open, config)
        monitor.set_mode(config.values['scan']['mode'])
        sweep_n = 0
        while True:
            log.debug("Scan: %s", config.values['scan'])

            time_0 = now()
            strengths = []
            status['sweep'] = {'sweep_n': config.count + sweep_n, 'timestamp': time_0, 'peaks': []}

            peaks = []
            w = [(None,) * 3] * 3

            for idx, freq in scan(**scan_config):
                if 'current' in status['sweep']:
                    status['sweep']['previous'] = status['sweep']['current']
                status['sweep']['current'] = {'freq_n': idx}
                yield status

                strength = _timeout_try(attempts, monitor.get_strength, freq)
                status['sweep']['current']['strength'] = strength
                yield status

                w = [w[1], w[2], (freq, strength, idx)]
                strengths.append(strength if strength is not None else -128)
                # ..[1] gets you the strength:
                if w[0][1] < w[1][1] and w[1][1] >= threshold and w[1][1] >= w[2][1]:
                    peaks.append((w[1][2], w[1][0]))

                    status['sweep']['peaks'].append({'freq_n': w[1][2], 'strength': w[1][1]})
                    yield status

            if w[1][1] < w[2][1] and w[2][1] >= threshold:
                peaks.append((w[2][2], w[2][0]))

            if 'previous' in status['sweep']:
                del status['sweep']['previous']
            if 'current' in status['sweep']:
                del status['sweep']['current']
            if 'record' in status['sweep']:
                del status['sweep']['record']
            #FIXME since this is the same as sweep timestamp, why can't we just use that in UI?
            yield status('latest', time_0)

            config.write_spectrum(time_0, strengths)

            if audio_t is not None and now() - audio_t > period * 1000:
                audio_t = now()
                for _ in _record(status, config, monitor, peaks):
                    yield status

            sweep_n += 1
    except Exception as e: # pylint: disable=broad-except
        log.error(e)
        traceback.print_exc()
        config.write_error(now(), e)
    finally:
        if monitor is not None:
            monitor.close()


# record audio sample for the given frequencies
def _record(status, config, monitor, freqs):
    log.debug("Recording audio from %d frequencies", len(freqs))
    for idx, freq in freqs:
        status['sweep']['record'] = {'freq_n': idx}
        yield

        try:
            path = '{0}.wav'.format(config.write_audio(now(), idx))
            if not os.path.exists(os.path.dirname(path)):
                os.makedirs(os.path.dirname(path))
        except StoreError:
            return

        audio = config.values['audio']
        log.info("Recording audio at %sHz and storing in %s", freq, path)

        with Recorder(path, audio['path']) as recorder:
            for strength in recorder.record(monitor, freq, audio['rate'], audio['duration']):
                status['sweep']['record']['strength'] = strength
                yield


class Worker(Process):
    """ Process class for the Worker.
    """
    def __init__(self):
        super(Worker, self).__init__(WORKER_PID, WORKER_CONFIG, WORKER_STATUS)


if __name__ == "__main__":
    #pylint: disable=invalid-name
    import Hamlib

    worker = Worker()
    worker.init()
    with open(log.path, 'a') as f:
        Hamlib.rig_set_debug_file(f)
        Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_TRACE)
        worker.start(_iterator)
