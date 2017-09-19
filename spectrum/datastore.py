""" Common data store definitions.
"""
import os
import shutil
import json
from spectrum.common import log, fs_size, fs_free


class StoreError(Exception):
    """ Exception specific to data store implementations.
    """
    def __init__(self, message):
        super(StoreError, self).__init__()
        log.error(message)
        self.message = message


class DataStore(object):
    def __init__(self, data_path):
        self.data_path = os.path.join(data_path, 'data')
        self.settings_path = os.path.join(data_path, 'settings')
        self.samples_path = os.path.join(data_path, 'samples')

        # initialise directories
        if not os.path.exists(self.data_path):
            os.mkdir(self.data_path)
        if not os.path.exists(self.settings_path):
            os.mkdir(self.settings_path)

    def settings(self, settings_id=None):
        """ Return a Settings object for the given settings id.
        """
        return Settings(self, settings_id=settings_id)

    def stats(self):
        """ Return a dictionary of usage statistics name/values.
        """
        return {
            'audio': fs_size(self.samples_path),
            'size': fs_size(self.data_path),
            'free': fs_free(self.data_path)
        }


class ConfigBase(object):
    """ Class for managing config id, timestamp, values, first and last sweep times,
        and sweep count.
    """
    def __init__(self, data_store,
                 config_id=None, values=None, timestamp=None,
                 first=None, latest=None, count=None):
        self._data_store = data_store
        self.id = config_id
        self.values = values
        self.timestamp = timestamp
        self.first = first
        self.latest = latest
        self.count = count

    def audio_path(self, worker, timestamp, freq_n):
        """ Return a (base) path at which an audio sample is stored.
        """
        return os.path.join(self._data_store.samples_path, self.id, worker, str(freq_n), str(timestamp))

    def _delete_audio(self):
        """ Delete all audio samples stored for the config.
        """
        samples_path = os.path.join(self._data_store.samples_path, self.id)
        if os.path.isdir(samples_path):
            shutil.rmtree(samples_path)


class Settings(object): # pylint: disable=too-few-public-methods
    """ Class for managing settings id and value.
    """
    def __init__(self, data_store, settings_id=None, values=None):
        self._data_store = data_store
        self.id = settings_id
        self.values = values
        self.path = os.path.join(data_store.settings_path, self.id)

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
