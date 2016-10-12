""" File system based sata store implementation.

    data
      |
      +-- config_id
      |       |
      |       +----- format                    Binary format file (see below)
      |       +----- config                    JSON format config file
              +----- spectrum
              |          |
              |          +----- timestamps     Binary (struct) format timestamps file
              |          +----- data           Binary (struct) format spectrum data
              +----- audio
              |          |
              |          +----- timestamps     Binary (struct) format timestamps file
              |          +----- data           Binary (struct) format audio sample data
              +----- rds
              |       |
              |       +--- name
              |       |       |
              |       |       +----- timestamps     Binary (struct) format timestamps file
              |       |       +----- data           Binary (struct) format RDS name data
              |       +--- text
              |       |       |
              |       |       +----- timestamps     Binary (struct) format timestamps file
              |       |       +----- data           Binary (struct) format RDS text data
              +----- error
              |         |
              |         +----- timestamps      Binary (struct) format timestamps file
              |         +----- data            Binary (struct) format error data

    The format file contains the timestamp of config creation, and the number of
    frequencies per sweep (i.e. the length of the strengths array).
"""

import json
import os
import os.path
import shutil
import struct
from config import DATA_PATH, SAMPLES_PATH, SETTINGS_PATH
from common import StoreError, local_path, fs_size, fs_free


# constants for naming paths
INDEX = 'index'
FORMAT = 'format'
CONFIG = 'config'
TIMESTAMPS = 'timestamps'
DATA = 'data'

SPECTRUM = 'spectrum'
SPECTRUM_TIMES = os.path.join(SPECTRUM, TIMESTAMPS)
SPECTRUM_DATA = os.path.join(SPECTRUM, DATA)

AUDIO = 'audio'
AUDIO_TIMES = os.path.join(AUDIO, TIMESTAMPS)
AUDIO_DATA = os.path.join(AUDIO, DATA)

RDS = 'rds'

RDS_NAME = os.path.join(RDS, 'name')
RDS_NAME_TIMES = os.path.join(RDS_NAME, TIMESTAMPS)
RDS_NAME_DATA = os.path.join(RDS_NAME, DATA)

RDS_TEXT = os.path.join(RDS, 'text')
RDS_TEXT_TIMES = os.path.join(RDS_TEXT, TIMESTAMPS)
RDS_TEXT_DATA = os.path.join(RDS_TEXT, DATA)

ERROR = 'error'
ERROR_TIMES = os.path.join(ERROR, TIMESTAMPS)
ERROR_DATA = os.path.join(ERROR, DATA)

# derived constants
LOCAL_DATA = local_path(DATA_PATH)
LOCAL_SETTINGS = local_path(SETTINGS_PATH)
LOCAL_INDEX = os.path.join(LOCAL_DATA, INDEX)


class Struct(struct.Struct):
    """ Extensions of the struct module's Struct class, adding read and write functions for
        file-like objects.
    """
    def __init__(self, format_str, array=False):
        super(Struct, self).__init__(format_str)
        self.array = array

    def fread(self, f):
        """ Read and unpack from the given file object, returning None if there
            are not enough bytes to read.
        """
        raw = f.read(self.size)
        if len(raw) < self.size:
            return None
        v = self.unpack(raw)
        return v[0] if not self.array else v

    def fwrite(self, f, value):
        """ Pack and write bytes to the given file object for the given value.
        """
        raw = self.pack(*value) if self.array else self.pack(value)
        f.write(raw)


_T_STRUCT = Struct('Q')
_N_STRUCT = Struct('I')


