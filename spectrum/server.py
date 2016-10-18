""" Flask server for the Server API.
"""
import json
import os
import shutil
import re
import mimetypes
import functools
from time import time
from datetime import datetime
from worker import Worker
from monkey import Monkey
from monitor import get_capabilities
import fs_datastore as data_store
from flask import Flask, current_app, redirect, request, Response, send_file
from flask_login import LoginManager, login_user, login_required, current_user, logout_user
from config import DEFAULT_RIG_SETTINGS, DEFAULT_AUDIO_SETTINGS, DEFAULT_RDS_SETTINGS, \
                   DEFAULT_SCAN_SETTINGS, SECRET_KEY, VERSION_FILE, USER_TIMEOUT_SECS, \
                   SAMPLES_PATH, EXPORT_DIRECTORY
from common import log, local_path, now
from datastore import StoreError
from users import check_user, get_user, set_user, iter_users, update_user, \
                  create_user, delete_user, set_password, IncorrectPasswordError, UsersError
import tail


class SecuredStaticFlask(Flask): # pylint: disable=too-many-instance-attributes
    """ Sub-class Flask to secure static files.
    """
    def __init__(self, name):
        super(SecuredStaticFlask, self).__init__(name)
        self._init_logging()
        self._init_secret_key()
        self.login_manager = LoginManager()
        self.login_manager.init_app(self)
        self.logged_in_users = []
        self.request_times = {}
        self.before_request(self.check_user_timeout)
        self.caps = get_capabilities()
        log.info("%d rig models", len(self.caps['models']))
        self.rig = data_store.Settings(settings_id='rig').read(DEFAULT_RIG_SETTINGS)
        self.audio = data_store.Settings(settings_id='audio').read(DEFAULT_AUDIO_SETTINGS)
        self.rds = data_store.Settings(settings_id='rds').read(DEFAULT_RDS_SETTINGS)
        self.scan = data_store.Settings(settings_id='scan').read(DEFAULT_SCAN_SETTINGS)
        self.worker = Worker().client()
        self.monkey = Monkey().client()

    def _init_logging(self):
        # add log handlers to Flask's logger for when Werkzeug isn't the underlying WSGI server
        for handler in log.handlers:
            self.logger.addHandler(handler)

    def _init_secret_key(self):
        # set up secret key for sessions
        path = local_path(SECRET_KEY)
        if not os.path.exists(path):
            self.secret_key = os.urandom(24)
            with open(path, 'w') as f:
                f.write(self.secret_key)
        else:
            with open(path) as f:
                self.secret_key = f.read()

    def send_static_file(self, filename):
        """ Send a static file (overriding Flask's version).
        """
        logged_in = current_user is not None and \
                    not current_user.is_anonymous and \
                    current_user.is_authenticated
        if filename == 'login.html' or logged_in:
            if self.debug and filename == 'index.html':
                filename = 'index-debug.html'
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
        user = User(username, check_user(username, password))
    else:
        if username not in application.logged_in_users:
            return None # log out this user, who was logged in before server restart
        user = User(username, get_user(username))
    if user.data['role'] != 'data':
        for name in application.logged_in_users:
            if name == user.name:
                break
            data = get_user(name)
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
            return application.login_manager.unauthorized()
        return _decorated_view
    return _role_decorator


@application.route('/', methods=['GET', 'POST'])
def main():
    """ Redirect / to /static/xxx.html where xxx is either index or login.
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


# version string
@application.route('/version')
@role_required(['admin', 'freq', 'data'])
def version():
    """ Serve the version file.
    """
    path = os.path.join(application.root_path, VERSION_FILE)
    return send_file(path, mimetype='text/plain')

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
@application.route('/scan', methods=['GET', 'PUT']) #FIXME at present, this is not being called
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
        values = json.loads(request.get_data())
        values['rig'] = application.rig.values
        values['audio'] = application.audio.values
        values['rds'] = application.rds.values

        try:
            config = data_store.Config().write(now(), values)
        except StoreError as e:
            return e.message, 500

        application.worker.start(config.id)
        if config.values['scan']['rds'] == 'true':
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


# FIXME noone should be able to delete the running sweep
@application.route('/config')
@application.route('/config/<config_ids>', methods=['GET', 'DELETE'])
@role_required(['admin', 'freq', 'data'])
def config_endpoint(config_ids=None):
    """ Endpoint for obtaining or deleting config objects by id.
    """
    # turn a config object into a dictionary representation, including any errors
    def _config_dict(config):
        c_dict = config.__dict__
        c_dict['errors'] = list(config.iter_error())
        return c_dict
    try:
        if request.method == 'GET':
            ids = config_ids.split(',') if config_ids is not None else None
            data = [_config_dict(x) for x in data_store.Config.iter(config_ids=ids)]
            return json.dumps({'data': data})
        else:
            if not user_has_role(['admin']):
                return "Need 'admin' privilege to delete", 400
            if config_ids is None:
                return "No config ids specified to delete", 400
            for config_id in config_ids.split(','):
                # delete audio samples...
                samples_path = os.path.join(current_app.root_path, SAMPLES_PATH, config_id)
                if os.path.isdir(samples_path):
                    shutil.rmtree(samples_path)
                # delete config and associated data
                data_store.Config(config_id=config_id).delete()
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
        config = data_store.Config(config_id=config_id).read()
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
    base = data_store.Config(config_id=config_id).audio_path(timestamp, freq_n)
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
    """ Endpont for listing user details. If the query string parameter
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
        data = [_namise_data(name, data) for name, data in iter_users()]
    return json.dumps({'data': data})


