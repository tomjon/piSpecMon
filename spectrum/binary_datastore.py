""" Binary based data store implementation.

    data
      |
      +-- config_id
      |       |
      |       +----- format                    Binary format file (timestamp of config creation)
      |       +----- config                    JSON format config file
      |       +----- worker_[worker]           Worker data is stored independantly
                          |
                          +----- spectrum
                          |          |
                          |          +----- format         Binary (struct) format n_freq and timestamps file
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

    The format file contains the timestamp of config creation.
"""
import json
import os
import shutil
import struct
from spectrum.common import mkdirs
from spectrum.datastore import DataStore, ConfigBase, Settings, StoreError


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


class BinaryDataStore(DataStore):
    """ File-system based implementation of a data store.
    """
    INDEX = 'index'

    def __init__(self, data_path):
        super(BinaryDataStore, self).__init__(data_path)
        self.index_path = os.path.join(data_path, self.INDEX)

        # initialise index directory
        if not os.path.exists(self.index_path):
            with open(self.index_path, 'w'):
                pass

    def config(self, config_id=None):
        """ Return a Config object for the given config id.
        """
        return Config(self, config_id=config_id)

    def iter_config(self, config_ids=None):
        """ Yield stored Config objects.
        """
        def _iter_ids():
            with open(self.index_path) as f:
                for config_id in f:
                    yield config_id.strip()

        for config_id in _iter_ids() if config_ids is None else config_ids:
            config = Config(self, config_id=config_id)
            config.read()
            yield config


