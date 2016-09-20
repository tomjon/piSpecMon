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
from config import DATA_DIR, SAMPLES_DIRECTORY, SETTINGS_DIR
from common import StoreError, local_path


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


class Struct(struct.Struct):
    """ Extensions of the struct module's Struct class, adding read and write functions for
        file-like objects.
    """
    def __init__(self, format, array=False):
        super(Struct, self).__init__(format)
        self.array = array

    def fread(self, f):
        """ Read and unpack from the given file object, returning None if there
            are not enough bytes to read.
        """
        bytes = f.read(self.size)
        if len(bytes) < self.size:
            return None
        v = self.unpack(bytes)
        return v[0] if not self.array else v

    def fwrite(self, f, value):
        """ Pack and write bytes to the given file object for the given value.
        """
        bytes = self.pack(*value) if self.array else self.pack(value)
        f.write(bytes)


_dir = local_path(DATA_DIR)
_settings = local_path(SETTINGS_DIR)
_index = os.path.join(_dir, INDEX)
_t_struct = Struct('Q')
_n_struct = Struct('I')


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
    def iter():
        """ Yield stored Config objects.
        """
        with open(_index) as f:
            for config_id in f:
                config_id = config_id.strip()
                if len(config_id) == 0 or config_id[0] == '.':
                    continue
                config = Config(config_id)
                config.read()
                yield config

    def read(self):
        """ Read config attributes from the data store.
        """
        dir = os.path.join(_dir, self.id)
        with open(os.path.join(dir, CONFIG)) as f:
            self.values = json.loads(f.read())
        with open(os.path.join(dir, FORMAT)) as f:
            self.timestamp = _t_struct.fread(f)
            self.n_freq = _n_struct.fread(f)
        with open(os.path.join(dir, SPECTRUM_TIMES)) as f:
            self.first = _t_struct.fread(f)
            if f.tell() > 0:
                f.seek(-_t_struct.size, os.SEEK_END)
                self.latest = _t_struct.fread(f)
                f.seek(0, os.SEEK_END)
                self.count = f.tell() / _t_struct.size
            else:
                self.latest = None
                self.count = 0
        return self

    def write(self, timestamp=None, values=None):
        """ Write config attributes to the data store.
        """
        if values is not None:
            self.values = values
        self.id = str(timestamp)
        dir = os.path.join(_dir, self.id)
        os.mkdir(dir)
        with open(_index, 'a') as f:
            f.write(self.id)
            f.write('\n')
        with open(os.path.join(dir, CONFIG), 'w') as f:
            f.write(json.dumps(self.values))
        with open(os.path.join(dir, FORMAT), 'w') as f:
            _t_struct.fwrite(f, timestamp)
            if self.n_freq is not None:
                _n_struct.fwrite(f, self.n_freq)
        for name in (SPECTRUM, AUDIO, RDS, RDS_NAME, RDS_TEXT, ERROR):
            os.mkdir(os.path.join(dir, name))
        with open(os.path.join(dir, SPECTRUM_TIMES), 'a') as f:
            pass
        return self

    def delete(self):
        """ Delete the config and all associated data from the data store.
        """
        _tmp = '{0}_tmp'.format(_index)
        with open(_index) as f_index, open(_tmp, 'w') as f_tmp:
            for config_id in f_index:
                config_id = config_id.strip()
                if config_id == self.id:
                    continue
                f_tmp.write(config_id)
                f_tmp.write('\n')
        os.rename(_tmp, _index)
        shutil.rmtree(os.path.join(_dir, self.id))
        self.id = None # render config object useless (id no longer valid)

    def _iter_data(self, times_file, data_file, start, end, _struct):
        seek = False
        dir = os.path.join(_dir, self.id)
        t_path = os.path.join(dir, times_file)
        d_path = os.path.join(dir, data_file)
        if not os.path.exists(t_path) or not os.path.exists(d_path):
            return
        with open(t_path, 'r') as f_t, open(d_path, 'r') as f_d:
            while True:
                timestamp = _t_struct.fread(f_t)
                if timestamp is None or (end is not None and timestamp > end):
                    return
                if not seek:
                    if start is not None and timestamp < start:
                        continue
                    f_d.seek(_struct.size * (f_t.tell() / _t_struct.size - 1))
                    seek = True
                yield timestamp, _struct.fread(f_d)

    def _write_data(self, times_file, data_file, timestamp, _struct, data):
        dir = os.path.join(_dir, self.id)
        with open(os.path.join(dir, times_file), 'a') as f:
            _t_struct.fwrite(f, timestamp)
        with open(os.path.join(dir, data_file), 'a') as f:
            _struct.fwrite(f, data)

    def _iter_freq_data(self, times_file, data_file, start=None, end=None):
        timestamp0, offset0 = None, None
        dir = os.path.join(_dir, self.id)
        t_path = os.path.join(dir, times_file)
        d_path = os.path.join(dir, data_file)
        if not os.path.exists(t_path) or not os.path.exists(d_path):
            return
        with open(t_path, 'r') as f_t, open(d_path, 'r') as f_d:
            while True:
                timestamp = _t_struct.fread(f_t)
                offset = _n_struct.fread(f_t)
                if timestamp is None or (end is not None and timestamp > end):
                    break
                if start is not None and timestamp < start:
                    continue
                if offset0 is None:
                    f_d.seek(offset)
                    timestamp0 = timestamp
                    offset0 = offset
                    continue
                size = offset - offset0 - _n_struct.size
                yield timestamp0, _n_struct.fread(f_d), f_d.read(size)
                timestamp0 = timestamp
                offset0 = offset
            if offset0 is not None:
                size = offset - offset0 - _n_struct.size if offset else -1
                yield timestamp0, _n_struct.fread(f_d), f_d.read(size)

    def _write_freq_data(self, times_file, data_file, timestamp, freq_n, data):
        dir = os.path.join(_dir, self.id)
        with open(os.path.join(dir, times_file), 'a') as f_t, \
             open(os.path.join(dir, data_file), 'a') as f_d:
            _t_struct.fwrite(f_t, timestamp)
            _n_struct.fwrite(f_t, f_d.tell())
            _n_struct.fwrite(f_d, freq_n)
            f_d.write(data)

    def iter_spectrum(self, start=None, end=None):
        """ Yield (timestamp, strengths) for each spectrum sweep in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        if self.n_freq is None:
            dir = os.path.join(_dir, self.id)
            with open(os.path.join(dir, FORMAT), 'r') as f:
                self.n_freq = _n_struct.fread(f)
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
            dir = os.path.join(_dir, self.id)
            with open(os.path.join(dir, FORMAT), 'a') as f:
                _n_struct.fwrite(f, self.n_freq)
        _struct = Struct('{0}b'.format(self.n_freq), True)
        self._write_data(SPECTRUM_TIMES, SPECTRUM_DATA, timestamp, _struct, strengths)

    def audio_path(self, timestamp, freq_n):
        """ Return a (base) path at which an audio sample is stored.
        """
        return os.path.join(SAMPLES_DIRECTORY, self.id, str(freq_n), str(timestamp))

    def iter_audio(self, start=None, end=None):
        """ Yield (timestamp, freq_n) for stored audio samples in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_data(AUDIO_TIMES, AUDIO_DATA, start, end, _n_struct):
            yield _

    def write_audio(self, timestamp, freq_n):
        """ Write freq_n and timestamp for an audio sample.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_data(AUDIO_TIMES, AUDIO_DATA, timestamp, _n_struct, freq_n)
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
        self.dir = os.path.join(_settings, self.id)

    def read(self, defaults=None):
        """ Read settings value, using the defaults given if it is not already set.
        """
        if not os.path.exists(self.dir):
            self.values = defaults or {}
            self.write()
            return self
        with open(self.dir) as f:
            self.values = json.loads(f.read())
        return self

    def write(self, values=None):
        """ Write settings value.
        """
        if values is not None:
            self.values = values
        with open(self.dir, 'w') as f:
            f.write(json.dumps(self.values))
        return self


def stats():
    """ Return a dictionary of statistics name/values.
    """
    return {}


# initialise - just create data directory if necessary
if not os.path.exists(_dir):
    os.mkdir(_dir)
if not os.path.exists(_settings):
    os.mkdir(_settings)
if not os.path.exists(_index):
    with open(_index, 'w'):
        pass


if __name__ == '__main__':
    try:
        assert not os.path.exists('.test')
        _dir = local_path('.test/data')
        _settings = local_path('.test/settings')
        os.mkdir('.test')
        os.mkdir(_dir)
        os.mkdir(_settings)

        s = Settings('foo')
        s.read({'test': 'value'})
        assert s.values == {'test': 'value'}
        s.read()
        assert s.values == {'test': 'value'}
        s = Settings('foo')
        s.read()
        assert s.values == {'test': 'value'}
        s.write({'a': 'b'})
        assert s.values == {'a': 'b'}
        s.read()
        assert s.values == {'a': 'b'}

        c = Config()
        c.write(1066, {'config': 'values'})
        assert c.values == {'config': 'values'}

        c.write_spectrum(1066, [10, 20, -30])
        c.write_spectrum(1080, [1, 2, 3])
        c.write_spectrum(1200, [0, 0, 0])
        c.write_spectrum(1300, [10, 10, 12])
        assert list(c.iter_spectrum()) == [(1066, (10, 20, -30)),
                                           (1080, (1, 2, 3)),
                                           (1200, (0, 0, 0)),
                                           (1300, (10, 10, 12))]
        assert list(c.iter_spectrum(1073, 1260)) == [(1080, (1, 2, 3)),
                                                     (1200, (0, 0, 0))]
        assert list(c.iter_spectrum(1080, 1300)) == [(1080, (1, 2, 3)),
                                                     (1200, (0, 0, 0)),
                                                     (1300, (10, 10, 12))]
        assert list(c.iter_spectrum(1066, 1200)) == [(1066, (10, 20, -30)),
                                                     (1080, (1, 2, 3)),
                                                     (1200, (0, 0, 0))]
        assert list(c.iter_spectrum(500, 1500)) == [(1066, (10, 20, -30)),
                                                    (1080, (1, 2, 3)),
                                                    (1200, (0, 0, 0)),
                                                    (1300, (10, 10, 12))]
        assert list(c.iter_spectrum(1070, 1074)) == []

        c.write_audio(1066, 4)
        c.write_audio(1080, 6)
        assert list(c.iter_audio()) == [(1066, 4), (1080, 6)]
        assert list(c.iter_audio(1050, 1070)) == [(1066, 4)]

        c.write_rds_name(1066, 1, 'Radio 7')
        c.write_rds_name(1080, 4, 'Bilbo')
        c.write_rds_name(1090, 1, 'Frodo')
        c.write_rds_name(1280, 6, 'Wikipedia')
        assert list(c.iter_rds_name()) == [(1066, 1, 'Radio 7'),
                                           (1080, 4, 'Bilbo'),
                                           (1090, 1, 'Frodo'),
                                           (1280, 6, 'Wikipedia')]
        assert list(c.iter_rds_name(1050, 1300)) == [(1066, 1, 'Radio 7'),
                                                     (1080, 4, 'Bilbo'),
                                                     (1090, 1, 'Frodo'),
                                                     (1280, 6, 'Wikipedia')]
        assert list(c.iter_rds_name(1050, 1085)) == [(1066, 1, 'Radio 7'),
                                                     (1080, 4, 'Bilbo')]
        assert list(c.iter_rds_name(1090, 1300)) == [(1090, 1, 'Frodo'),
                                                     (1280, 6, 'Wikipedia')]
    finally:
        shutil.rmtree('.test')
