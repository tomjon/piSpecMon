""" Flask server for the Server API.
"""
import json
import os
import re
import mimetypes
import functools
from time import time
from datetime import datetime
from slugify import slugify
from flask import Flask, current_app, redirect, request, Response, send_file
from flask_login import LoginManager, login_user, login_required, current_user, logout_user
from spectrum.tail import iter_tail
from spectrum.monitor import get_capabilities
from spectrum.datastore import StoreError
from spectrum.config import DEFAULT_RIG_SETTINGS, DEFAULT_AUDIO_SETTINGS, DEFAULT_RDS_SETTINGS, \
                            DEFAULT_SCAN_SETTINGS, LOG_PATH, VERSION_FILE, USER_TIMEOUT_SECS, \
                            EXPORT_DIRECTORY, PI_CONTROL_PATH
from spectrum.common import log, now, parse_config, scan
from spectrum.users import IncorrectPasswordError, UsersError

class SecuredStaticFlask(Flask): # pylint: disable=too-many-instance-attributes
    """ Sub-class Flask to secure static files.

        The curious looking two-step initialisation is so that the application instance can
        be created at import time for the decorators to work.

        None of the methods on this class form part of the module API. The web endpoints are
        the module API.
    """
    def __init__(self, name):
        super(SecuredStaticFlask, self).__init__(name)
        self._init_logging()
        LoginManager().init_app(self)

    def initialise(self, data_store, users, worker_client, monkey_client):
        """ Finish initialising the application.
        """
        # pylint: disable=attribute-defined-outside-init
        self.secret_key = os.urandom(24)
        self.logged_in_users = []
        self.request_times = {}
        self.before_request(self.check_user_timeout)
        self.caps = get_capabilities()
        log.info("%d rig models", len(self.caps['models']))
        self.data_store = data_store
        self.users = users
        self.rig = self.data_store.settings('rig').read(DEFAULT_RIG_SETTINGS)
        self.audio = self.data_store.settings('audio').read(DEFAULT_AUDIO_SETTINGS)
        self.rds = self.data_store.settings('rds').read(DEFAULT_RDS_SETTINGS)
        self.scan = self.data_store.settings('scan').read(DEFAULT_SCAN_SETTINGS)
        self.description = self.data_store.settings('description').read('')
        self.worker = worker_client
        self.monkey = monkey_client

    def _init_logging(self):
        # add log handlers to Flask's logger for when Werkzeug isn't the underlying WSGI server
        for handler in log.handlers:
            self.logger.addHandler(handler)

    def send_static_file(self, filename):
        """ Send a static file (overriding Flask's version).
        """
        logged_in = current_user is not None and \
                    not current_user.is_anonymous and \
                    current_user.is_authenticated
        if filename == 'login.html' or logged_in:
            return super(SecuredStaticFlask, self).send_static_file(filename)
        else:
            return redirect('/')

    def check_user_timeout(self):
        """ Check for user timeout since last request.
        """
        # check for user timeouts
        for name in self.logged_in_users:
            if not self.debug and time() > self.request_times[name] + USER_TIMEOUT_SECS:
                self.logged_in_users.remove(name)
        # check whether current user has been logged out?
        if not hasattr(current_user, 'name'):
            return None
        if current_user.name not in self.logged_in_users:
            logout_user()
            return "User session timed out", 403
        return None

    def get_ident(self):
        """ Get identification information about the PSM unit.
        """
        ident = {}

        path = os.path.join(self.root_path, VERSION_FILE)
        with open(path) as f:
            ident['version'] = f.read()

        ident['name'] = os.popen('uname -n').read()
        ident['description'] = self.description.values
        return ident

    def set_ident(self, ident):
        """ Set identification information about the PSM unit.
        """
        if user_has_role(['admin', 'freq']) and 'description' in ident:
            self.description.write(ident['description'])

application = SecuredStaticFlask(__name__) # pylint: disable=invalid-name

@application.after_request
def after_request(response):
    """ Have Flask do this to the response for every request.
    """
    response.headers.add('Accept-Ranges', 'bytes')
    return response

def send_file_partial(path):
    """ See http://blog.asgaard.co.uk/2012/08/03/http-206-partial-content-for-flask-python

        We need this for supporting media files with Safari (at least).
    """
    range_header = request.headers.get('Range', None)
    if not range_header:
        return send_file(path)

    byte1, byte2 = 0, None

    groups = re.search(r'(\d+)-(\d*)', range_header).groups()

    if groups[0]:
        byte1 = int(groups[0])
    if groups[1]:
        byte2 = int(groups[1])

    if byte2 is None:
        return send_file(path)

    path = os.path.join(current_app.root_path, path)
    size = os.path.getsize(path)

    length = size - byte1 + 1
    if byte2 is not None:
        length = byte2 - byte1 + 1

    data = None
    with open(path, 'rb') as f:
        f.seek(byte1)
        data = f.read(length)

    res = Response(data, 206, mimetype=mimetypes.guess_type(path)[0], direct_passthrough=True)
    res.headers.add('Content-Range', 'bytes {0}-{1}/{2}'.format(byte1, byte1 + length - 1, size))
    return res


