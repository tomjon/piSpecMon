""" Common data store definitions.
"""
import os
import shutil
from spectrum.common import log


class StoreError(Exception):
    """ Exception specific to data store implementations.
    """
    def __init__(self, message):
        super(StoreError, self).__init__()
        log.error(message)
        self.message = message


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

    def audio_path(self, timestamp, freq_n):
        """ Return a (base) path at which an audio sample is stored.
        """
        return os.path.join(self._data_store.samples_path, self.id, str(freq_n), str(timestamp))

    def _delete_audio(self):
        """ Delete all audio samples stored for the config.
        """
        samples_path = os.path.join(self._data_store.samples_path, self.id)
        if os.path.isdir(samples_path):
            shutil.rmtree(samples_path)


class SettingsBase(object): # pylint: disable=too-few-public-methods
    """ Class for managing settings id and value.
    """
    def __init__(self, data_store, settings_id=None, values=None):
        self._data_store = data_store
        self.id = settings_id
        self.values = values