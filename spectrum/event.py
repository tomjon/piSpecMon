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
        timestamp = json.get('timestamp', 0)
        for config in self.data_store.iter_config(timestamp=timestamp):
            data = dumps(config.get_json(start=timestamp))
            rdevice.upload(data, 'application/json', t0)

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
        rdevice.main(rdevice.sleep_timer(), upload=self.upload)


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