class User(object):
    """ User session class for flask-login.
    """
    def __init__(self, username, data):
        self.name = username
        self.data = data
        self.is_authenticated = True
        self.is_active = True
        self.is_anonymous = False

    def get_id(self):
        """ Get the user id (we use the user name).
        """
        return self.name

@application.login_manager.user_loader
def load_user(username, password=None):
    """ User loader for flask-login.
    """
    if password is not None:
        user = User(username, application.users.check_user(username, password))
    else:
        if username not in application.logged_in_users:
            return None # log out this user, who was logged in before server restart
        user = User(username, application.users.get_user(username))
    if user.data['role'] != 'data':
        for name in application.logged_in_users:
            if name == user.name:
                break
            data = application.users.get_user(name)
            if data['role'] != 'data':
                user.data['role'] = 'data'
                user.data['superior'] = data
                break
    return user

def user_has_role(roles):
    """ Return whether the user has one of the specified list of roles.
    """
    return hasattr(current_user, 'data') and current_user.data['role'] in roles

def role_required(roles):
    """ Define a decorator for specifying which roles can access which endpoints.
    """
    def _role_decorator(func):
        @functools.wraps(func)
        def _decorated_view(*args, **kwargs):
            if hasattr(current_user, 'name'):
                application.request_times[current_user.name] = time()
            if user_has_role(roles):
                return login_required(func)(*args, **kwargs)
            return application.login_manager.unauthorized() # pylint: disable=no-member
        return _decorated_view
    return _role_decorator


@application.route('/', methods=['GET', 'POST'])
def main():
    """ Redirect / to index or login page.
    """
    if current_user is not None and not current_user.is_anonymous and current_user.is_authenticated:
        return redirect("/static/index.html")
    else:
        return redirect("/static/login.html")


@application.route('/favicon.ico')
def favicon():
    """ Serve a favicon.
    """
    path = os.path.join(application.root_path, 'static', 'favicon.ico')
    return send_file(path, mimetype='image/vnd.microsoft.icon')


# id: name, version and description
@application.route('/ident', methods=['GET', 'PUT'])
@role_required(['admin', 'freq', 'data'])
def ident_endpoint():
    """ Serve or set the ident.
    """
    if request.method == 'GET':
        return json.dumps(application.get_ident())
    else:
        application.set_ident(request.get_json())
        return json.dumps({})


# rig capabilities API
@application.route('/caps')
@role_required(['admin', 'freq', 'data'])
def caps():
    """ Serve rig capabilities JSON.
    """
    return json.dumps(application.caps)


@application.route('/rig', methods=['GET', 'PUT'])
@application.route('/audio', methods=['GET', 'PUT'])
@application.route('/rds', methods=['GET', 'PUT'])
@application.route('/scan', methods=['GET', 'PUT'])
@role_required(['admin', 'freq'])
def settings():
    """ Settings API: endpoints for serving and putting settings.
    """
    rule = request.url_rule.rule[1:]
    if request.method == 'GET':
        return json.dumps(getattr(application, rule).values)
    elif request.method == 'PUT':
        getattr(application, rule).write(request.get_json())
        return json.dumps({})


@application.route('/monitor', methods=['GET', 'PUT', 'DELETE'])
@role_required(['admin', 'freq', 'data'])
def monitor():
    """ Monitor API.

        GET /monitor - return process status
        PUT /monitor - start process with supplied config as request body
        DELETE /monitor - stop process
    """
    if request.method == 'PUT':
        if 'config_id' in application.worker.status():
            return "Worker already running", 400
        if 'config_id' in application.monkey.status():
            return "Monkey already running", 400
        values = json.loads(request.get_data())
        values['rig'] = application.rig.values
        values['audio'] = application.audio.values
        values['rds'] = application.rds.values
        values['ident'] = application.get_ident()

        try:
            config = application.data_store.config().write(now(), values)
        except StoreError as e:
            return e.message, 500

        application.worker.start(config.id)
        if config.values['scan']['rds']:
            application.monkey.start(config.id)

        return json.dumps({})
    if request.method == 'DELETE':
        # stop process
        if 'timestamp' not in application.worker.status() and \
           'timestamp' not in application.monkey.status():
            return "Neither Worker nor Monkey are running", 400
        application.worker.stop()
        application.monkey.stop()
        return json.dumps({})
    if request.method == 'GET':
        # monitor status
        return json.dumps({'worker': application.worker.status(),
                           'monkey': application.monkey.status()})