class Config(object):
    """ A wrapper for config id, timestamp, and values.
    """

    def __init__(self, _id=None, values=None, timestamp=None, first=None, latest=None, count=0):
        self.id = _id
        self.values = values
        self.timestamp = timestamp
        self.first = first
        self.latest = latest
        self.count = count
        self.n_freq = None

    @staticmethod
    def iter(debug=False):
        """ Yield stored Config objects.
        """
        with open(LOCAL_INDEX) as f:
            for config_id in f:
                config_id = config_id.strip()
                if len(config_id) == 0 or config_id[0] == '.':
                    continue
                config = Config(config_id)
                config.read(debug)
                yield config

    def read(self, debug=False):
        """ Read config attributes from the data store.
        """
        path = os.path.join(LOCAL_DATA, self.id)
        with open(os.path.join(path, CONFIG)) as f:
            self.values = json.loads(f.read())
        with open(os.path.join(path, FORMAT)) as f:
            self.timestamp = _T_STRUCT.fread(f)
            self.n_freq = _N_STRUCT.fread(f)
        firsts = []
        latests = []
        counts = {}
        for name, offset in (
                (SPECTRUM_TIMES, _T_STRUCT.size),
                (AUDIO_TIMES, _T_STRUCT.size),
                (RDS_NAME_TIMES, _T_STRUCT.size + _N_STRUCT.size),
                (RDS_TEXT_TIMES, _T_STRUCT.size + _N_STRUCT.size)
        ):
            path = os.path.join(path, name)
            if not os.path.exists(path):
                continue
            with open(path) as f:
                if debug:
                    print self.id, name,
                firsts.append(_T_STRUCT.fread(f))
                if debug:
                    print firsts[-1],
                if f.tell() == 0:
                    continue
                f.seek(-offset, os.SEEK_END)
                latests.append(_T_STRUCT.fread(f))
                if debug:
                    print latests[-1],
                f.seek(0, os.SEEK_END)
                counts[name] = f.tell() / _T_STRUCT.size
                if debug:
                    print
        self.first = min(firsts) if len(firsts) > 0 else None
        self.latest = max(latests) if len(latests) > 0 else None
        self.count = counts[SPECTRUM_TIMES] if SPECTRUM_TIMES in counts else 0
        return self

    def write(self, timestamp=None, values=None):
        """ Write config attributes to the data store.
        """
        if values is not None:
            self.values = values
        self.id = str(timestamp)
        path = os.path.join(LOCAL_DATA, self.id)
        os.mkdir(path)
        with open(LOCAL_INDEX, 'a') as f:
            f.write(self.id)
            f.write('\n')
        with open(os.path.join(path, CONFIG), 'w') as f:
            f.write(json.dumps(self.values))
        with open(os.path.join(path, FORMAT), 'w') as f:
            _T_STRUCT.fwrite(f, timestamp)
            if self.n_freq is not None:
                _N_STRUCT.fwrite(f, self.n_freq)
        for name in (SPECTRUM, AUDIO, RDS, RDS_NAME, RDS_TEXT, ERROR):
            os.mkdir(os.path.join(path, name))
        with open(os.path.join(path, SPECTRUM_TIMES), 'a') as f:
            pass
        return self

    def delete(self):
        """ Delete the config and all associated data from the data store.
        """
        _tmp = '{0}_tmp'.format(LOCAL_INDEX)
        with open(LOCAL_INDEX) as f_index, open(_tmp, 'w') as f_tmp:
            for config_id in f_index:
                config_id = config_id.strip()
                if config_id == self.id:
                    continue
                f_tmp.write(config_id)
                f_tmp.write('\n')
        os.rename(_tmp, LOCAL_INDEX)
        shutil.rmtree(os.path.join(LOCAL_DATA, self.id))
        self.id = None # render config object useless (id no longer valid)

    def _iter_data(self, times_file, data_file, start, end, _struct):
        seek = False
        path = os.path.join(LOCAL_DATA, self.id)
        t_path = os.path.join(path, times_file)
        d_path = os.path.join(path, data_file)
        if not os.path.exists(t_path) or not os.path.exists(d_path):
            return
        with open(t_path, 'r') as f_t, open(d_path, 'r') as f_d:
            while True:
                timestamp = _T_STRUCT.fread(f_t)
                if timestamp is None or (end is not None and timestamp > end):
                    return
                if not seek:
                    if start is not None and timestamp < start:
                        continue
                    f_d.seek(_struct.size * (f_t.tell() / _T_STRUCT.size - 1))
                    seek = True
                yield timestamp, _struct.fread(f_d)

    def _write_data(self, times_file, data_file, timestamp, _struct, data):
        path = os.path.join(LOCAL_DATA, self.id)
        with open(os.path.join(path, times_file), 'a') as f:
            _T_STRUCT.fwrite(f, timestamp)
        with open(os.path.join(path, data_file), 'a') as f:
            _struct.fwrite(f, data)

    def _iter_freq_data(self, times_file, data_file, start=None, end=None):
        timestamp0, offset0 = None, None
        path = os.path.join(LOCAL_DATA, self.id)
        t_path = os.path.join(path, times_file)
        d_path = os.path.join(path, data_file)
        if not os.path.exists(t_path) or not os.path.exists(d_path):
            return
        with open(t_path, 'r') as f_t, open(d_path, 'r') as f_d:
            while True:
                timestamp = _T_STRUCT.fread(f_t)
                offset = _N_STRUCT.fread(f_t)
                if timestamp is None or (end is not None and timestamp > end):
                    break
                if start is not None and timestamp < start:
                    continue
                if offset0 is None:
                    f_d.seek(offset)
                    timestamp0 = timestamp
                    offset0 = offset
                    continue
                size = offset - offset0 - _N_STRUCT.size
                yield timestamp0, _N_STRUCT.fread(f_d), f_d.read(size)
                timestamp0 = timestamp
                offset0 = offset
            if offset0 is not None:
                size = offset - offset0 - _N_STRUCT.size if offset else -1
                yield timestamp0, _N_STRUCT.fread(f_d), f_d.read(size)

    def _write_freq_data(self, times_file, data_file, timestamp, freq_n, data):
        path = os.path.join(LOCAL_DATA, self.id)
        with open(os.path.join(path, times_file), 'a') as f_t, \
             open(os.path.join(path, data_file), 'a') as f_d:
            _T_STRUCT.fwrite(f_t, timestamp)
            _N_STRUCT.fwrite(f_t, f_d.tell())
            _N_STRUCT.fwrite(f_d, freq_n)
            f_d.write(data)

    def iter_spectrum(self, start=None, end=None):
        """ Yield (timestamp, strengths) for each spectrum sweep in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        if self.n_freq is None:
            path = os.path.join(LOCAL_DATA, self.id)
            with open(os.path.join(path, FORMAT), 'r') as f:
                _T_STRUCT.fread(f)
                self.n_freq = _N_STRUCT.fread(f)
            if self.n_freq is None:
                return
        _struct = Struct('{0}b'.format(self.n_freq), True)
        for _ in self._iter_data(SPECTRUM_TIMES, SPECTRUM_DATA, start, end, _struct):
            yield _

    def write_spectrum(self, timestamp, strengths):
        """ Write spectrum strengths found at the given timestamp.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        if self.n_freq is None:
            self.n_freq = len(strengths)
            path = os.path.join(LOCAL_DATA, self.id)
            with open(os.path.join(path, FORMAT), 'a') as f:
                _N_STRUCT.fwrite(f, self.n_freq)
        _struct = Struct('{0}b'.format(self.n_freq), True)
        self._write_data(SPECTRUM_TIMES, SPECTRUM_DATA, timestamp, _struct, strengths)

    def audio_path(self, timestamp, freq_n):
        """ Return a (base) path at which an audio sample is stored.
        """
        return os.path.join(SAMPLES_PATH, self.id, str(freq_n), str(timestamp))

    def iter_audio(self, start=None, end=None):
        """ Yield (timestamp, freq_n) for stored audio samples in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_data(AUDIO_TIMES, AUDIO_DATA, start, end, _N_STRUCT):
            yield _

    def write_audio(self, timestamp, freq_n):
        """ Write freq_n and timestamp for an audio sample.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_data(AUDIO_TIMES, AUDIO_DATA, timestamp, _N_STRUCT, freq_n)
        return self.audio_path(timestamp, freq_n)

    def iter_rds_name(self, start=None, end=None):
        """ Yield (timestamp, freq_n, name) for RDS names in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_freq_data(RDS_NAME_TIMES, RDS_NAME_DATA, start, end):
            yield _

    def write_rds_name(self, timestamp, freq_n, name):
        """ Write freq_n and timestamp for an RDS name.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(RDS_NAME_TIMES, RDS_NAME_DATA, timestamp, freq_n, name)

    def iter_rds_text(self, start=None, end=None):
        """ Yield (timestamp, freq_n, text) for RDS text in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_freq_data(RDS_TEXT_TIMES, RDS_TEXT_DATA, start, end):
            yield _

    def write_rds_text(self, timestamp, freq_n, text):
        """ Write freq_n, timestamp and text for RDS text in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(RDS_TEXT_TIMES, RDS_TEXT_DATA, timestamp, freq_n, text)

    def iter_error(self):
        """ Yield (timestamp, error) for all errors.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for timestamp, _, error in self._iter_freq_data(ERROR_TIMES, ERROR_DATA):
            yield timestamp, error

    def write_error(self, timestamp, error):
        """ Write an error at the given timestamp.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(ERROR_TIMES, ERROR_DATA, timestamp, 0, str(error))


