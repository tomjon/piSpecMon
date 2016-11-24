""" Define an OverseerApplication that will be used to provide endpoints.
"""
import json
from flask import Flask, request
from spectrum.common import log, now


OVERSEER_KEY = 'overseer'

class OverseerApplication(Flask):
    """ The curious looking two-step initialisation is so that the application instance can
        be created at import time for the decorators to work.

        None of the methods on this class form part of the module API. The web endpoints are
        the module API.
    """
    def __init__(self, name):
        super(OverseerApplication, self).__init__(name)
        self._init_logging()

    def initialise(self, data={}):
        """ Finish initialising the application.
        """
        self.data = data #FIXME this will become something that serialises itself

    def _init_logging(self): #FIXME duplicated from webapp.py
        # add log handlers to Flask's logger for when Werkzeug isn't the underlying WSGI server
        for handler in log.handlers:
            self.logger.addHandler(handler)

application = OverseerApplication(__name__) # pylint: disable=invalid-name


@application.route('/event', methods=['POST'])
def event_endpoint():
    """ Endpoint for PSM units to notify events.
    
        The PSM must supply the following form fields in the request body:
        
            name - the name of the PSM box, e.g. PSM17
            key  - overseer key for authorisation
            json - JSON event body
    """
    # validate form parameters
    name = request.form['name'].strip()
    if len(name) == 0:
        return "Bad PSM name", 400

    if request.form['key'] != OVERSEER_KEY:
        return "Bad overseer key", 403

    event = json.loads(request.form['json'])
    if not isinstance(event, dict):
        return "Bad event", 400
    if 'type' not in event:
        return "Event missing type", 400
    if 'timestamp' not in event:
        return "Event missing timestamp", 400
    if 'delivered' not in event:
        return "Event missing delivered", 400

    # process and store the event
    if name not in application.data:
        application.data[name] = []
    event['received'] = now()
    application.data[name].append(event)

    return json.dumps({})


@application.route('/')
def main_endpoint():
    """ Endpoint that returns events for each known PSM.
    """
    return json.dumps(application.data)