@application.route('/config')
@application.route('/config/<config_ids>', methods=['GET', 'DELETE'])
@role_required(['admin', 'freq', 'data'])
def config_endpoint(config_ids=None):
    """ Endpoint for obtaining or deleting config objects by id (or all config objects
        if no config ids specified - only for GET).
    """
    # turn a config object into a dictionary representation, including any errors
    def _config_dict(config):
        c_dict = dict((k, v) for k, v in config.__dict__.iteritems() if k[0] != '_')
        c_dict['errors'] = list(config.iter_error())
        return c_dict
    try:
        if request.method == 'GET':
            ids = config_ids.split(',') if config_ids is not None else None
            data = [_config_dict(x) for x in application.data_store.iter_config(config_ids=ids)]
            return json.dumps({'data': data})
        else:
            if not user_has_role(['admin']):
                return "Need 'admin' privilege to delete", 400
            if config_ids is None:
                return "No config ids specified to delete", 400
            for config_id in config_ids.split(','):
                # check the config id is not in use
                if application.worker.status().get('config_id', None) == config_id:
                    return "Cannot delete config under running spectrum sweep", 400
                if application.monkey.status().get('config_id', None) == config_id:
                    return "Cannot delete config under running RDS sweep", 400
                # delete config and associated data
                application.data_store.config(config_id).delete()
            return json.dumps({})
    except StoreError as e:
        return e.message, 500


@application.route('/data/<config_id>')
@role_required(['admin', 'freq', 'data'])
def data_endpoint(config_id):
    """ Get spectrum, audio and RDS data for the specified config id. A range may be
        specified using 'start' and 'end' query string parameters.
    """
    # convert request argument to int
    def _int_arg(name):
        x = request.args.get(name)
        return None if x is None else int(x)

    interval = (_int_arg('start'), _int_arg('end'))
    try:
        config = application.data_store.config(config_id).read()
        data = {}
        data['spectrum'] = list(config.iter_spectrum(*interval))
        data['audio'] = list(config.iter_audio(*interval))
        data['rds'] = {
            'name': list(config.iter_rds_name(*interval)),
            'text': list(config.iter_rds_text(*interval))
        }
        return json.dumps(data)
    except StoreError as e:
        return e.message, 500


@application.route('/audio/<config_id>/<freq_n>/<timestamp>')
@role_required(['admin', 'freq', 'data'])
def audio_endpoint(config_id, freq_n, timestamp):
    """ Endpoint for streaming audio sample data.
    """
    if '.' in config_id or '/' in config_id or '\\' in config_id:
        return 'Bad parameter', 400
    try:
        int(timestamp), int(freq_n)
    except ValueError:
        return 'Bad parameter', 400
    base = application.data_store.config(config_id).audio_path(timestamp, freq_n)
    for ext in ['mp3', 'ogg', 'wav']:
        path = '{0}.{1}'.format(base, ext)
        try:
            return send_file_partial(path)
        except IOError:
            pass
    return 'File not found', 404


@application.route('/users')
@role_required(['admin', 'freq', 'data'])
def users_endpoint():
    """ Endpoint for listing user details. If the query string parameter
        'current' is specified, just list currently logged in users.
    """
    def _namise_data(name, data):
        data['name'] = name
        if name in application.logged_in_users:
            data['logged_in'] = True
        if name in application.request_times:
            data['last_request'] = application.request_times[name]
        data.pop('ui', None) # don't need to know about user's UI settings
        return data

    if request.args.get('current') is not None:
        data = application.logged_in_users
    else:
        if not user_has_role(['admin']):
            return "Need 'admin' privilege to get details of other users", 400
        data = [_namise_data(name, data) for name, data in application.users.iter_users()]
    return json.dumps({'data': data})


@application.route('/user', methods=['GET', 'POST'])
@application.route('/user/<name>', methods=['GET', 'PUT', 'DELETE'])
@role_required(['admin', 'freq', 'data'])
def user_endpoint(name=None):
    """ Endpoint for user manangement.
    """
    if name is not None:
        if not user_has_role(['admin']):
            return "Need 'admin' privilege to use this endpoint", 400
        try:
            if request.method == 'GET':
                data = application.users.get_user(name)
                if data is None:
                    return "No such user '{0}'".format(name), 404
                data['name'] = name
                if name in application.logged_in_users:
                    data['logged_in'] = True
                return json.dumps({'data': data})
            if request.method == 'PUT':
                if name in application.logged_in_users:
                    return "User is logged in", 400
                data = request.get_json()
                if data is None or 'user' not in data:
                    return "No user data", 400
                if application.users.set_user(name, data['user']):
                    return json.dumps({}), 200
                password = data.get('password')
                if password is None:
                    return "No password parameter", 400
                application.users.create_user(name, password, data['user'])
                return json.dumps({'status': 'Created'}), 201
            if request.method == 'DELETE':
                if application.users.delete_user(name):
                    return json.dumps({})
                else:
                    return "No such user '{0}'".format(name), 404
        except UsersError as e:
            return e.message, 400
    else:
        if request.method == 'GET':
            data = current_user.data
            data['name'] = current_user.name
            return json.dumps(data)
        if request.method == 'POST':
            data = request.get_json()
            if data is None:
                return "No user data", 400
            if 'oldPassword' in data and 'newPassword' in data:
                try:
                    old, new = data['oldPassword'], data['newPassword']
                    application.users.set_password(current_user.name, old, new)
                except IncorrectPasswordError:
                    return "Bad password", 400
                del data['oldPassword'], data['newPassword']
            if 'oldPassword' in data or 'newPassword' in data:
                return "Bad password parameters", 400
            if 'user' in data:
                if 'role' in data['user']:
                    del data['user']['role'] # a user cannot change their own role
                if not application.users.update_user(current_user.name, data['user']):
                    return "Logged in user does not exist", 500
            return json.dumps({})
    return "Not found", 404


