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
import shutil
import struct
from spectrum.common import local_path, fs_size, fs_free
from spectrum.datastore import ConfigBase, SettingsBase, StoreError


class _Struct(struct.Struct):
    """ Extensions of the struct module's Struct class, adding read and write functions for
        file-like objects.
    """
    def __init__(self, format_str, array=False):
        super(_Struct, self).__init__(format_str)
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

_T_STRUCT = _Struct('Q')
_N_STRUCT = _Struct('I')


class FsDataStore(object): #FIXME will presumably subclass a DataStore class, if that has value
    """ File-system based implementation of a data store.
    """
    INDEX = 'index'

    def __init__(self, data_path, settings_path, samples_path):
        super(FsDataStore, self).__init__()
        self.local_data = local_path(data_path)
        self.local_settings = local_path(settings_path)
        self.local_samples = local_path(samples_path)
        self.local_index = os.path.join(self.local_data, self.INDEX)

        # initialise directories
        if not os.path.exists(self.local_data):
            os.mkdir(self.local_data)
        if not os.path.exists(self.local_settings):
            os.mkdir(self.local_settings)
        if not os.path.exists(self.local_index):
            with open(self.local_index, 'w'):
                pass

    def config(self, config_id=None):
        """ Return a Config object for the given config id.
        """
        return Config(self, config_id=config_id)

    def settings(self, settings_id=None):
        """ Return a Settings object for the given settings id.
        """
        return Settings(self, settings_id=settings_id)

    def iter_config(self, config_ids=None):
        """ Yield stored Config objects.
        """
        def _iter_ids():
            with open(self.local_index) as f:
                for config_id in f:
                    yield config_id.strip()

        for config_id in _iter_ids() if config_ids is None else config_ids:
            config = Config(self, config_id=config_id)
            config.read()
            yield config

    def stats(self):
        """ Return a dictionary of usage statistics name/values.
        """
        return {
            'audio': fs_size(self.local_samples),
            'size': fs_size(self.local_data),
            'free': fs_free(self.local_data)
        }


