""" Flask server for the Server API.
"""
import json
import os
import subprocess
import heapq
from datetime import datetime
from slugify import slugify
from flask import redirect, request, Response, send_file
from flask_login import current_user
from spectrum.tail import iter_tail
from spectrum.datastore import StoreError
from spectrum.common import log, now, parse_config, scan, freq
from spectrum.users import IncorrectPasswordError, UsersError
from spectrum.webapp import WebApplication
from spectrum.event import EVENT_IDENT, EVENT_LOGIN, EVENT_LOGOUT, EVENT_START, EVENT_STOP


application = WebApplication(__name__) # pylint: disable=invalid-name


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
    path = os.path.join(application.root_path, 'psm_ui', 'favicon.ico')
    return send_file(path, mimetype='image/vnd.microsoft.icon')


# id: name, version and description
@application.route('/ident', methods=['GET', 'PUT'])
@application.role_required(['admin', 'freq', 'data'])
def ident_endpoint():
    """ Serve or set the ident.
    """
    if request.method == 'GET':
        return json.dumps(application.ident)
    else:
        application.set_ident(request.get_json())
        application.event_client.write(EVENT_IDENT, application.ident)
        return json.dumps({})


# rig capabilities API
@application.route('/caps')
@application.role_required(['admin', 'freq', 'data'])
def caps():
    """ Serve rig capabilities JSON.
    """
    return json.dumps(application.caps)


@application.route('/rig', methods=['GET', 'PUT'])
@application.route('/audio', methods=['GET', 'PUT'])
@application.route('/rds', methods=['GET', 'PUT'])
@application.route('/scan', methods=['GET', 'PUT'])
@application.role_required(['admin', 'freq'])
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
@application.role_required(['admin', 'freq', 'data'])
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
        values['ident'] = application.ident

        try:
            config = application.data_store.config().write(now(), values)
        except StoreError as e:
            return e.message, 500

        application.worker.start(config.id)
        if config.values['scan']['rds']:
            application.monkey.start(config.id)
        application.event_client.write(EVENT_START, config.values)

        return json.dumps({})
    if request.method == 'DELETE':
        # stop process
        if 'timestamp' not in application.worker.status() and \
           'timestamp' not in application.monkey.status():
            return "Neither Worker nor Monkey are running", 400
        application.worker.stop()
        application.monkey.stop()
        application.event_client.write(EVENT_STOP, {})
        return json.dumps({})
    if request.method == 'GET':
        # monitor status
        return json.dumps({'worker': application.worker.status(),
                           'monkey': application.monkey.status()})


@application.route('/config')
@application.route('/config/<config_ids>', methods=['GET', 'DELETE'])
@application.role_required(['admin', 'freq', 'data'])
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
            if not application.user_has_role(['admin']):
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
@application.role_required(['admin', 'freq', 'data'])
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
@application.role_required(['admin', 'freq', 'data'])
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
            return application.send_file_partial(path)
        except IOError as e:
            log.error("Error sending file partial: %s", e)
    return 'File not found', 404


@application.route('/users')
@application.role_required(['admin', 'freq', 'data'])
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
        if not application.user_has_role(['admin']):
            return "Need 'admin' privilege to get details of other users", 400
        data = [_namise_data(name, data) for name, data in application.users.iter_users()]
    return json.dumps({'data': data})


@application.route('/user', methods=['GET', 'POST'])
@application.route('/user/<name>', methods=['GET', 'PUT', 'DELETE'])
@application.role_required(['admin', 'freq', 'data'])
def user_endpoint(name=None):
    """ Endpoint for user manangement.
    """
    if name is not None:
        if not application.user_has_role(['admin']):
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
        user = application.login()
        if user is not None:
            application.event_client.write(EVENT_LOGIN, user.get_event())
    return redirect('/')

@application.route('/logout')
@application.role_required(['admin', 'freq', 'data'])
def logout_endpoint():
    """ Logout endpoint.
    """
    application.event_client.write(EVENT_LOGOUT, current_user.get_event())
    application.logout()
    return redirect('/')


@application.route('/export/<config_id>', methods=['GET', 'POST'])
#@application.role_required(['admin', 'freq', 'data'])
def export_endpoint(config_id):
    """ Export data endpoint for writing file locally (POST) or streaming the output (GET).
    """
    # yield export spectrum data
    def _iter_spectrum_export(scan_config):
        yield '#TimeDate,'
        yield ','.join([str(freq) for _, freq in scan(**scan_config)])
        yield '\n'
        for timestamp, strengths in config.iter_spectrum():
            yield str(datetime.fromtimestamp(timestamp / 1000))
            yield ','
            yield ','.join([str(v) if v > -128 else '' for v in strengths])
            yield '\n'

    # yield export RDS data
    def _iter_rds_export(scan_config):
        def _name():
            for timestamp, freq_n, name in config.iter_rds_name():
                yield timestamp, freq_n, name, ''
        def _text():
            for timestamp, freq_n, text in config.iter_rds_text():
                yield timestamp, freq_n, '', text
        yield '#TimeDate,Freq,RDS Name,RDS Text\n'
        for timestamp, freq_n, name, text in heapq.merge(_name(), _text()): # luckily, natural sort order for tuples is what we want
            yield str(datetime.fromtimestamp(timestamp / 1000))
            yield ','
            yield str(freq(freq_n, **scan_config))
            yield ','
            yield name
            yield ','
            yield text
            yield '\n'

    try:
        config = application.data_store.config(config_id).read()
    except StoreError as e:
        return e.message, 404
    rds = request.args.get('rds', 'false') == 'true'
    ident = config.values['ident']
    scan_config = parse_config(config.values)
    export = _iter_spectrum_export(scan_config) if not rds else _iter_rds_export(scan_config)

    date = datetime.fromtimestamp(config.timestamp / 1000.0)
    date_s = date.strftime("%Y-%m-%d-%H-%M-%S")
    name = '_'.join([slugify(x) for x in [date_s, ident['name'], ident['description']]])

    filename = '{0}{1}.csv'.format(name, '' if not rds else '_rds')
    if request.method == 'GET':
        response = Response(export, mimetype='text/csv')
        response.headers['Content-Disposition'] = 'attachment; filename={0}'.format(filename)
        return response
    else:
        path = os.path.join(application.export_directory, filename)
        with open(path, 'w') as f:
            for x in export:
                f.write(x)
        return json.dumps({'path': path})


@application.route('/stats')
@application.role_required(['admin'])
def stats_endpoint():
    """ Endpoint for serving data store stats.
    """
    return json.dumps(application.data_store.stats())


@application.route('/ui')
@application.route('/ui/<key>', methods=['PUT'])
@application.role_required(['admin', 'freq', 'data'])
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
@application.role_required(['admin'])
def log_endpoint(name):
    """ Endpoint for serving the contents of a log file.
    """
    path = os.path.join(application.log_path, '{0}.log'.format(name))
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
@application.role_required(['admin'])
def pi_endpoint(command):
    """ Endpoint for executing a Pi control command.
    """
    if command in ['shutdown', 'reboot']:
        os.system("{0} {1}".format(application.pi_control_path, command))
        return "OK"
    return "Command not recognized: " + command, 400


@application.route('/pico')
@application.role_required(['admin'])
def pico_endpoint():
    """ Endpoint for returning the output of pico_status.py.
    """
    result = {}
    try:
        python = subprocess.check_output(['which', 'python']).strip()
        args = [python, application.pico_path]
        result['text'] = subprocess.check_output(args, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
        result['error'] = e.output
    return json.dumps(result)
