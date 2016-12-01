""" Define an OverseerApplication that will be used to provide endpoints.
"""
import json
import os
from flask import Flask, request, redirect, send_file
from flask_login import current_user
from spectrum.common import log, now
from spectrum.secure import SecureStaticFlask
from spectrum.users import IncorrectPasswordError

class RestApiError(Exception):
    def __init__(self, message, status_code):
        self.message = message
        self.status_code = status_code

class OverseerApplication(SecureStaticFlask):
    """ The curious looking two-step initialisation is so that the application instance can
        be created at import time for the decorators to work.

        None of the methods on this class form part of the module API. The web endpoints are
        the module API.
    """
    def __init__(self, name):
        super(OverseerApplication, self).__init__(name, 'overseer_ui')

    def initialise(self, data, users, psm_users):
        """ Finish initialising the application.
        """
        self.data = data
        super(OverseerApplication, self).initialise(users)
        self.psm_users = psm_users

    def validate_psm(self):
        psm_name = request.form['name'].strip()
        if len(psm_name) == 0:
            raise RestApiError("Bad PSM name", 400)
        try:
            self.psm_users.check_user(psm_name, request.form['key'])
        except IncorrectPasswordError:
            raise RestApiError("Bad overseer key", 403)
        return psm_name

application = OverseerApplication(__name__) # pylint: disable=invalid-name

@application.errorhandler(RestApiError)
def handle_rest_api_error(error):
    return error.message, error.status_code


@application.route('/', methods=['GET', 'POST'])
def main_endpoint():
    """ Redirect / to index or login page.
    """
    if current_user is not None and not current_user.is_anonymous and current_user.is_authenticated:
        return redirect("/static/index.html")
    else:
        return redirect("/static/login.html")


@application.route('/favicon.ico')
def favicon_endpoint():
    """ Serve a favicon.
    """
    path = os.path.join(application.root_path, 'psm_ui', 'favicon.ico') # FIXME shared code and shared resource...
    return send_file(path, mimetype='image/vnd.microsoft.icon')


@application.route('/login', methods=['GET', 'POST'])
def login_endpoint():
    """ Log in endpoint.
    """
    if request.method == 'POST':
        user = application.login()
    return redirect('/')

@application.route('/logout')
@application.role_required(['admin', 'freq', 'data'])
def logout_endpoint():
    """ Logout endpoint.
    """
    application.logout()
    return redirect('/')


@application.route('/event', methods=['POST'])
def event_endpoint():
    """ Endpoint for PSM units to notify events.
    
        The PSM must supply the following form fields in the request body:
        
            name - the name of the PSM box, e.g. PSM17
            key  - overseer key for authorisation
            json - JSON event body
    """
    psm_name = application.validate_psm()
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
    psm_name = application.validate_psm()
    application.data.write_heartbeat(psm_name, now())
    return json.dumps({})


@application.route('/data')
@application.role_required(['admin'])
def data_endpoint():
    """ Endpoint that returns events for each known PSM.
    """
    data = []
    for psm_name, heartbeat in application.data.iter_psm():
        psm_data = {'name': psm_name, 'heartbeat': heartbeat}
        psm_data['events'] = list(application.data.iter_events(psm_name))
        data.append(psm_data)
    return json.dumps(data)
