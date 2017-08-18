""" Define Worker process, for scanning the spectrum using a Keysight sensor.
"""
import sys
from spectrum.process import Process
from spectrum.common import log, parse_config, now
from spectrum.config import AMS_SENSOR_ADDR, AMS_SENSOR_PORT
from pyams import Sensor

class AmsWorker(Process):
    """ Process implementation for spectrum scanning using a Keysight sensor.
    """
    def __init__(self, data_store, run_path, config_file):
        super(AmsWorker, self).__init__(data_store, run_path, config_file)

    def iterator(self, config):
        """ Scan the spectrum, storing data through the config object, and yield status.
        """
        frange = parse_config(config.values)['range']

        self.status.clear()
        yield

        with Sensor(AMS_SENSOR_ADDR, AMS_SENSOR_PORT) as sensor:
            antenna = config.values['scan']['antenna']
            debug = 'debug' in sys.argv

            # go half a channel either side of the range (hf is half channel span)
            hf = frange[2] * 0.5
            minF = frange[0] - hf
            maxF = frange[1] + hf

            for sweep_idx, df, amps in sensor.iter_sweep(minF, maxF):
                # channelise the amplitudes at channel frequencies
                c_amps = []
                bf = minF + frange[2]
                max_amp = None
                for i in xrange(len(amps)):
                    f = minF + i * df
                    max_amp = max(max_amp, amps[i])
                    if f > bf: #-120 to -90
                        c_amps.append((max_amp + 120.0) * 4.0)
                        bf += frange[2]
                        max_amp = None

                time_0 = now()
                self.status['sweep'] = {'timestamp': time_0, 'frange': frange, 'len': len(c_amps)}
                self.status['sweep']['sweep_n'] = config.count + sweep_idx
                freq_n = max(xrange(len(c_amps)), key=c_amps.__getitem__)
                self.status['sweep']['peaks'] = {'freq_n': freq_n, 'strength': c_amps[freq_n]}
                config.write_spectrum(time_0, c_amps)
                yield

