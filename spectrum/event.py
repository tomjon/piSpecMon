""" Module providing PSM event queue manager and client.
"""
import time
import json
import requests
import httplib
from spectrum.common import log, now


class EventManager(object):
    """ PSM event manager.
    """
    def __init__(self, psm_name, queue, poll_secs, overseer_url=None, overseer_key=None): #FIXME exposes weakness of this design - want client separate
        self.data = {'name': psm_name, 'key': overseer_key}
        self.queue = queue
        self.poll_secs = poll_secs
        self.overseer_url = overseer_url

    def write_event(self, event_type, event_data):
        """ Write an event to the queue.
        """
        t = now()
        event = {'type': event_type, 'timestamp': t}
        event['data'] = json.dumps(event_data)
        self.queue.write(str(t), json.dumps(event))

    def _send_post(self, endpoint, payload=None):
        """ Send a POST to the Overseer.
        """
        headers = {'content-type': 'application/x-www-form-urlencoded'}
        if payload is not None:
            self.data['json'] = json.dumps(payload)
        else:
            self.data.pop('json', None)
        try:
            url = '{0}/{1}'.format(self.overseer_url, endpoint)
            r = requests.post(url, headers=headers, data=self.data)
            if r.status_code != httplib.OK:
                log.error("Could not POST to overseer - HTTP status %s", r.status_code)
            return r.status_code == httplib.OK
        except requests.exceptions.RequestException as e:
            log.error("Could not POST to overseer: %s", e)
            return None

    def run(self):
        """ Poll the queue directory for events, indefinitely, and POST them to the overseer.
        
            Also, send a heartbeat every time we poll. FIXME: might want to separate these?)
        """
        while True:
            self._send_post('heartbeat')

            log.info("Checking for messages...")
            for message_id, message_text in self.queue.iter_messages():
                event = json.loads(message_text)
                event['delivered'] = now()
                r = self._send_post('event', event)
                if r is not None:
                    self.queue.consume(message_id)
                if r is True:
                    log.info("Delivered event {0}".format(message_id))
                elif r is False:
                    log.warn("Could not deliver event {0}".format(message_id))
            time.sleep(self.poll_secs)
