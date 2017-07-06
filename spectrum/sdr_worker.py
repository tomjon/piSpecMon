""" Define Worker process, for scanning the spectrum using the SDR Play device.
"""
import threading
import sys
from spectrum.process import Process
from spectrum.common import log, parse_config, now
from sdr_play import SdrPlay, Callback_Continue, Callback_Reinit, Callback_Exit

class SdrThread(threading.Thread):
    def __init__(self, sdr, callback):
        super(SdrThread, self).__init__()
        self.sdr = sdr
        self.callback = callback

    def run(self):
        try:
            if self.sdr.open(self.callback) == 0:
                self.sdr.main()
            self.sdr.close()
        except BaseException as e:
            log.exception(e)

class SdrWorker(Process):
    """ Process implementation for spectrum scanning using the SDR Play device.
    """
    def __init__(self, data_store, run_path, config_file):
        super(SdrWorker, self).__init__(data_store, run_path, config_file)
        self.cv = threading.Condition()

    def callback(self, reinit, gains, levels):
        try:
            self.cv.acquire()
            action = Callback_Continue

            if reinit: # True at start and when a requested frequency change has occurred
                first_n = int((self.freq_0 - self.range[0]) / self.range[2])
                z = self.freq_0
                self.freq_0 = self.sdr.freq_0() # min frequency collected at this rfMHz (tuner frequency)

                if self.count > 0:
                    # update sweep levels from average collected levels
                    for i in xrange(len(self.levels)):
                        if i < 0.1 * len(self.levels) or i > 0.9 * len(self.levels):
                            continue # discard levels at ends of FFT
                        if first_n + i < 0 or first_n + i >= len(self.sweep):
                            continue # discard levels outside the required range
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

                self.status['sweep'] = {'timestamp': self.time_0, 'sweep_n': self.sweep_n}
                self.status['details'] = {'freq_0': self.freq_0, 'first_n': first_n, 'len': len(self.sweep)}

            # update levels (if reinit, levels are for the new tuner frequency)
            levels = [max(0, min(100, 20.0 * (l - 8.0))) for l in levels] #FIXME re-scale levels
            if self.levels is None:
                self.levels = [0.0] * len(levels)
            self.levels = [l0 + l1 for l0, l1 in zip(self.levels, levels)] # elementwise addition
            self.count += 1

            self.status['debug'] = {'rfMHz_next': self.sdr.sdr_config.rfMHz, 'max': max(levels), 'len': len(levels)}

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
        self.sdr = SdrPlay(rfMHz=self.range[0], cwMHz=self.range[2], antenna=0, verbose=debug, **config.values)
        self.sdr.sdr_config.rfMHz += 0.4 * self.sdr.sdr_config.fsMHz
        self.stop = False
        self.sweep_n = config.count
        self.time_0 = now()
        self.freq_0 = self.sdr.freq_0()
        self.levels = None
        self.count = 0
        self.sweep = [None] * (int((self.range[1] - self.range[0]) / self.range[2]) + 1)

        #sdr_thread = threading.Thread(target=lambda: self.sdr.main(self.callback)) 
        sdr_thread = SdrThread(self.sdr, self.callback)       
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
            try:
                self.cv.release()
                log.debug("Stop scan")
                self.stop = True
                sdr_thread.join()
            except BaseException as e:
                log.exception(e)
            log.debug("Main thread completed")


