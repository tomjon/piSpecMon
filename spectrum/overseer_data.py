""" File based Overseer data store implementation.
"""
import os
import json

class OverseerData(object):
    """ Class for serialising events and heartbeats.
    """
    def __init__(self, data_dir):
        self.data_dir = data_dir

    def _psm_path(self, psm_name):
        _psm_path = os.path.join(self.data_dir, psm_name)
        if not os.path.exists(_psm_path):
            os.makedirs(_psm_path)
        return _psm_path

    def write_heartbeat(self, psm_name, timestamp):
        """ Serialise a heartbeat to the filesystem.
        """
        path = os.path.join(self._psm_path(psm_name), 'heartbeat')
        with open(path, 'w') as f:
            f.write(str(timestamp))

    def iter_psm(self):
        """ Yield known PSM data, in the form of tuples (PSM name, last
            heartbeat timestamp).
        """
        for psm_name in os.listdir(self.data_dir):
            path = os.path.join(self.data_dir, psm_name, 'heartbeat')
            if not os.path.exists(path):
                yield psm_name, None
                continue
            with open(path) as f:
                yield psm_name, f.read()

    def write_event(self, psm_name, event):
        """ Serialise a PSM event to the filesytem.
        """
        # FIXME: will use timestamp as filename, this may overwrite an existing
        # event for the same timestamp
        timestamp = event['timestamp']
        path = os.path.join(self._psm_path(psm_name), 'events')
        if not os.path.exists(path):
            os.makedirs(path)
        with open(os.path.join(path, str(timestamp)), 'w') as f:
            f.write(json.dumps(event))

    def iter_events(self, psm_name):
        """ Yield events for the specified PSM (as dictionaries).
        """
        path = os.path.join(self._psm_path(psm_name), 'events')
        if not os.path.exists(path):
            os.makedirs(path)
        for timestamp in os.listdir(path):
            with open(os.path.join(path, str(timestamp))) as f:
                yield json.loads(f.read())