@application.route('/login', methods=['GET', 'POST'])
def login_endpoint():
    """ Log in endpoint.
    """
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        try:
            user = load_user(username, password)
            login_user(user)
            application.request_times[user.name] = time()
            application.logged_in_users.append(user.name)
        except IncorrectPasswordError:
            pass
    return redirect('/')

@application.route('/logout')
@role_required(['admin', 'freq', 'data'])
def logout_endpoint():
    """ Logout endpoint.
    """
    name = getattr(current_user, 'name', None)
    if name is not None and name in application.logged_in_users:
        application.logged_in_users.remove(name)
    logout_user()
    return redirect('/')


@application.route('/export/<config_id>', methods=['GET', 'POST'])
@role_required(['admin', 'freq', 'data'])
def export_endpoint(config_id):
    """ Export data endpoint for writing file locally (POST) or streaming the output (GET).
    """
    # yield export data
    def _iter_export(scan_config):
        yield '#TimeDate,'
        yield ','.join([str(freq) for _, freq in scan(**scan_config)])
        yield '\n'
        for timestamp, strengths in config.iter_spectrum():
            yield str(datetime.fromtimestamp(timestamp / 1000))
            yield ','
            yield ','.join([str(v) if v > -128 else '' for v in strengths])
            yield '\n'

    config = application.data_store.config(config_id).read()
    ident = config.values['ident']
    scan_config = parse_config(config.values)
    export = _iter_export(scan_config)

    date = datetime.fromtimestamp(config.timestamp / 1000.0)
    date_s = date.strftime("%Y-%m-%d-%H-%M-%S")
    name = '_'.join([slugify(x) for x in [date_s, ident['name'], ident['description']]])

    if request.method == 'GET':
        response = Response(export, mimetype='text/csv')
        response.headers['Content-Disposition'] = 'attachment; filename={0}.csv'.format(name)
        return response
    else:
        path = os.path.join(EXPORT_DIRECTORY, '{0}.csv'.format(name))
        with open(path, 'w') as f:
            for x in export:
                f.write(x)
        return json.dumps({'path': path})


@application.route('/stats')
@role_required(['admin'])
def stats_endpoint():
    """ Endpoint for serving data store stats.
    """
    return json.dumps(application.data_store.stats())


@application.route('/ui')
@application.route('/ui/<key>', methods=['PUT'])
@role_required(['admin', 'freq', 'data'])
def ui_endpoint(key=None):
    """ Endpoint for managing a user's UI settings.
    """
    if key is None:
        return json.dumps(current_user.data.get('ui') or {})
    value = request.get_json()
    if not application.users.update_user(current_user.name, 'ui', {key: value}):
        return "Logged in user does not exist", 500
    return json.dumps({})


@application.route('/log/<name>')
@role_required(['admin'])
def log_endpoint(name):
    """ Endpoint for serving the contents of a log file.
    """
    path = os.path.join(LOG_PATH, '{0}.log'.format(name))
    if not os.path.exists(path):
        return "No log {0}".format(path), 400
    try:
        n = int(request.args.get('n', 10))
    except ValueError:
        return "Bad parameter", 400
    level = request.args.get('level', '\n')
    if level not in ('\n', 'DEBUG', 'INFO', 'WARN', 'ERROR'):
        return "Bad parameter", 400
    with open(path) as f:
        return Response(list(iter_tail(f, n, level)), mimetype='text/plain')


@application.route('/pi/<command>')
@role_required(['admin'])
def pi_endpoint(command):
    """ Endpoint for executing a Pi control command.
    """
    if command in ['shutdown', 'reboot']:
        os.system("{0} {1}".format(PI_CONTROL_PATH, command))
        return "OK"
    return "Command not recognized: " + command, 400
