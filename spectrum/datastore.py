""" Common data store definitions.
"""
import os
from config import SAMPLES_PATH
from common import log


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
    def __init__(self, config_id=None, values=None, timestamp=None, \
                       first=None, latest=None, count=None):
        self.id = config_id
        self.values = values
        self.timestamp = timestamp
        self.first = first
        self.latest = latest
        self.count = count

    def audio_path(self, timestamp, freq_n):
        """ Return a (base) path at which an audio sample is stored.
        """
        return os.path.join(SAMPLES_PATH, self.id, str(freq_n), str(timestamp))


class SettingsBase(object): # pylint: disable=too-few-public-methods
    """ Class for managing settings id and value.
    """
    def __init__(self, settings_id=None, values=None):
        self.id = settings_id
        self.values = values
