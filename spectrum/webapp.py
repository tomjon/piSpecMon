""" Define a WebApplication that will be used by server.py to provide endpoints.
"""
import os
from spectrum.event import EVENT_INIT
from spectrum.common import log, psm_name
from spectrum.secure import SecureStaticFlask
from spectrum.config import VERSION_FILE, DEFAULT_AUDIO_SETTINGS, DEFAULT_AMS_SETTINGS, DEFAULT_RDS_SETTINGS, DEFAULT_SDR_SETTINGS, DEFAULT_HAMLIB_SETTINGS, DEFAULT_RIG_SETTINGS

class WebApplication(SecureStaticFlask): # pylint: disable=too-many-instance-attributes
    """ The curious looking two-step initialisation is so that the application instance can
        be created at import time for the decorators to work.

        None of the methods on this class form part of the module API. The web endpoints are
        the module API.
    """
    def __init__(self, name):
        super(WebApplication, self).__init__(name, 'ui/dist')

    def initialise(self, data_store, users, clients, event_client):
        """ Finish initialising the application.
        """
        # pylint: disable=attribute-defined-outside-init
        self.data_store = data_store
        super(WebApplication, self).initialise(users)
        #FIXME these need rationalising
        self.audio = self.data_store.settings('audio').read(DEFAULT_AUDIO_SETTINGS)
        self.ams = self.data_store.settings('ams').read(DEFAULT_AMS_SETTINGS)
        self.rds = self.data_store.settings('rds').read(DEFAULT_RDS_SETTINGS)
        self.sdr = self.data_store.settings('sdr').read(DEFAULT_SDR_SETTINGS)
        self.hamlib = self.data_store.settings('hamlib').read(DEFAULT_HAMLIB_SETTINGS)
        self.rig = self.data_store.settings('rig').read(DEFAULT_RIG_SETTINGS)
        self.description = self.data_store.settings('description').read('')
        self.clients = clients
        self.event_client = event_client
        self._init_ident()

    def _init_ident(self):
        # pylint: disable=attribute-defined-outside-init
        self.ident = {'name': psm_name()}
        with open(os.path.join(self.root_path, VERSION_FILE)) as f:
            self.ident['version'] = f.read().strip()
        self.ident['description'] = self.description.values
        self.event_client.write(EVENT_INIT, self.ident)

    def set_ident(self, ident):
        """ Set identification information about the PSM unit.
        """
        if self.user_has_role(['admin', 'freq']) and 'description' in ident:
            self.ident['description'] = ident['description']
            self.description.write(ident['description'])

    def find_audio_path(self, config_id, worker, freq_n, timestamp):
        base = self.data_store.config(config_id).audio_path(worker, timestamp, freq_n)
        for ext in ['mp3', 'ogg', 'wav']:
            path = '{0}.{1}'.format(base, ext)
            if os.path.isfile(path):
                return path
        return None