class Config(ConfigBase):
    """ File system implementation of Config.
    """
    WORKER_PREFIX = 'worker_'

    FORMAT = 'format'
    CONFIG = 'config'
    TIMESTAMPS = 'timestamps'
    DATA = 'data'

    SPECTRUM = 'spectrum'
    SPECTRUM_TIMES = os.path.join(SPECTRUM, TIMESTAMPS)
    SPECTRUM_DATA = os.path.join(SPECTRUM, DATA)

    TEMPERATURE = 'temperature'
    TEMPERATURE_TIMES = os.path.join(TEMPERATURE, TIMESTAMPS)
    TEMPERATURE_DATA = os.path.join(TEMPERATURE, DATA)

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

    def read(self):
        """ Read config attributes from the data store.
        """
        c_path = os.path.join(self._data_store.data_path, self.id)
        try:
            with open(os.path.join(c_path, self.CONFIG)) as f:
                self.values = json.loads(f.read())
            with open(os.path.join(c_path, self.FORMAT)) as f:
                self.timestamp = _T_STRUCT.fread(f)
                self.n_freq = _N_STRUCT.fread(f)
        except IOError as e:
            raise StoreError(str(e))
        firsts = []
        latests = []
        self.counts = {}
        for filename in os.listdir(c_path):
            if not filename.startswith(self.WORKER_PREFIX):
                continue
            worker = filename[len(self.WORKER_PREFIX):]
            w_path = os.path.join(c_path, filename)
            self.counts[worker] = 0

            for name, offset, get_n in (
                    (self.SPECTRUM_TIMES, _T_STRUCT.size, True),
                    (self.AUDIO_TIMES, _T_STRUCT.size, False),
                    (self.RDS_NAME_TIMES, _T_STRUCT.size + _N_STRUCT.size, False),
                    (self.RDS_TEXT_TIMES, _T_STRUCT.size + _N_STRUCT.size, False)
            ):
                path = os.path.join(w_path, name)
                if not os.path.exists(path):
                    continue
                with open(path) as f:
                    n_freqs = _N_STRUCT.fread(f) if get_n else None
                    firsts.append(_T_STRUCT.fread(f))
                    f.seek(-offset, os.SEEK_END)
                    latests.append(_T_STRUCT.fread(f))
                    if name == self.SPECTRUM_TIMES: #FIXME while every worker stores one spectrum per iteration, this is ok...
                        f.seek(0, os.SEEK_END)
                        pos = f.tell()
                        if get_n: pos -= _N_STRUCT.size
                        self.counts[worker] = pos / _T_STRUCT.size #FIXME this isn't working because strength is stored by hamlib worker every second during audio recording, not once per sweep
        self.first = min(firsts) if len(firsts) > 0 else None
        self.latest = max(latests) if len(latests) > 0 else None
        return self

    def write(self, timestamp=None, values=None):
        """ Write config attributes to the data store.
        """
        if values is not None:
            self.values = values
        self.id = str(timestamp)
        path = os.path.join(self._data_store.data_path, self.id)
        try:
            os.mkdir(path)
        except OSError:
            pass
        with open(self._data_store.index_path, 'a') as f:
            f.write(self.id)
            f.write('\n')
        with open(os.path.join(path, self.CONFIG), 'w') as f:
            f.write(json.dumps(self.values))
        with open(os.path.join(path, self.FORMAT), 'w') as f:
            _T_STRUCT.fwrite(f, timestamp)
        return self

    def delete(self):
        """ Delete the config and all associated data from the data store.
        """
        _tmp = '{0}_tmp'.format(self._data_store.index_path)
        with open(self._data_store.index_path) as f_index, open(_tmp, 'w') as f_tmp:
            for config_id in f_index:
                config_id = config_id.strip()
                if config_id == self.id:
                    continue
                f_tmp.write(config_id)
                f_tmp.write('\n')
        os.rename(_tmp, self._data_store.index_path)
        shutil.rmtree(os.path.join(self._data_store.data_path, self.id))
        self._delete_audio()
        self.id = None # render config object useless (id no longer valid)

    def _worker_path(self, worker, mkdir=True):
        path = os.path.join(self._data_store.data_path, self.id, 'worker_' + worker)
        if mkdir:
            try:
                os.mkdir(path)
            except OSError:
                pass
        return path

    def _iter_data(self, worker, format_file, data_file, start, end, store_n=False):
        seek = False
        path = self._worker_path(worker, False)
        f_path = os.path.join(path, format_file)
        d_path = os.path.join(path, data_file)
        if not os.path.exists(f_path) or not os.path.exists(d_path):
            return
        with open(f_path, 'r') as f_f, open(d_path, 'r') as f_d:
            if store_n:
                n_freq = _N_STRUCT.fread(f_f)
                _struct = _Struct('{0}b'.format(n_freq), True)
            else:
                _struct = _N_STRUCT
            while True:
                timestamp = _T_STRUCT.fread(f_f)
                if timestamp is None or (end is not None and timestamp > end):
                    return
                if not seek:
                    if start is not None and timestamp <= start:
                        continue
                    pos = f_f.tell()
                    if store_n:
                        pos -= _N_STRUCT.size
                    f_d.seek(_struct.size * (pos / _T_STRUCT.size - 1))
                    seek = True
                yield timestamp, _struct.fread(f_d)

    def _write_data(self, worker, format_file, data_file, timestamp, data, store_n=False):
        path = self._worker_path(worker)
        if store_n:
            n_freq = len(data)
            _struct = _Struct('{0}b'.format(n_freq), True)
        else:
            n_freq = None
            _struct = _N_STRUCT
        format_path = os.path.join(path, format_file)
        if os.path.exists(format_path):
            n_freq = None # if we already wrote n_freq, don't do it again
        else:
            mkdirs(format_path)
        with open(format_path, 'a') as f:
            if n_freq is not None:
                _N_STRUCT.fwrite(f, n_freq)
            _T_STRUCT.fwrite(f, timestamp)
        with open(os.path.join(path, data_file), 'a') as f:
            _struct.fwrite(f, data)

    def _iter_freq_data(self, worker, times_file, data_file, start=None, end=None):
        timestamp0, offset0 = None, None
        path = self._worker_path(worker, False)
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
                if start is not None and timestamp <= start:
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

    def _write_freq_data(self, worker, times_file, data_file, timestamp, freq_n, data):
        path = self._worker_path(worker)
        t_path = os.path.join(path, times_file)
        mkdirs(t_path)
        d_path = os.path.join(path, data_file)
        mkdirs(d_path)
        with open(t_path, 'a') as f_t, open(d_path, 'a') as f_d:
            _T_STRUCT.fwrite(f_t, timestamp)
            _N_STRUCT.fwrite(f_t, f_d.tell())
            _N_STRUCT.fwrite(f_d, freq_n)
            f_d.write(data)

    def iter_spectrum(self, worker, start=None, end=None):
        """ Yield (timestamp, strengths) for each spectrum sweep in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_data(worker, self.SPECTRUM_TIMES, self.SPECTRUM_DATA, start, end, True):
            yield _

    def write_spectrum(self, worker, timestamp, strengths):
        """ Write spectrum strengths found at the given timestamp by the specified worker.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_data(worker, self.SPECTRUM_TIMES, self.SPECTRUM_DATA, timestamp, strengths, True)

    def iter_audio(self, worker, start=None, end=None):
        """ Yield (timestamp, freq_n) for stored audio samples in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_data(worker, self.AUDIO_TIMES, self.AUDIO_DATA, start, end):
            yield _

    def write_audio(self, worker, timestamp, freq_n):
        """ Write freq_n and timestamp for an audio sample.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_data(worker, self.AUDIO_TIMES, self.AUDIO_DATA, timestamp, freq_n)
        path = self.audio_path(worker, timestamp, freq_n)
        mkdirs(path)
        return path

    def iter_rds_name(self, worker, start=None, end=None):
        """ Yield (timestamp, freq_n, name) for RDS names in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_freq_data(worker, self.RDS_NAME_TIMES, self.RDS_NAME_DATA, start, end):
            yield _

    def write_rds_name(self, worker, timestamp, freq_n, name):
        """ Write freq_n and timestamp for an RDS name.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(worker, self.RDS_NAME_TIMES, self.RDS_NAME_DATA, timestamp, freq_n, name)

    def iter_rds_text(self, worker, start=None, end=None):
        """ Yield (timestamp, freq_n, text) for RDS text in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for _ in self._iter_freq_data(worker, self.RDS_TEXT_TIMES, self.RDS_TEXT_DATA, start, end):
            yield _

    def write_rds_text(self, worker, timestamp, freq_n, text):
        """ Write freq_n, timestamp and text for RDS text in the range (or all).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(worker, self.RDS_TEXT_TIMES, self.RDS_TEXT_DATA, timestamp, freq_n, text)

    def iter_temperature(self, worker, start=None, end=None):
        """ Yield (timestamp, temperature).
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for timestamp, _, temperature in self._iter_freq_data(worker, self.TEMPERATURE_TIMES, self.TEMPERATURE_DATA, start, end):
            yield timestamp, temperature

    def write_temperature(self, worker, timestamp, temperature):
        """ Write temperature at the given timestamp.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(worker, self.TEMPERATURE_TIMES, self.TEMPERATURE_DATA, timestamp, 0, temperature)

    def iter_error(self, worker):
        """ Yield (timestamp, error) for all errors.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        for timestamp, _, error in self._iter_freq_data(worker, self.ERROR_TIMES, self.ERROR_DATA):
            yield timestamp, error

    def write_error(self, worker, timestamp, error):
        """ Write an error at the given timestamp.
        """
        if self.values is None:
            raise StoreError("Uninitialised config (call read or write)")
        self._write_freq_data(worker, self.ERROR_TIMES, self.ERROR_DATA, timestamp, 0, str(error))


if __name__ == '__main__':
    import sys
    from spectrum.config import DATA_PATH

    if len(sys.argv) < 2:
        print >>sys.stderr, "Usage: python {0} config_id".format(*sys.argv)
        sys.exit(1)

    data = BinaryDatastore(DATA_PATH)
    config = data.config(sys.argv[1]).read()
    for t0, levels in config.iter_spectrum():
        print t0, len(levels)
