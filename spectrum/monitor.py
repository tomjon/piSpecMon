""" Module for monitoring the RF spectrum using the rig.
"""
import math
import inspect
from time import sleep
import Hamlib
from spectrum.common import check_device

Hamlib.rig_set_debug(Hamlib.RIG_DEBUG_NONE)


def get_capabilities():
    """ Return a dictionary of rig capabilities.
    """
    caps = {'models': [], 'modes': [], 'rates': [], 'parities': []}

    is_int = lambda n: isinstance(n, int)
    #FIXME WinRadio RIG_MODEL_G313 is causing problems on Linux machines - ignore for now
    for model in [n for x, n in inspect.getmembers(Hamlib, is_int) if x.startswith('RIG_MODEL_') and x != 'RIG_MODEL_G313']:
        rig = Hamlib.Rig(model)
        if rig.this is None:
            continue
        caps['models'].append({
            'model': model,
            'manufacturer': rig.caps.mfg_name,
            'name': rig.caps.model_name,
            'version': rig.caps.version,
            'status': Hamlib.rig_strstatus(rig.caps.status),
            'modes': rig.state.mode_list
        })

    for n in xrange(int(math.log(Hamlib.RIG_MODE_TESTS_MAX - 1, 2))):
        mode = 2 ** n
        caps['modes'].append({'mode': mode, 'name': Hamlib.rig_strrmode(mode)})

    caps['rates'] = [{'rate': 2400, 'label': '2400'},
                     {'rate': 4800, 'label': '4800'},
                     {'rate': 9600, 'label': '9600'},
                     {'rate': 14400, 'label': '14.4k'},
                     {'rate': 19200, 'label': '19.2k'},
                     {'rate': 28800, 'label': '28.8k'}]

    for x, n in inspect.getmembers(Hamlib, is_int):
        if not x.startswith('RIG_PARITY_'):
            continue
        caps['parities'].append({'label': x[11:].capitalize(), 'value': n})

    return caps


class RigError(Exception):
    """ Wrapper for Hamlib errors.
    """

    def __init__(self, rig=None, call='?', tries=0):
        super(RigError, self).__init__()
        self.status = rig.error_status
        self.message = Hamlib.rigerror(self.status) if rig is not None else "Model not found"
        self.call = call
        self.tries = tries

    def __str__(self):
        args = (self.__class__.__name__,
                self.status, self.call,
                self.message,
                " (tried {0} times)".format(self.tries) if self.tries > 1 else "")
        return "{0} ({1}) in {2}: {3}{4}".format(*args)


class TimeoutError(RigError):
    """ Rig error for when a timeout occurs communicating with the rig.
    """
    pass


class Monitor(object):
    """ API for talking to the rig.
    """

    def __init__(self, model=1, data_bits=None, stop_bits=None, rate=None, parity=None,  # pylint: disable=too-many-arguments
                 write_delay=None, rig_device=None, set_check=0, retries=0, interval=0,
                 attenuation=None, **_):
        """ Arguments:

            model - hamlib model number, defaults to dummy implementation
            data_bits - if not None, set data bits on the rig port
            stop_bits - if not None, set stop bits on the rig port
            rate - if not None, set rate on the rig port
            parity - if not None, set parity on the rig port
            write_delay - if not None, set write delay on the rig port (ms)
            rig_device - is not None, set path name on the rig port
            set_check - 0 = set frequency and hope, N = set/check N times before failing
            retries - retry after error or timeout this many times
            interval - if > 0, pause this many ms before retrying (doubles each retry)
            attenuation - if not None, set attenuation for the rig
        """
        self.rig = Hamlib.Rig(model)
        if self.rig.this is None:
            raise RigError()
        if data_bits is not None:
            self.rig.state.rigport.parm.serial.data_bits = data_bits
        if stop_bits is not None:
            self.rig.state.rigport.parm.serial.stop_bits = stop_bits
        if rate is not None:
            self.rig.state.rigport.parm.serial.rate = rate
        if parity is not None:
            self.rig.state.rigport.parm.serial.parity = parity
        if write_delay is not None:
            self.rig.state.rigport.write_delay = write_delay
        if rig_device is not None:
            self.rig.state.rigport.pathname = check_device(rig_device)
        self.attenuation = attenuation
        self.set_check = set_check
        self.retries = retries
        self.interval = interval

    def open(self):
        """ Open communication with the rig.
        """
        self._check(self.rig.open)
        if self.attenuation is not None:
            gran = self.rig.get_level_gran(Hamlib.RIG_LEVEL_ATT)
            if isinstance(self.attenuation, bool):
                attenuation = gran.max.i if self.attenuation else gran.min.i
            else:
                attenuation = self.attenuation
            self._check(self.rig.set_level, Hamlib.RIG_LEVEL_ATT, attenuation, Hamlib.RIG_VFO_CURR)
        return self

    def close(self):
        """ Close communication with the rig.
        """
        self.rig.close()

    # handle errors and retries for hamlib calls
    def _check(self, fn, *args):
        tries = 0
        while tries <= self.retries:
            v = fn(*args)
            if self.rig.error_status == Hamlib.RIG_OK:
                return v
            sleep(self.interval * 2 ** tries / 1000.0)
            tries += 1
        if -self.rig.error_status == Hamlib.RIG_ETIMEOUT:
            raise TimeoutError(self.rig, fn.__name__, tries)
        raise RigError(self.rig, fn.__name__, tries)

    def set_frequency(self, freq):
        """ Set the rig frequency.
        """
        if self.set_check == 0:
            self._check(self.rig.set_freq, Hamlib.RIG_VFO_CURR, freq)
            return True
        else:
            checks = 0
            while checks < self.set_check:
                self._check(self.rig.set_freq, Hamlib.RIG_VFO_CURR, freq)
                if freq == self._check(self.rig.get_freq, Hamlib.RIG_VFO_CURR):
                    return True
                sleep(self.interval * 2 ** checks / 1000.0)
                checks += 1
            return False

    def get_strength(self, freq=None):
        """ Return signal strength at the current frequency, or if 'freq' is specified,
            change frequency first.
        """
        if freq is not None and not self.set_frequency(freq):
            return None
        return self._check(self.rig.get_strength, Hamlib.RIG_VFO_CURR)

    def set_mode(self, mode):
        """ Set the rig mode.
        """
        if mode is not None and mode != Hamlib.RIG_MODE_NONE:
            width = self._check(self.rig.passband_normal, mode)
            self._check(self.rig.set_mode, mode, width, Hamlib.RIG_VFO_CURR)

    def power_off(self):
        """ Power down the rig (use power module to turn it back on).
        """
        self.rig.set_powerstat(Hamlib.RIG_POWER_OFF)