class Settings(object):
    """ A wrapper for settings id and value.
    """

    def __init__(self, _id, values=None):
        self.id = _id
        self.values = values
        self.path = os.path.join(LOCAL_SETTINGS, self.id)

    def read(self, defaults=None):
        """ Read settings value, using the defaults given if it is not already set.
        """
        if not os.path.exists(self.path):
            if defaults is None:
                raise StoreError("No defaults and no settings for {0}".format(self.id))
            self.values = defaults
            self.write()
            return self
        with open(self.path) as f:
            self.values = json.loads(f.read())
        return self

    def write(self, values=None):
        """ Write settings value.
        """
        if values is not None:
            self.values = values
        with open(self.path, 'w') as f:
            f.write(json.dumps(self.values))
        return self


def stats():
    """ Return a dictionary of statistics name/values.
    """
    return {
        'audio': fs_size(SAMPLES_PATH),
        'size': fs_size(DATA_PATH),
        'free': fs_free(DATA_PATH)
    }


# initialise - just create data directory if necessary
if not os.path.exists(LOCAL_DATA):
    os.mkdir(LOCAL_DATA)
if not os.path.exists(LOCAL_SETTINGS):
    os.mkdir(LOCAL_SETTINGS)
if not os.path.exists(LOCAL_INDEX):
    with open(LOCAL_INDEX, 'w'):
        pass


