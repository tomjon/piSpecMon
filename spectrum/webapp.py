""" Define a WebApplication that will be used by server.py to provide endpoints.
"""
import os
import re
import mimetypes
import functools
from time import time
from flask import Flask, current_app, redirect, request, Response, send_file
from flask_login import LoginManager, login_required, current_user, logout_user
from spectrum.monitor import get_capabilities
from spectrum.event import EventManager
from spectrum.common import log, psm_name


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


class WebApplication(Flask): # pylint: disable=too-many-instance-attributes
    """ Sub-class Flask to secure static files.

        The curious looking two-step initialisation is so that the application instance can
        be created at import time for the decorators to work.

        None of the methods on this class form part of the module API. The web endpoints are
        the module API.
    """
    def __init__(self, name):
        super(WebApplication, self).__init__(name)
        self._init_logging()
        self.after_request(lambda rsp: rsp.headers.add('Accept-Ranges', 'bytes') or rsp)
        login_manager = LoginManager()
        login_manager.init_app(self)
        login_manager.user_loader(self.load_user)

    def initialise(self, data_store, users, worker_client, monkey_client, default_rig_settings,
                   default_audio_settings, default_rds_settings, default_scan_settings, log_path,
                   version_file, user_timeout_secs, export_directory, pi_control_path, pico_path,
                   event_queue, event_poll_secs, event_overseer_url):
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
        self.rig = self.data_store.settings('rig').read(default_rig_settings)
        self.audio = self.data_store.settings('audio').read(default_audio_settings)
        self.rds = self.data_store.settings('rds').read(default_rds_settings)
        self.scan = self.data_store.settings('scan').read(default_scan_settings)
        self.description = self.data_store.settings('description').read('')
        self.worker = worker_client
        self.monkey = monkey_client
        self.log_path = log_path
        self.version_file = version_file
        self.user_timeout_secs = user_timeout_secs
        self.export_directory = export_directory
        self.pi_control_path = pi_control_path
        self.pico_path = pico_path

        self.ident = {'name': psm_name()}
        with open(os.path.join(self.root_path, self.version_file)) as f:
            self.ident['version'] = f.read()
        self.ident['description'] = self.description.values

        self.event_manager = EventManager(self.ident['name'], event_queue, event_poll_secs, event_overseer_url)

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
            return super(WebApplication, self).send_static_file(filename)
        else:
            return redirect('/')

    def send_file_partial(self, path): # pylint: disable=no-self-use
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

        rsp = Response(data, 206, mimetype=mimetypes.guess_type(path)[0], direct_passthrough=True)
        bytes_range = 'bytes {0}-{1}/{2}'.format(byte1, byte1 + length - 1, size)
        rsp.headers.add('Content-Range', bytes_range)
        return rsp

    def load_user(self, username, password=None):
        """ User loader for flask-login.
        """
        if password is not None:
            user = User(username, self.users.check_user(username, password))
        else:
            if username not in self.logged_in_users:
                return None # log out this user, who was logged in before server restart
            user = User(username, self.users.get_user(username))
        if user.data['role'] != 'data':
            for name in self.logged_in_users:
                if name == user.name:
                    break
                data = self.users.get_user(name)
                if data['role'] != 'data':
                    user.data['role'] = 'data'
                    user.data['superior'] = data
                    break
        return user

    def user_has_role(self, roles): # pylint: disable=no-self-use
        """ Return whether the current user has one of the specified list of roles.
        """
        return hasattr(current_user, 'data') and current_user.data['role'] in roles

    def role_required(self, roles):
        """ Define a decorator for specifying which roles can access which endpoints.
        """
        def _role_decorator(func):
            @functools.wraps(func)
            def _decorated_view(*args, **kwargs):
                if hasattr(current_user, 'name'):
                    self.request_times[current_user.name] = time()
                if self.user_has_role(roles):
                    return login_required(func)(*args, **kwargs)
                return self.login_manager.unauthorized() # pylint: disable=no-member
            return _decorated_view
        return _role_decorator

    def check_user_timeout(self):
        """ Check for user timeout since last request.
        """
        # check for user timeouts
        for name in self.logged_in_users:
            if not self.debug and time() > self.request_times[name] + self.user_timeout_secs:
                self.logged_in_users.remove(name)
        # check whether current user has been logged out?
        if not hasattr(current_user, 'name'):
            return None
        if current_user.name not in self.logged_in_users:
            logout_user()
            return "User session timed out", 403
        return None

    def set_ident(self, ident):
        """ Set identification information about the PSM unit.
        """
        if self.user_has_role(['admin', 'freq']) and 'description' in ident:
            self.ident['description'] = ident['description']
            self.description.write(ident['description'])
