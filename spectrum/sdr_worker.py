""" Define Worker process, for scanning the spectrum using the SDR Play device.
"""
import threading
import sys
from spectrum.process import Process
from spectrum.common import log, parse_config, now
from sdrplay import SdrPlay, Callback_Continue, Callback_Reinit, Callback_Exit

class Worker(Process):
    """ Process implementation for spectrum scanning using the SDR Play device.
    """
    def __init__(self, data_store):
        super(Worker, self).__init__(data_store, 'sdr')
        self.cv = threading.Condition()

    def get_capabilities(self):
        return {'models': [{'model': 'SDR Play'}], 'scan': {  #FIXME can we remove 'models' as it isn't used (only for Rig)
                'antenna': [{'value': 0, 'label': 'Ant A'}, {'value': 1, 'label': 'Ant B'}, {'value': 2, 'label': 'High Z'}]}}

    def callback(self, reinit, gains, levels):
        try:
            self.cv.acquire()
            action = Callback_Continue

            self.status['debug'] = {}

            if reinit: # True at start and when a requested frequency change has occurred
                first_n = int((self.freq_0 - self.range[0]) / self.range[2])
                self.status['sweep'] = {'freq_0': self.freq_0, 'freq_1': self.freq_0 + self.sdr.sdr_config.fsMHz, 'timestamp': self.time_0}
                self.status['debug']['first_n'] = first_n
                self.freq_0 = self.sdr.freq_0() # min frequency collected at this rfMHz (tuner frequency)

                if self.count > 0:
                    # update sweep levels from average collected levels
                    i0 = None
                    i1 = None
                    for i in xrange(len(self.levels)):
                        if i < 0.1 * len(self.levels) or i > 0.9 * len(self.levels):
                            continue # discard levels at ends of FFT
                        if first_n + i < 0 or first_n + i >= len(self.sweep):
                            continue # discard levels outside the required range
                        if i0 is None: i0 = first_n + i
                        i1 = first_n + i
                        if self.sweep[first_n + i] is None:
                            self.sweep[first_n + i] = self.levels[i] / self.count #FIXME don't overwrite levels we already may have - should average?
                    self.levels = None
                    self.count = 0

                # request to advance frequency - will collect levels on current frequency until change completes
                self.sdr.sdr_config.rfMHz += 0.8 * self.sdr.sdr_config.fsMHz
                action = Callback_Reinit

                if self.sdr.sdr_config.rfMHz - 0.4 * self.sdr.sdr_config.fsMHz > self.range[1]:
                    # sweep complete, start new one
                    if None not in self.sweep:
                        self.config.write_spectrum(self.time_0, self.sweep)
                        self.sweep_n += 1
                    self.time_0 = now()
                    self.sweep = [None] * (int((self.range[1] - self.range[0]) / self.range[2]) + 1)
                    self.sdr.sdr_config.rfMHz = self.range[0] + 0.4 * self.sdr.sdr_config.fsMHz

            # update levels
            levels = [max(-127, min(128, int(10.0 * (l - 8.0)))) for l in levels] # re-scale levels
            if self.levels is None:
                self.levels = [0.0] * len(levels)
            self.levels = [l0 + l1 for l0, l1 in zip(self.levels, levels)] # elementwise addition
            self.count += 1

            self.status['sweep']['max'] = max(levels)
            self.status['sweep']['sweep_n'] = self.sweep_n
            self.status['debug'].update({'rfMHz_next': self.sdr.sdr_config.rfMHz, 'len': len(levels), 'sweep_n': self.sweep_n, 'None': self.sweep.count(None), 'len': len(self.sweep)})

            self.cv.notify()

            return Callback_Exit if self.stop else action
        except BaseException as e:
            log.exception(e)
            self.stop = True
            return Callback_Exit
        finally:
            self.cv.release()

    def iterator(self, config):
        """ Scan the spectrum, storing data through the config object, and yield status.
        """
        self.range = [f / 1e6 for f in parse_config(config.values)['range']]
        self.config = config

        self.status.clear()
        yield

        debug = 'debug' in sys.argv
        self.sdr = SdrPlay(rfMHz=self.range[0], cwMHz=self.range[2], antenna=config.values['scan']['antenna'], verbose=debug, **config.values)
        self.sdr.sdr_config.rfMHz += 0.4 * self.sdr.sdr_config.fsMHz
        self.stop = False
        self.sweep_n = config.count
        self.time_0 = now()
        self.freq_0 = self.sdr.freq_0()
        self.levels = None
        self.count = 0
        self.sweep = [None] * (int((self.range[1] - self.range[0]) / self.range[2]) + 1)

        sdr_thread = threading.Thread(target=self.sdr.main)
        self.sdr.open(self.callback)
        sdr_thread.start()

        try:
            log.debug("Scan: %s %s", config.values['scan'], self.range)
            while True:
                self.cv.acquire()
                if self.stop:
                    break
                self.cv.wait() # don't need this in a loop because we don't care about spurious notifies, status will be ok
                yield
                self.cv.release()
        finally:
            self.cv.release()
            self.stop = True
            sdr_thread.join()
            self.sdr.close()