if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        list(Config.iter(True))
        sys.exit(0)

    try:
        assert not os.path.exists('.test')
        LOCAL_DATA = local_path('.test')
        LOCAL_SETTINGS = local_path('.test/settings')
        LOCAL_INDEX = local_path('.test/index')
        os.mkdir(LOCAL_DATA)
        os.mkdir(LOCAL_SETTINGS)

        _s = Settings('foo')
        _s.read({'test': 'value'})
        assert _s.values == {'test': 'value'}
        _s.read()
        assert _s.values == {'test': 'value'}
        _s = Settings('foo')
        _s.read()
        assert _s.values == {'test': 'value'}
        _s.write({'a': 'b'})
        assert _s.values == {'a': 'b'}
        _s.read()
        assert _s.values == {'a': 'b'}

        _c = Config()
        _c.write(1066, {'config': 'values'})
        assert _c.values == {'config': 'values'}

        _c.write_spectrum(1066, [10, 20, -30])
        _c.write_spectrum(1080, [1, 2, 3])
        _c.write_spectrum(1200, [0, 0, 0])
        _c.write_spectrum(1300, [10, 10, 12])
        assert list(_c.iter_spectrum()) == [(1066, (10, 20, -30)),
                                            (1080, (1, 2, 3)),
                                            (1200, (0, 0, 0)),
                                            (1300, (10, 10, 12))]
        assert list(_c.iter_spectrum(1073, 1260)) == [(1080, (1, 2, 3)),
                                                      (1200, (0, 0, 0))]
        assert list(_c.iter_spectrum(1080, 1300)) == [(1080, (1, 2, 3)),
                                                      (1200, (0, 0, 0)),
                                                      (1300, (10, 10, 12))]
        assert list(_c.iter_spectrum(1066, 1200)) == [(1066, (10, 20, -30)),
                                                      (1080, (1, 2, 3)),
                                                      (1200, (0, 0, 0))]
        assert list(_c.iter_spectrum(500, 1500)) == [(1066, (10, 20, -30)),
                                                     (1080, (1, 2, 3)),
                                                     (1200, (0, 0, 0)),
                                                     (1300, (10, 10, 12))]
        assert list(_c.iter_spectrum(1070, 1074)) == []

        _c.write_audio(1066, 4)
        _c.write_audio(1080, 6)
        assert list(_c.iter_audio()) == [(1066, 4), (1080, 6)]
        assert list(_c.iter_audio(1050, 1070)) == [(1066, 4)]

        _c.write_rds_name(1066, 1, 'Radio 7')
        _c.write_rds_name(1080, 4, 'Bilbo')
        _c.write_rds_name(1090, 1, 'Frodo')
        _c.write_rds_name(1280, 6, 'Wikipedia')
        assert list(_c.iter_rds_name()) == [(1066, 1, 'Radio 7'),
                                            (1080, 4, 'Bilbo'),
                                            (1090, 1, 'Frodo'),
                                            (1280, 6, 'Wikipedia')]
        assert list(_c.iter_rds_name(1050, 1300)) == [(1066, 1, 'Radio 7'),
                                                      (1080, 4, 'Bilbo'),
                                                      (1090, 1, 'Frodo'),
                                                      (1280, 6, 'Wikipedia')]
        assert list(_c.iter_rds_name(1050, 1085)) == [(1066, 1, 'Radio 7'),
                                                      (1080, 4, 'Bilbo')]
        assert list(_c.iter_rds_name(1090, 1300)) == [(1090, 1, 'Frodo'),
                                                      (1280, 6, 'Wikipedia')]

        _c = Config()
        _c.write(999, {})
        _c.read()
        list(_c.iter_spectrum())
    finally:
        shutil.rmtree('.test')
