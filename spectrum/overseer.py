""" Define an OverseerApplication that will be used to provide endpoints.
"""
import json
from flask import Flask, request
from spectrum.common import log, now
from spectrum.users import IncorrectPasswordError

#FIXME need to use a SecuredStaticFlask because again need admin/data roles; admin can set up keys

class OverseerApplication(Flask):
    """ The curious looking two-step initialisation is so that the application instance can
        be created at import time for the decorators to work.

        None of the methods on this class form part of the module API. The web endpoints are
        the module API.
    """
    def __init__(self, name):
        super(OverseerApplication, self).__init__(name, static_folder='overseer_ui', static_url_path='/static')
        self._init_logging()

    def initialise(self, data, psm_users):
        """ Finish initialising the application.
        """
        self.psm_users = psm_users
        self.data = data

    def validate_psm(self):
        psm_name = request.form['name'].strip()
        if len(psm_name) == 0:
            return "Bad PSM name", 400
        try:
            self.psm_users.check_user(psm_name, request.form['key'])
        except IncorrectPasswordError:
            return "Bad overseer key", 403
        return (psm_name,)

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
    r = application.validate_psm()
    if len(r) > 1:
        return r
    else:
        psm_name = r[0]

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
    event['received'] = now()
    application.data.write_event(psm_name, event)

    return json.dumps({})


@application.route('/heartbeat', methods=['POST'])
def heartbeat_endpoint():
    """ Endpoint for PSM units to send a heartbeat.
    
        The PSM must supply the following form fields in the request body:
        
            name - the name of the PSM box, e.g. PSM17
            key  - overseer key for authorisation
    """
    r = application.validate_psm()
    if len(r) > 1:
        return r
    else:
        psm_name = r[0]

    application.data.write_heartbeat(psm_name, now())
    return json.dumps({})


@application.route('/')
def main_endpoint():
    """ Endpoint that returns events for each known PSM.
    """
    data = {}
    for psm_name, heartbeat in application.data.iter_psm():
        data[psm_name] = {'heartbeat': heartbeat}
        data[psm_name]['events'] = list(application.data.iter_events(psm_name))
    return json.dumps(data)
