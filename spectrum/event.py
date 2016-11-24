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
    def __init__(self, psm_name, queue, poll_secs, overseer_url):
        self.psm_name = psm_name
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

    def run(self):
        """ Poll the queue directory for events, indefinitely, and POST them to the overseer.
        """
        while True:
            log.info("Checking for messages...")
            for message_id, message_text in self.queue.iter_messages():
                event = json.loads(message_text)
                event['delivered'] = now()
                data = {'name': self.psm_name, 'key': 'overseer', 'json': json.dumps(event)}
                log.debug(data)
                headers = {'content-type': 'application/x-www-form-urlencoded'}
                r = requests.post(self.overseer_url, headers=headers, data=data)
                if r.status_code != httplib.OK:
                    log.error("Could not deliver event {0}".format(message_id))
                else:
                    log.info("Delivered event {0}".format(message_id))
            time.sleep(self.poll_secs)