@application.route('/user', methods=['GET', 'POST'])
@application.route('/user/<name>', methods=['GET', 'PUT', 'DELETE'])
@role_required(['admin', 'freq', 'data'])
def user_endpoint(name=None):
    """ End point for user manangement.
    """
    if name is not None:
        if not user_has_role(['admin']):
            return "Need 'admin' privilege to use this endpoint", 400
        try:
            if request.method == 'GET':
                data = get_user(name)
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
                if set_user(name, data['user']):
                    return json.dumps({}), 200
                password = data.get('password')
                if password is None:
                    return "No password parameter", 400
                create_user(name, password, data['user'])
                return json.dumps({'status': 'Created'}), 201
            if request.method == 'DELETE':
                if delete_user(name):
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
                    set_password(current_user.name, data['oldPassword'], data['newPassword'])
                except IncorrectPasswordError:
                    return "Bad password", 400
                del data['oldPassword'], data['newPassword']
            if 'oldPassword' in data or 'newPassword' in data:
                return "Bad password parameters", 400
            if 'user' in data:
                if 'role' in data['user']:
                    del data['user']['role'] # a user cannot change their own role
                if not update_user(current_user.name, data['user']):
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
    def _iter_export(config, hits):
        yield '#TimeDate,'
        if 'freqs' in config['freqs']:
            yield ','.join(freq['f'] * 10 ** int(freq['exp']) for freq in config['freqs']['freqs'])
        else:
            e = 10 ** int(config['freqs']['exp'])
            yield ','.join(str(f) for f in xrange(*[int(x * e) for x in config['freqs']['range']]))
        yield '\n'
        for hit in hits:
            time_0 = datetime.fromtimestamp(hit['fields']['timestamp'][0] / 1000.0)
            yield str(time_0)
            yield ','
            yield ','.join([str(v) if v > -128 else '' for v in hit['fields']['level']])
            yield '\n'

    config = data_store.Config(config_id=config_id).read()
    try:
        export = _iter_export(config.values, list(config.iter_spectrum()))
    except StoreError as e:
        return e.message, 500
    if request.method == 'GET':
        return Response(export, mimetype='text/csv')
    else:
        path = os.path.join(EXPORT_DIRECTORY, config_id + '.csv')
        with open(path, 'w') as f:
            for x in export:
                f.write(x)
        return json.dumps({'path': path})


@application.route('/stats')
@role_required(['admin'])
def stats_endpoint():
    """ Endpoint for serving data store stats.
    """
    return json.dumps(data_store.stats())


@application.route('/ui')
@application.route('/ui/<key>', methods=['PUT'])
@role_required(['admin', 'freq', 'data'])
def ui_endpoint(key=None):
    """ Endpoint for managing a user's UI settings.
    """
    if key is None:
        return json.dumps(current_user.data.get('ui') or {})
    value = request.get_json()
    if not update_user(current_user.name, 'ui', {key: value}):
        return "Logged in user does not exist", 500
    return json.dumps({})


@application.route('/log/<name>')
@role_required(['admin'])
def log_endpoint(name):
    """ Endpoint for serving the contents of a log file.
    """
    path = local_path('logs/{0}.log'.format(name))
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
        return Response(list(tail.iter_tail(f, n, level)), mimetype='text/plain')


@application.route('/pi/<command>')
@role_required(['admin'])
def pi_endpoint(command):
    """ Endpoint for executing a Pi control command.
    """
    if command in ['shutdown', 'reboot']:
        os.system("{0} {1}".format(local_path('bin/pi_control'), command))
        return "OK"
    return "Command not recognized: " + command, 400


if __name__ == "__main__":
    import sys

    if 'debug' in sys.argv:
        application.debug = True
    application.run(host='0.0.0.0', port=8080)