class Config(ConfigBase):
    """ File system implementation of Config.
    """
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

    def __init__(self, data_store, **args):
        super(Config, self).__init__(data_store, **args)
        self.n_freq = None

    def read(self):
        """ Read config attributes from the data store.
        """
        path = os.path.join(self._data_store.local_data, self.id)
        with open(os.path.join(path, self.CONFIG)) as f:
            self.values = json.loads(f.read())
        with open(os.path.join(path, self.FORMAT)) as f:
            self.timestamp = _T_STRUCT.fread(f)
            self.n_freq = _N_STRUCT.fread(f)
        firsts = []
        latests = []
        counts = {}
        for name, offset in (
                (self.SPECTRUM_TIMES, _T_STRUCT.size),
                (self.AUDIO_TIMES, _T_STRUCT.size),
                (self.RDS_NAME_TIMES, _T_STRUCT.size + _N_STRUCT.size),
                (self.RDS_TEXT_TIMES, _T_STRUCT.size + _N_STRUCT.size)
        ):
            path = os.path.join(path, name)
            if not os.path.exists(path):
                continue
            with open(path) as f:
                firsts.append(_T_STRUCT.fread(f))
                if f.tell() == 0:
                    continue
                f.seek(-offset, os.SEEK_END)
                latests.append(_T_STRUCT.fread(f))
                f.seek(0, os.SEEK_END)
                counts[name] = f.tell() / _T_STRUCT.size
        self.first = min(firsts) if len(firsts) > 0 else None
        self.latest = max(latests) if len(latests) > 0 else None
        self.count = counts[self.SPECTRUM_TIMES] if self.SPECTRUM_TIMES in counts else 0
        return self

    def write(self, timestamp=None, values=None):
        """ Write config attributes to the data store.
        """
        if values is not None:
            self.values = values
        self.id = str(timestamp)
        path = os.path.join(self._data_store.local_data, self.id)
        os.mkdir(path)
        with open(self._data_store.local_index, 'a') as f:
            f.write(self.id)
            f.write('\n')
        with open(os.path.join(path, self.CONFIG), 'w') as f:
            f.write(json.dumps(self.values))
        with open(os.path.join(path, self.FORMAT), 'w') as f:
            _T_STRUCT.fwrite(f, timestamp)
            if self.n_freq is not None:
                _N_STRUCT.fwrite(f, self.n_freq)
        for name in (self.SPECTRUM, self.AUDIO, self.RDS, self.RDS_NAME, self.RDS_TEXT, self.ERROR):
            os.mkdir(os.path.join(path, name))
        with open(os.path.join(path, self.SPECTRUM_TIMES), 'a') as f:
            pass
        return self

    def delete(self):
        """ Delete the config and all associated data from the data store.
        """
        _tmp = '{0}_tmp'.format(self._data_store.local_index)
        with open(self._data_store.local_index) as f_index, open(_tmp, 'w') as f_tmp:
            for config_id in f_index:
                config_id = config_id.strip()
                if config_id == self.id:
                    continue
                f_tmp.write(config_id)
                f_tmp.write('\n')
        os.rename(_tmp, self._data_store.local_index)
        shutil.rmtree(os.path.join(self._data_store.local_data, self.id))
        self.id = None # render config object useless (id no longer valid)

    def _iter_data(self, times_file, data_file, start, end, _struct):
        seek = False
        path = os.path.join(self._data_store.local_data, self.id)
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
        path = os.path.join(self._data_store.local_data, self.id)
        with open(os.path.join(path, times_file), 'a') as f:
            _T_STRUCT.fwrite(f, timestamp)
        with open(os.path.join(path, data_file), 'a') as f:
            _struct.fwrite(f, data)

    def _iter_freq_data(self, times_file, data_file, start=None, end=None):
        timestamp0, offset0 = None, None
        path = os.path.join(self._data_store.local_data, self.id)
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
        path = os.path.join(self._data_store.local_data, self.id)
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
            path = os.path.join(self._data_store.local_data, self.id)
            with open(os.path.join(path, self.FORMAT), 'r') as f:
                _T_STRUCT.fread(f)
                self.n_freq = _N_STRUCT.fread(f)
            if self.n_freq is None:
                return
        _struct = _Struct('{0}b'.format(self.n_freq), True)
        for _ in self._iter_data(self.SPECTRUM_TIMES, self.SPECTRUM_DATA, start, end, _struct):
            yield _

    def write_spectrum(self, timestamp, strengths):
        """ Write spectrum strengths found at the given timestamp.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        if self.n_freq is None:
            self.n_freq = len(strengths)
            path = os.path.join(self._data_store.local_data, self.id)
            with open(os.path.join(path, self.FORMAT), 'a') as f:
                _N_STRUCT.fwrite(f, self.n_freq)
        _struct = _Struct('{0}b'.format(self.n_freq), True)
        self._write_data(self.SPECTRUM_TIMES, self.SPECTRUM_DATA, timestamp, _struct, strengths)

    def iter_audio(self, start=None, end=None):
        """ Yield (timestamp, freq_n) for stored audio samples in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_data(self.AUDIO_TIMES, self.AUDIO_DATA, start, end, _N_STRUCT):
            yield _

    def write_audio(self, timestamp, freq_n):
        """ Write freq_n and timestamp for an audio sample.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_data(self.AUDIO_TIMES, self.AUDIO_DATA, timestamp, _N_STRUCT, freq_n)
        return self.audio_path(timestamp, freq_n)

    def iter_rds_name(self, start=None, end=None):
        """ Yield (timestamp, freq_n, name) for RDS names in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_freq_data(self.RDS_NAME_TIMES, self.RDS_NAME_DATA, start, end):
            yield _

    def write_rds_name(self, timestamp, freq_n, name):
        """ Write freq_n and timestamp for an RDS name.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(self.RDS_NAME_TIMES, self.RDS_NAME_DATA, timestamp, freq_n, name)

    def iter_rds_text(self, start=None, end=None):
        """ Yield (timestamp, freq_n, text) for RDS text in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_freq_data(self.RDS_TEXT_TIMES, self.RDS_TEXT_DATA, start, end):
            yield _

    def write_rds_text(self, timestamp, freq_n, text):
        """ Write freq_n, timestamp and text for RDS text in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(self.RDS_TEXT_TIMES, self.RDS_TEXT_DATA, timestamp, freq_n, text)

    def iter_error(self):
        """ Yield (timestamp, error) for all errors.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for timestamp, _, error in self._iter_freq_data(self.ERROR_TIMES, self.ERROR_DATA):
            yield timestamp, error

    def write_error(self, timestamp, error):
        """ Write an error at the given timestamp.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(self.ERROR_TIMES, self.ERROR_DATA, timestamp, 0, str(error))


class Settings(SettingsBase):
    """ File system implementation of Settings.
    """
    def __init__(self, data_store, **args):
        super(Settings, self).__init__(data_store, **args)
        self.path = os.path.join(data_store.local_settings, self.id)

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
