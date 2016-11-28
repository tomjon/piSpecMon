""" File based Overseer data store implementation.
"""
import os
import json

class OverseerData(object):
    def __init__(self, data_dir):
        self.data_dir = data_dir

    def _psm_path(self, psm_name):
        _psm_path = os.path.join(self.data_dir, psm_name)
        if not os.path.exists(_psm_path):
            os.makedirs(_psm_path)
        return _psm_path

    def write_heartbeat(self, psm_name, timestamp):
        path = os.path.join(self._psm_path(psm_name), 'heartbeat')
        with open(path, 'w') as f:
            f.write(str(timestamp))

    def iter_psm(self):
        for psm_name in os.listdir(self.data_dir):
            path = os.path.join(self.data_dir, psm_name, 'heartbeat')
            if not os.path.exists(path):
                yield psn_name, None
            with open(path) as f:
                yield psm_name, f.read()

    def write_event(self, psm_name, event):
        # will use timestamp as filename, this may overwrite an existing event for the same timestamp
        event_type = event['type']
        timestamp = event['timestamp']
        path = os.path.join(self._psm_path(psm_name), 'events')
        if not os.path.exists(path):
            os.makedirs(path)
        with open(os.path.join(path, str(timestamp)), 'w') as f:
            f.write(json.dumps(event))

    def iter_events(self, psm_name):
        path = os.path.join(self._psm_path(psm_name), 'events')
        if not os.path.exists(path):
            os.makedirs(path)
        for timestamp in os.listdir(path):
            with open(os.path.join(path, str(timestamp))) as f:
                yield json.loads(f.read())
