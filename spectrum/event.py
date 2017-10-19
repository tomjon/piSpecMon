""" Module providing PSM event queue manager and client.
"""
import time
from json import dumps
import httplib
import requests
from spectrum.common import log, now

try:
    from ses_rdevice import rdevice
except ImportError:
    rdevice = None

# event types
EVENT_INIT = 'init'
EVENT_IDENT = 'ident'
EVENT_LOGIN = 'login'
EVENT_LOGOUT = 'logout'
EVENT_START = 'start'
EVENT_STOP = 'stop'


class EventManager(object):
    """ PSM event manager - this is an RDevice implementation.
    """
    def __init__(self, data_store, queue):
        self.data_store = data_store
        self.queue = queue

    def upload(self, t0, json):
        """ Upload data since the specified date.
        """
        timestamp = int(json.get('timestamp', 0)) * 1000
        for config in self.data_store.iter_config(timestamp=timestamp):
            data = config.get_json(start=timestamp)

            count = sum(sum(len(data[w][k]) for k in data[w]) for w in data)
            if count == 0: continue

            #FIXME store the sample file path in the Overseer for ease of recall - this will go when data not stored against config
            for worker in data:
                samples = []
                for t, freq_n in data[worker]['audio']:
                    sample = {'timestamp': t, 'freq_n': freq_n}
                    sample['path'] = config.rel_audio_path(worker, t, freq_n)
                    samples.append(sample)
                data[worker]['audio'] = samples

            rdevice.upload(dumps(data), 'application/json', t0)

    def file(self, t0, json):
        """ Send a requested file to the Overseer. Relative path (less extension)
            is specified, and list of accepted file types (extensions).

            FIXME for now we assume this is an audio sample, so the path is relative to the samples path
        """
        relpath = json.get('path', None)
        extensions = json.get('allow', None)
        if relpath is None or extensions is None:
            return
        path, ext = self.data_store.find_audio_file(relpath, extensions)
        if path is not None:
            with open(path) as f:
                #FIXME no streaming, no nothing
                rdevice.upload(f.read(), 'audio/{0}'.format(ext), t0, headers={'X-Path': relpath})

    def run(self):
        """ Run the RDevice service.
        """
#            log.info("Checking for messages...")
#            for message_id, message_text in self.queue.iter_messages():
#                event = json.loads(message_text)
#                event['delivered'] = now()
#                r = self._send_post('event', event)
#                if r is not None:
#                    self.queue.consume(message_id)
#                if r is True:
#                    log.info("Delivered event %s", message_id)
#                elif r is False:
#                    log.warn("Could not deliver event %s", message_id)
        if rdevice is None:
            log.error("No rdevice support")
            return
        rdevice.main(rdevice.sleep_timer(), upload=self.upload, file=self.file)


class EventClient(object):
    """ PSM event client.
    """
    def __init__(self, queue):
        self.queue = queue

    def write(self, event_type, event_data):
        """ Write an event to the queue.
        """
        timestamp = now()
        event = {'type': event_type, 'timestamp': timestamp}
        event['data'] = dumps(event_data)
        self.queue.write(str(timestamp), dumps(event))
