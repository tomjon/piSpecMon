""" Define a sub-class of the Flask application that secures static files.
"""
import os
import functools
from time import time
from flask import Flask, current_app, redirect, request, Response, send_file
from flask_login import LoginManager, login_required, current_user, login_user, logout_user
from spectrum.common import log
from spectrum.users import IncorrectPasswordError


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

    def get_event(self):
        """ Event data for the user.
        """
        return {'name': self.name, 'role': self.data['role'], 'ip': request.environ['REMOTE_ADDR']}


class SecureStaticFlask(Flask): # pylint: disable=too-many-instance-attributes
    """ Sub-class Flask to secure static files, and add support for partial byte ranges.

        The curious looking two-step initialisation is so that the application instance can
        be created at import time for the decorators to work.
    """
    def __init__(self, name, static_folder):
        super(SecureStaticFlask, self).__init__(name, static_folder=static_folder, static_url_path='/static')
        self._init_logging()
        self.after_request(lambda rsp: rsp.headers.add('Accept-Ranges', 'bytes') or rsp)

    def initialise(self, users):
        self.users = users
        login_manager = LoginManager()
        login_manager.init_app(self)
        login_manager.user_loader(self.load_user)
        self.secret_key = os.urandom(24)
        self.logged_in_users = []
        self.request_times = {}
        self.before_request(self.check_user_timeout)

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
            return super(SecureStaticFlask, self).send_static_file(filename)
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
            return User(username, self.users.check_user(username, password))
        else:
            if username not in self.logged_in_users:
                return None # log out this user, who was logged in before server restart
            return User(username, self.users.get_user(username))

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

    def login(self):
        """ Log in a user.
        """
        username = request.form['username']
        password = request.form['password']
        try:
            user = self.load_user(username, password)
            login_user(user)
            self.request_times[user.name] = time()
            self.logged_in_users.append(user.name)
            return user
        except IncorrectPasswordError:
            return None

    def logout(self):
        """ Logout the current user.
        """
        try:
            name = getattr(current_user, 'name', None)
            if name is not None and name in application.logged_in_users:
                self.logged_in_users.remove(name)
                return current_user
            return None
        finally:
            logout_user()
